//! Private staging for a future backup. Never expose this raw snapshot as a
//! finished backup: it still needs a manifest, asset packaging and restore guard.
use crate::{sql_error, Database, Result, TABLES};
use rusqlite::{Connection, OpenFlags};
use std::{io::Write, path::Path};

impl Database {
    /// Creates a consistent SQLite snapshot, including committed WAL pages.
    /// The caller must hold the same lock used for writes and avatar changes.
    /// Only a new, empty staging directory is accepted.
    #[allow(dead_code)]
    pub(crate) fn stage_snapshot(&self, dir: &Path, profile_dir: &Path) -> Result<()> {
        self.require_workspace()?;
        std::fs::create_dir(dir).map_err(|_| "백업 임시 폴더를 만들 수 없습니다.")?;
        let outcome = (|| {
            let path = dir.join("timora.db");
            let dest = path.to_str().ok_or("백업 경로를 읽을 수 없습니다.")?;
            self.conn
                .execute("VACUUM INTO ?1", [dest])
                .map_err(sql_error)?;
            let check = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(sql_error)?;
            let integrity: String = check
                .pragma_query_value(None, "integrity_check", |row| row.get(0))
                .map_err(sql_error)?;
            if integrity != "ok" {
                return Err("백업 DB 무결성 검사에 실패했습니다.".into());
            }
            let version: i64 = check
                .pragma_query_value(None, "user_version", |row| row.get(0))
                .map_err(sql_error)?;
            if version != 4 {
                return Err("지원하지 않는 백업 DB 버전입니다.".into());
            }
            for table in TABLES.iter().copied().chain([
                "workspace_settings",
                "local_identity",
                "native_sync_control",
                "native_sync_meta",
                "native_sync_outbox",
                "native_sync_conflicts",
            ]) {
                let exists: i64 = check
                    .query_row(
                        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                        [table],
                        |row| row.get(0),
                    )
                    .map_err(sql_error)?;
                if exists != 1 {
                    return Err("백업에 필수 테이블이 없습니다.".into());
                }
            }
            let violations: i64 = check
                .query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |row| {
                    row.get(0)
                })
                .map_err(sql_error)?;
            if violations != 0 {
                return Err("백업 DB 관계 검사에 실패했습니다.".into());
            }
            if let Some(name) = self.avatar_name()? {
                let bytes = self
                    .read_avatar(profile_dir)?
                    .ok_or("프로필 사진이 없습니다.")?;
                let profile = dir.join("profile");
                std::fs::create_dir(&profile).map_err(|_| "백업 사진 폴더를 만들 수 없습니다.")?;
                let mut file = std::fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(profile.join(name))
                    .map_err(|_| "백업 사진을 만들 수 없습니다.")?;
                file.write_all(&bytes)
                    .and_then(|_| file.sync_all())
                    .map_err(|_| "백업 사진을 저장할 수 없습니다.")?;
            }
            Ok(())
        })();
        if outcome.is_err() {
            let _ = std::fs::remove_dir_all(dir);
        }
        outcome
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn snapshot_includes_uncheckpointed_wal_and_pending_changes() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = Database::open(&dir.path().join("live.db")).unwrap();
        db.bind_verified_account(
            &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
            "https://test.supabase.co",
        )
        .unwrap();
        db.save(
            "notes",
            json!({"title":"기록","content":"내용","project_id":null}),
            None,
        )
        .unwrap();
        let before = db.sync_status().unwrap();
        let stage = dir.path().join("staged");
        db.stage_snapshot(&stage, &dir.path().join("profile"))
            .unwrap();
        let snapshot =
            Connection::open_with_flags(stage.join("timora.db"), OpenFlags::SQLITE_OPEN_READ_ONLY)
                .unwrap();
        let title: String = snapshot
            .query_row("SELECT title FROM notes", [], |r| r.get(0))
            .unwrap();
        let pending: i64 = snapshot
            .query_row("SELECT count(*) FROM native_sync_outbox", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "기록");
        assert_eq!(pending, before["pending"].as_i64().unwrap());
        assert!(db
            .stage_snapshot(&stage, &dir.path().join("profile"))
            .is_err());
        assert!(stage.join("timora.db").exists());
    }

    #[test]
    fn signed_out_workspace_cannot_be_staged() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::open(&dir.path().join("live.db")).unwrap();
        assert!(db
            .stage_snapshot(&dir.path().join("staged"), &dir.path().join("profile"))
            .is_err());
        assert!(!dir.path().join("staged").exists());
    }

    #[test]
    fn missing_avatar_rejects_and_cleans_partial_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = Database::open(&dir.path().join("live.db")).unwrap();
        db.bind_verified_account(
            &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
            "https://test.supabase.co",
        )
        .unwrap();
        db.set_avatar_name(Some("22222222-2222-4222-8222-222222222222.png"))
            .unwrap();
        let stage = dir.path().join("staged");
        assert!(db
            .stage_snapshot(&stage, &dir.path().join("profile"))
            .is_err());
        assert!(!stage.exists());
        assert!(dir.path().join("live.db").exists());
    }

    #[test]
    fn snapshot_includes_referenced_profile_image() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = Database::open(&dir.path().join("live.db")).unwrap();
        db.bind_verified_account(
            &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
            "https://test.supabase.co",
        )
        .unwrap();
        let profile = dir.path().join("profile");
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(2, 2)
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        db.store_avatar(&profile, png.get_ref()).unwrap();
        let name = db.avatar_name().unwrap().unwrap();
        let stage = dir.path().join("staged");
        db.stage_snapshot(&stage, &profile).unwrap();
        assert_eq!(
            std::fs::read(stage.join("profile").join(&name)).unwrap(),
            std::fs::read(profile.join(name)).unwrap()
        );
    }
}
