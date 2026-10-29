//! Internal backup archive format. Not connected to the UI or restore yet.
//! Checksums detect corruption, not malicious changes by an archive author.
use crate::{Database, Result, TABLES};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs::File,
    io::{Read, Seek, Write},
    path::Path,
};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const MAX_DB: u64 = 512 * 1024 * 1024;
const MAX_AVATAR: u64 = 1024 * 1024;
const MAX_MANIFEST: u64 = 16 * 1024;

fn digest<R: Read>(mut reader: R, mut output: impl Write, limit: u64) -> Result<(u64, String)> {
    let mut hash = Sha256::new();
    let mut size = 0u64;
    let mut buf = [0u8; 65536];
    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|_| "백업 파일을 읽을 수 없습니다.")?;
        if n == 0 {
            break;
        }
        size = size.checked_add(n as u64).ok_or("백업 크기 오류")?;
        if size > limit {
            return Err("백업 파일 크기 제한을 초과했습니다.".into());
        }
        hash.update(&buf[..n]);
        output
            .write_all(&buf[..n])
            .map_err(|_| "백업을 저장할 수 없습니다.")?;
    }
    Ok((size, format!("{:x}", hash.finalize())))
}

fn valid_db(path: &Path) -> Result<Option<String>> {
    let db =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "백업 DB를 열 수 없습니다.")?;
    db.execute_batch("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;")
        .map_err(|_| "백업 DB 검사 설정 오류")?;
    let integrity: String = db
        .pragma_query_value(None, "integrity_check", |r| r.get(0))
        .map_err(|_| "백업 DB 무결성 오류")?;
    let version: i64 = db
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(|_| "백업 DB 버전 오류")?;
    if integrity != "ok" || version != 4 {
        return Err("손상되었거나 지원하지 않는 백업 DB입니다.".into());
    }
    for table in TABLES.iter().copied().chain([
        "workspace_settings",
        "local_identity",
        "native_sync_control",
        "native_sync_meta",
        "native_sync_outbox",
        "native_sync_conflicts",
    ]) {
        let exists: i64 = db
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [table],
                |r| r.get(0),
            )
            .map_err(|_| "백업 DB 검사 오류")?;
        if exists != 1 {
            return Err("백업에 필수 테이블이 없습니다.".into());
        }
    }
    let violations: i64 = db
        .query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
            r.get(0)
        })
        .map_err(|_| "백업 관계 검사 오류")?;
    if violations != 0 {
        return Err("백업 DB 관계 검사에 실패했습니다.".into());
    }
    let name: Option<String> = db
        .query_row(
            "SELECT local_avatar FROM local_identity WHERE singleton=1",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "백업 계정 정보 오류")?;
    if name
        .as_deref()
        .is_some_and(|n| !crate::valid_avatar_name(n))
    {
        return Err("백업 사진 경로 오류".into());
    }
    Ok(name)
}

#[allow(dead_code)]
pub(crate) fn validate_archive<R: Read + Seek>(reader: R) -> Result<()> {
    let mut zip = ZipArchive::new(reader).map_err(|_| "백업 ZIP이 손상되었습니다.")?;
    if !(2..=3).contains(&zip.len()) {
        return Err("백업 파일 구성이 올바르지 않습니다.".into());
    }
    let mut names = BTreeSet::new();
    for i in 0..zip.len() {
        let item = zip.by_index(i).map_err(|_| "백업 ZIP 항목 오류")?;
        let name = item.name().to_string();
        if item.is_dir()
            || item.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000)
            || !names.insert(name)
        {
            return Err("중복되거나 허용되지 않은 백업 항목입니다.".into());
        }
    }
    if !names.contains("manifest.json") || !names.contains("database/timora.db") {
        return Err("필수 백업 항목이 없습니다.".into());
    }
    let manifest: serde_json::Value = {
        let entry = zip
            .by_name("manifest.json")
            .map_err(|_| "백업 정보가 없습니다.")?;
        if entry.size() > MAX_MANIFEST {
            return Err("백업 정보 크기 오류".into());
        }
        serde_json::from_reader(entry.take(MAX_MANIFEST + 1)).map_err(|_| "백업 정보 형식 오류")?
    };
    if manifest["application"] != "Timora"
        || manifest["backup_format_version"] != 1
        || manifest["database_schema_version"] != 4
    {
        return Err("지원하지 않는 백업 형식입니다.".into());
    }
    let files = manifest["files"].as_object().ok_or("백업 파일 목록 오류")?;
    let entries: BTreeSet<String> = names
        .iter()
        .filter(|n| *n != "manifest.json")
        .cloned()
        .collect();
    if files.keys().cloned().collect::<BTreeSet<_>>() != entries {
        return Err("백업 파일 목록이 일치하지 않습니다.".into());
    }
    if entries.iter().any(|n| {
        n != "database/timora.db"
            && !(n.starts_with("profile/") && crate::valid_avatar_name(&n[8..]))
    }) {
        return Err("허용되지 않은 백업 경로입니다.".into());
    }
    let temp = tempfile::tempdir().map_err(|_| "백업 임시 폴더 오류")?;
    let db_path = temp.path().join("timora.db");
    for name in &entries {
        let entry = zip.by_name(name).map_err(|_| "백업 항목 오류")?;
        let limit = if name == "database/timora.db" {
            MAX_DB
        } else {
            MAX_AVATAR
        };
        if entry.size() > limit {
            return Err("백업 항목 크기 오류".into());
        }
        let mut image = Vec::new();
        let (size, hash) = if name == "database/timora.db" {
            digest(
                entry,
                File::create(&db_path).map_err(|_| "백업 임시 DB 오류")?,
                limit,
            )?
        } else {
            digest(entry, &mut image, limit)?
        };
        if files[name]["size"].as_u64() != Some(size)
            || files[name]["sha256"].as_str() != Some(hash.as_str())
        {
            return Err("백업 무결성 확인에 실패했습니다.".into());
        }
        if name != "database/timora.db" {
            if image::guess_format(&image).ok() != Some(image::ImageFormat::Png) {
                return Err("백업 프로필 사진 형식 오류".into());
            }
            crate::profile::normalize_avatar(&image)?;
        }
    }
    let avatar = valid_db(&db_path)?;
    let expected = avatar.map(|n| format!("profile/{n}"));
    if entries
        .iter()
        .find(|n| n.starts_with("profile/"))
        .map(String::as_str)
        != expected.as_deref()
    {
        return Err("백업 프로필 사진이 일치하지 않습니다.".into());
    }
    Ok(())
}

