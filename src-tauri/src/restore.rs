//! Restore business rows into our trusted schema; never execute an archive's SQL.
use super::*;
use std::{
    fs::File,
    io::{Read, Seek, Write},
};
impl Database {
    pub fn restore_status(&self) -> Result<Value> {
        self.require_workspace()?;
        Ok(json_rows(
            &self.conn,
            "SELECT hold,recovery_name FROM local_restore_state WHERE singleton=1",
            &[],
        )?
        .remove(0))
    }
    pub fn resume_restored_sync(&mut self) -> Result<()> {
        self.require_workspace()?;
        self.conn
            .execute(
                "UPDATE local_restore_state SET hold=0 WHERE singleton=1",
                [],
            )
            .map_err(sql_error)?;
        Ok(())
    }
    pub(crate) fn restore_archive<R: Read + Seek>(
        &mut self,
        mut archive: R,
        profile: &Path,
        recovery: &Path,
    ) -> Result<crate::backup::BackupPreview> {
        self.require_workspace()?;
        let preview = crate::backup::inspect_archive(&mut archive)?;
        archive.rewind().map_err(|_| "백업 읽기 오류")?;
        let mut zip = zip::ZipArchive::new(archive).map_err(|_| "백업 ZIP 오류")?;
        let temp = tempfile::tempdir().map_err(|_| "복원 임시 폴더 오류")?;
        let path = temp.path().join("source.db");
        let mut output = File::create(&path).map_err(|_| "복원 임시 DB 오류")?;
        std::io::copy(
            &mut zip
                .by_name("database/timora.db")
                .map_err(|_| "백업 DB 없음")?
                .take(512 * 1024 * 1024 + 1),
            &mut output,
        )
        .map_err(|_| "복원 DB 읽기 오류")?;
        drop(output);
        let source = Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(sql_error)?;
        source
            .execute_batch("PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;")
            .map_err(sql_error)?;
        let identity = crate::json_rows(
            &source,
            "SELECT * FROM local_identity WHERE singleton=1",
            &[],
        )?
        .into_iter()
        .next()
        .ok_or("백업 계정 없음")?;
        let current = self.identity()?;
        if identity["cloud_user_id"] != current["cloud_user_id"]
            || identity["cloud_project_url"] != current["cloud_project_url"]
            || (identity["cloud_user_id"].is_null() && identity["id"] != current["id"])
        {
            return Err("현재 연결한 계정·서버의 백업만 복원할 수 있습니다.".into());
        }
        let owner = self.owner()?;
        let source_owner = text(&identity, "id")?;
        // Validate all rows before writing any live business data.
        let mut rows = Vec::new();
        for table in TABLES.into_iter().chain(EXTENSION_TABLES) {
            let exists: bool = source
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                    [table],
                    |r| r.get(0),
                )
                .map_err(sql_error)?;
            if !exists {
                continue;
            }
            let values = json_rows(&source, &format!("SELECT * FROM {table}"), &[])?;
            for row in &values {
                if text(row, "user_id")? != source_owner {
                    return Err("백업 데이터 소유자 오류".into());
                }
                validate(table, row)?;
            }
            rows.push((table, values));
        }
        let mut avatar = None;
        if let Some(name) = identity["local_avatar"].as_str() {
            let mut bytes = Vec::new();
            zip.by_name(&format!("profile/{name}"))
                .map_err(|_| "백업 사진 없음")?
                .take(1024 * 1024 + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "백업 사진 읽기 오류")?;
            let png = crate::profile::normalize_avatar(&bytes)?;
            std::fs::create_dir_all(profile).map_err(|_| "프로필 폴더 오류")?;
            let name = format!("{}.png", Uuid::new_v4());
            let path = profile.join(&name);
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|_| "복원 사진 저장 오류")?;
            file.write_all(&png)
                .and_then(|_| file.sync_all())
                .map_err(|_| "복원 사진 저장 오류")?;
            avatar = Some(name);
        }
        std::fs::create_dir_all(recovery).map_err(|_| "복구용 백업 폴더 오류")?;
        let recovery_name = format!("before-restore-{}.zip", Uuid::new_v4());
        self.export_archive(profile, &recovery.join(&recovery_name))?;
        let outcome = (|| {
            let tx = self.conn.transaction().map_err(sql_error)?;
            tx.execute("UPDATE native_sync_control SET applying=1", [])
                .map_err(sql_error)?;
            for table in EXTENSION_TABLES
                .into_iter()
                .rev()
                .chain(TABLES.into_iter().rev())
            {
                tx.execute(&format!("DELETE FROM {table}"), [])
                    .map_err(sql_error)?;
            }
            for (table, values) in &rows {
                for row in values {
                    let id = text(row, "id")?;
                    Self::write(&tx, &owner, table, row, id, false, true)?;
                    tx.execute(
                        &format!(
                            "UPDATE {table} SET remote_updated_at=?1,sync_state=?2 WHERE id=?3"
                        ),
                        params![
                            row["remote_updated_at"].as_str(),
                            text(row, "sync_state")?,
                            id
                        ],
                    )
                    .map_err(sql_error)?;
                }
            }
            let settings = json_rows(&source, "SELECT * FROM workspace_settings", &[])?
                .into_iter()
                .next()
                .ok_or("백업 설정 없음")?;
            Self::settings(&tx, &owner, &settings, true)?;
            // Copy only column names from the trusted live schema. Missing old columns use defaults.
            for table in [
                "native_sync_meta",
                "native_sync_outbox",
                "native_sync_conflicts",
                "tombstones",
            ] {
                tx.execute(&format!("DELETE FROM {table}"), [])
                    .map_err(sql_error)?;
                let mut stmt = tx
                    .prepare(&format!("PRAGMA table_info({table})"))
                    .map_err(sql_error)?;
                let columns = stmt
                    .query_map([], |r| r.get::<_, String>(1))
                    .map_err(sql_error)?
                    .collect::<std::result::Result<Vec<_>, _>>()
                    .map_err(sql_error)?;
                drop(stmt);
                for row in json_rows(&source, &format!("SELECT * FROM {table}"), &[])? {
                    let keys: Vec<_> = columns
                        .iter()
                        .filter(|c| row.get(c.as_str()).is_some())
                        .collect();
                    let names = keys
                        .iter()
                        .map(|k| k.as_str())
                        .collect::<Vec<_>>()
                        .join(",");
                    let placeholders = vec!["?"; keys.len()].join(",");
                    let args = keys
                        .iter()
                        .map(|k| sql_value(&row[k.as_str()]))
                        .collect::<Result<Vec<_>>>()?;
                    tx.execute(
                        &format!("INSERT INTO {table}({names}) VALUES({placeholders})"),
                        params_from_iter(args),
                    )
                    .map_err(sql_error)?;
                }
            }
            let control = json_rows(
                &source,
                "SELECT * FROM native_sync_control WHERE singleton=1",
                &[],
            )?
            .into_iter()
            .next()
            .ok_or("백업 동기화 상태 없음")?;
            tx.execute("UPDATE native_sync_control SET applying=0,cursor=?1,last_success=?2,settings_initialized=?3",params![text(&control,"cursor")?,control["last_success"].as_str(),control["settings_initialized"].as_i64().unwrap_or(1)]).map_err(sql_error)?;
            tx.execute(
                "UPDATE local_identity SET local_avatar=?1 WHERE singleton=1",
                [avatar.as_deref()],
            )
            .map_err(sql_error)?;
            tx.execute(
                "UPDATE local_restore_state SET hold=1,recovery_name=?1 WHERE singleton=1",
                [&recovery_name],
            )
            .map_err(sql_error)?;
            let violations: i64 = tx
                .query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })
                .map_err(sql_error)?;
            if violations != 0 {
                return Err("복원 관계 검사 실패. 기존 기록은 유지됩니다.".into());
            }
            tx.commit().map_err(sql_error)
        })();
        if outcome.is_err() {
            if let Some(name) = avatar {
                let _ = std::fs::remove_file(profile.join(name));
            }
        }
        outcome?;
        Ok(preview)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(path: &Path) -> Database {
        let mut db = Database::open(path).unwrap();
        db.bind_verified_account(
            &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
            "https://test.supabase.co",
        )
        .unwrap();
        db
    }
    #[test]
    fn restore_is_atomic_retains_delivery_and_blocks_sync_until_explicit_resume() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("live.db");
        let profile = dir.path().join("profile");
        let recovery = dir.path().join("recovery");
        let mut db = fixture(&path);
        let note = db
            .save(
                "notes",
                json!({"title":"Before","content":"original","project_id":null}),
                None,
            )
            .unwrap();
        let id = note["id"].as_str().unwrap().to_string();
        let pending = db.sync_status().unwrap()["pending"].clone();
        let archive = dir.path().join("backup.zip");
        db.export_archive(&profile, &archive).unwrap();
        db.save(
            "notes",
            json!({"title":"After","content":"new","project_id":null}),
            Some(id.clone()),
        )
        .unwrap();
        db.conn.execute_batch("CREATE TRIGGER fail_restore BEFORE INSERT ON notes BEGIN SELECT RAISE(ABORT,'failure fixture'); END;").unwrap();
        assert!(db
            .restore_archive(File::open(&archive).unwrap(), &profile, &recovery)
            .is_err());
        assert_eq!(db.load().unwrap()["notes"][0]["content"], "new");
        db.conn.execute_batch("DROP TRIGGER fail_restore;").unwrap();
        db.restore_archive(File::open(&archive).unwrap(), &profile, &recovery)
            .unwrap();
        assert_eq!(db.load().unwrap()["notes"][0]["content"], "original");
        assert_eq!(db.sync_status().unwrap()["pending"], pending);
        assert_eq!(db.load().unwrap()["notes"][0]["id"], id);
        let undo = db.restore_status().unwrap()["recovery_name"]
            .as_str()
            .unwrap()
            .to_string();
        assert!(db
            .sync_next("11111111-1111-4111-8111-111111111111")
            .is_err());
        drop(db);
        let mut db = Database::open(&path).unwrap();
        assert_eq!(db.restore_status().unwrap()["hold"], 1);
        db.restore_archive(
            File::open(recovery.join(undo)).unwrap(),
            &profile,
            &recovery,
        )
        .unwrap();
        assert_eq!(db.load().unwrap()["notes"][0]["content"], "new");
        db.resume_restored_sync().unwrap();
        assert!(db.sync_next("11111111-1111-4111-8111-111111111111").is_ok());
    }
}
