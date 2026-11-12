//! Private, immutable attachment bytes. Paths are derived from validated IDs/hashes only.
use super::*;
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{Read, Write},
};
pub(crate) const MAX_FILE: u64 = 25 * 1024 * 1024;
pub(crate) fn file_mime(bytes: &[u8]) -> Result<&'static str> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_FILE {
        return Err("파일은 1바이트~25 MB여야 합니다.".into());
    }
    if bytes.starts_with(b"%PDF-") {
        return Ok("application/pdf");
    }
    if let Ok(format) = image::guess_format(bytes) {
        let mime = match format {
            image::ImageFormat::Png => "image/png",
            image::ImageFormat::Jpeg => "image/jpeg",
            image::ImageFormat::WebP => "image/webp",
            _ => return Err("PNG/JPEG/WebP 이미지만 지원합니다.".into()),
        };
        let mut reader = image::ImageReader::with_format(std::io::Cursor::new(bytes), format);
        let mut limits = image::Limits::default();
        limits.max_image_width = Some(8192);
        limits.max_image_height = Some(8192);
        limits.max_alloc = Some(128 * 1024 * 1024);
        reader.limits(limits);
        reader
            .decode()
            .map_err(|_| "손상되었거나 너무 큰 이미지입니다.")?;
        return Ok(mime);
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|_| "PDF·PNG·JPEG·WebP·UTF-8 텍스트 파일만 지원합니다.")?;
    if text
        .chars()
        .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return Err("텍스트 파일에 허용되지 않는 제어 문자가 있습니다.".into());
    }
    Ok("text/plain")
}
pub(crate) fn blob_name(row: &Value) -> Result<String> {
    validate("attachments", row)?;
    let id = text(row, "id")?;
    Uuid::parse_str(id).map_err(|_| "파일 ID 오류")?;
    Ok(format!("{id}-{}", text(row, "sha256")?))
}
pub(crate) fn check_bytes(row: &Value, bytes: &[u8]) -> Result<()> {
    if row["byte_size"].as_u64() != Some(bytes.len() as u64)
        || text(row, "sha256")? != format!("{:x}", Sha256::digest(bytes))
        || text(row, "mime")? != file_mime(bytes)?
    {
        return Err("첨부파일 크기·형식·체크섬이 일치하지 않습니다.".into());
    }
    Ok(())
}
pub(crate) fn write_blob(dir: &Path, row: &Value, bytes: &[u8]) -> Result<()> {
    check_bytes(row, bytes)?;
    std::fs::create_dir_all(dir).map_err(|_| "첨부파일 폴더 오류")?;
    let path = dir.join(blob_name(row)?);
    if path.exists() {
        let mut existing = Vec::new();
        File::open(&path)
            .map_err(|_| "첨부파일 읽기 오류")?
            .take(MAX_FILE + 1)
            .read_to_end(&mut existing)
            .map_err(|_| "첨부파일 읽기 오류")?;
        if check_bytes(row, &existing).is_ok() {
            return Ok(());
        }
    }
    let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(|_| "첨부파일 임시 저장 오류")?;
    tmp.write_all(bytes)
        .and_then(|_| tmp.as_file().sync_all())
        .map_err(|_| "첨부파일 저장 오류")?;
    tmp.persist(path).map_err(|_| "첨부파일 저장 완료 오류")?;
    Ok(())
}
impl Database {
    pub(crate) fn attachment(&self, id: &str) -> Result<Value> {
        self.require_workspace()?;
        json_rows(
            &self.conn,
            "SELECT * FROM attachments WHERE id=?1 AND user_id=?2",
            &[SqlValue::Text(id.into()), SqlValue::Text(self.owner()?)],
        )?
        .into_iter()
        .next()
        .ok_or("첨부파일을 찾을 수 없습니다.".into())
    }
    pub(crate) fn import_attachment(
        &mut self,
        dir: &Path,
        filename: &str,
        resource_id: Option<String>,
        bytes: &[u8],
    ) -> Result<Value> {
        self.require_workspace()?;
        let id = Uuid::new_v4().to_string();
        let filename = filename
            .chars()
            .filter(|c| !c.is_control())
            .take(255)
            .collect::<String>();
        let filename = if filename.trim().is_empty() {
            "첨부파일".to_string()
        } else {
            filename
        };
        let input = json!({"id":id,"resource_id":resource_id,"filename":filename,"mime":file_mime(bytes)?,"byte_size":bytes.len(),"sha256":format!("{:x}",Sha256::digest(bytes))});
        write_blob(dir, &input, bytes)?;
        let owner = self.owner()?;
        let tx = self.conn.transaction().map_err(sql_error)?;
        let result =
            Self::write(&tx, &owner, "attachments", &input, &id, false, false).and_then(|row| {
                tx.commit().map_err(sql_error)?;
                Ok(row)
            });
        if result.is_err() {
            let _ = std::fs::remove_file(dir.join(blob_name(&input)?));
        }
        result
    }
    pub(crate) fn attachment_bytes(&self, dir: &Path, id: &str) -> Result<Vec<u8>> {
        let row = self.attachment(id)?;
        let mut bytes = Vec::new();
        File::open(dir.join(blob_name(&row)?))
            .map_err(|_| "이 기기에 파일이 없습니다. Cloud에서 내려받아 주세요.")?
            .take(MAX_FILE + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "첨부파일 읽기 오류")?;
        check_bytes(&row, &bytes)?;
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn immutable_bytes_backup_restore_and_corruption_repair() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = Database::open(&dir.path().join("workspace.db")).unwrap();
        db.bind_verified_account(
            &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
            "https://test.supabase.co",
        )
        .unwrap();
        let files = dir.path().join("attachments");
        let bytes = "안녕하세요\nattachment".as_bytes();
        let row = db
            .import_attachment(&files, "../../source.txt", None, bytes)
            .unwrap();
        let id = text(&row, "id").unwrap();
        assert_eq!(db.attachment_bytes(&files, id).unwrap(), bytes);
        assert!(!dir.path().join("source.txt").exists());
        let path = files.join(blob_name(&row).unwrap());
        std::fs::write(&path, b"corrupted").unwrap();
        assert!(db.attachment_bytes(&files, id).is_err());
        write_blob(&files, &row, bytes).unwrap();
        assert_eq!(db.attachment_bytes(&files, id).unwrap(), bytes);
        assert!(write_blob(&files, &row, b"other bytes").is_err());
        assert!(file_mime(b"\x00\x01executable").is_err());
        assert!(db
            .import_attachment(
                &files,
                "file.txt",
                Some("22222222-2222-4222-8222-222222222222".into()),
                bytes
            )
            .is_err());
        let archive = dir.path().join("backup.zip");
        db.export_archive(&dir.path().join("profile"), &archive)
            .unwrap();
        let preview = crate::backup::inspect_archive(File::open(&archive).unwrap()).unwrap();
        assert_eq!(preview.included_attachments, 1);
        assert_eq!(preview.missing_attachments, 0);
        std::fs::remove_file(&path).unwrap();
        db.restore_archive(
            File::open(&archive).unwrap(),
            &dir.path().join("profile"),
            &dir.path().join("recovery"),
        )
        .unwrap();
        assert_eq!(db.attachment_bytes(&files, id).unwrap(), bytes);
    }
}