impl Database {
    /// Writes only to a newly created path. A failed write removes the new file;
    /// an existing destination and the live workspace are never overwritten.
    #[allow(dead_code)]
    pub(crate) fn export_archive(&self, profile_dir: &Path, destination: &Path) -> Result<()> {
        let temp = tempfile::tempdir().map_err(|_| "백업 임시 폴더 오류")?;
        let stage = temp.path().join("stage");
        self.stage_snapshot(&stage, profile_dir)?;
        let avatar = valid_db(&stage.join("timora.db"))?;
        let mut sources = vec![(
            "database/timora.db".to_string(),
            stage.join("timora.db"),
            MAX_DB,
        )];
        if let Some(name) = avatar {
            sources.push((
                format!("profile/{name}"),
                stage.join("profile").join(name),
                MAX_AVATAR,
            ));
        }
        let mut options = std::fs::OpenOptions::new();
        options.write(true).read(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options
            .open(destination)
            .map_err(|_| "백업 파일을 새로 만들 수 없습니다.")?;
        let outcome = (|| {
            let mut writer = ZipWriter::new(file);
            let options = SimpleFileOptions::default()
                .compression_method(CompressionMethod::Stored)
                .unix_permissions(0o600);
            let mut files = serde_json::Map::new();
            for (name, path, limit) in &sources {
                writer
                    .start_file(name, options)
                    .map_err(|_| "백업 ZIP 생성 오류")?;
                let (size, sha256) = digest(
                    File::open(path).map_err(|_| "백업 원본을 읽을 수 없습니다.")?,
                    &mut writer,
                    *limit,
                )?;
                files.insert(
                    name.clone(),
                    serde_json::json!({"size":size,"sha256":sha256}),
                );
            }
            writer
                .start_file("manifest.json", options)
                .map_err(|_| "백업 정보 생성 오류")?;
            serde_json::to_writer(&mut writer, &serde_json::json!({"application":"Timora","backup_format_version":1,"app_version":env!("CARGO_PKG_VERSION"),"created_at":chrono::Utc::now().to_rfc3339(),"database_schema_version":4,"files":files})).map_err(|_| "백업 정보 저장 오류")?;
            let mut file = writer.finish().map_err(|_| "백업 ZIP 완료 오류")?;
            file.flush()
                .and_then(|_| file.sync_all())
                .map_err(|_| "백업 저장 완료 오류")?;
            file.rewind().map_err(|_| "백업 검증 오류")?;
            validate_archive(file)
        })();
        if outcome.is_err() {
            let _ = std::fs::remove_file(destination);
        }
        outcome
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Cursor;

    fn fixture(dir: &Path) -> Database {
        let mut db = Database::open(&dir.join("live.db")).unwrap();
        db.bind_verified_account(
            &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
            "https://test.supabase.co",
        )
        .unwrap();
        db.save(
            "notes",
            json!({"title":"note","content":"important","project_id":null}),
            None,
        )
        .unwrap();
        db
    }

    #[test]
    fn archive_round_trip_preserves_wal_and_image() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = fixture(dir.path());
        let profile = dir.path().join("profile");
        let mut image = Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(2, 2)
            .write_to(&mut image, image::ImageFormat::Png)
            .unwrap();
        db.store_avatar(&profile, image.get_ref()).unwrap();
        let destination = dir.path().join("backup.zip");
        db.export_archive(&profile, &destination).unwrap();
        validate_archive(File::open(&destination).unwrap()).unwrap();
        let mut zip = ZipArchive::new(File::open(&destination).unwrap()).unwrap();
        let avatar = db.avatar_name().unwrap().unwrap();
        assert!(zip.by_name(&format!("profile/{avatar}")).is_ok());
        let before = std::fs::read(&destination).unwrap();
        assert!(db.export_archive(&profile, &destination).is_err());
        assert_eq!(std::fs::read(&destination).unwrap(), before);
    }

    #[test]
    fn rejects_corruption_and_unsafe_entries() {
        let dir = tempfile::tempdir().unwrap();
        let db = fixture(dir.path());
        let destination = dir.path().join("backup.zip");
        db.export_archive(&dir.path().join("profile"), &destination)
            .unwrap();
        let bytes = std::fs::read(&destination).unwrap();
        assert!(validate_archive(Cursor::new(&bytes[..bytes.len() / 2])).is_err());
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        let opts = SimpleFileOptions::default();
        for name in ["manifest.json", "database/timora.db", "../escape"] {
            writer.start_file(name, opts).unwrap();
            writer.write_all(b"{}").unwrap();
        }
        let archive = writer.finish().unwrap().into_inner();
        assert!(validate_archive(Cursor::new(archive)).is_err());
        assert!(!dir.path().join("escape").exists());
    }

    #[test]
    fn rejects_checksum_mismatch_even_when_zip_crc_is_valid() {
        let dir = tempfile::tempdir().unwrap();
        let db = fixture(dir.path());
        let destination = dir.path().join("backup.zip");
        db.export_archive(&dir.path().join("profile"), &destination)
            .unwrap();
        let mut original = ZipArchive::new(File::open(destination).unwrap()).unwrap();
        let mut db_bytes = Vec::new();
        original
            .by_name("database/timora.db")
            .unwrap()
            .read_to_end(&mut db_bytes)
            .unwrap();
        let mut manifest: serde_json::Value =
            serde_json::from_reader(original.by_name("manifest.json").unwrap()).unwrap();
        manifest["files"]["database/timora.db"]["sha256"] = json!("0".repeat(64));
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        let opts = SimpleFileOptions::default();
        writer.start_file("database/timora.db", opts).unwrap();
        writer.write_all(&db_bytes).unwrap();
        writer.start_file("manifest.json", opts).unwrap();
        serde_json::to_writer(&mut writer, &manifest).unwrap();
        let archive = writer.finish().unwrap().into_inner();
        assert!(validate_archive(Cursor::new(archive))
            .unwrap_err()
            .contains("무결성"));
    }

    #[test]
    fn rejects_traversal_even_with_matching_manifest() {
        let dir = tempfile::tempdir().unwrap();
        let db = fixture(dir.path());
        let destination = dir.path().join("backup.zip");
        db.export_archive(&dir.path().join("profile"), &destination)
            .unwrap();
        let mut original = ZipArchive::new(File::open(destination).unwrap()).unwrap();
        let mut db_bytes = Vec::new();
        original
            .by_name("database/timora.db")
            .unwrap()
            .read_to_end(&mut db_bytes)
            .unwrap();
        let mut manifest: serde_json::Value =
            serde_json::from_reader(original.by_name("manifest.json").unwrap()).unwrap();
        let (_, hash) = digest(&b"outside"[..], std::io::sink(), 100).unwrap();
        manifest["files"]["../escape"] = json!({"size":7,"sha256":hash});
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        let opts = SimpleFileOptions::default();
        writer.start_file("database/timora.db", opts).unwrap();
        writer.write_all(&db_bytes).unwrap();
        writer.start_file("../escape", opts).unwrap();
        writer.write_all(b"outside").unwrap();
        writer.start_file("manifest.json", opts).unwrap();
        serde_json::to_writer(&mut writer, &manifest).unwrap();
        let archive = writer.finish().unwrap().into_inner();
        assert!(validate_archive(Cursor::new(archive))
            .unwrap_err()
            .contains("경로"));
        assert!(!dir.path().join("escape").exists());
    }

    #[test]
    fn missing_avatar_cannot_create_backup_or_damage_live_data() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = fixture(dir.path());
        db.set_avatar_name(Some("22222222-2222-4222-8222-222222222222.png"))
            .unwrap();
        let destination = dir.path().join("backup.zip");
        assert!(db
            .export_archive(&dir.path().join("missing"), &destination)
            .is_err());
        assert!(!destination.exists());
        assert_eq!(db.load().unwrap()["notes"][0]["content"], "important");
    }
}
