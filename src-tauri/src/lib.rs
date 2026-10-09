//! SQLite working store. No network or credentials; all mutations are transactions.
use chrono::{DateTime, NaiveDate, Utc};
use rusqlite::{params, params_from_iter, types::Value as SqlValue, Connection};
use serde_json::{json, Map, Value};
use std::{path::Path, time::Duration};
use uuid::Uuid;

type Result<T> = std::result::Result<T, String>;
fn sql_error(e: rusqlite::Error) -> String {
    format!("Local DB 오류: {e}. DB를 삭제하지 말고 다시 시도하거나 진단 문서를 확인하세요.")
}
fn now() -> String {
    Utc::now().to_rfc3339()
}
pub const TABLES: [&str; 6] = [
    "projects",
    "tasks",
    "notes",
    "events",
    "library_items",
    "inbox_items",
];
fn fields(table: &str) -> Result<&'static [&'static str]> {
    match table {
        "projects" => Ok(&["name", "description", "status", "color"]),
        "tasks" => Ok(&[
            "title",
            "description",
            "status",
            "priority",
            "start_date",
            "due_date",
            "project_id",
        ]),
        "notes" => Ok(&["title", "content", "project_id"]),
        "events" => Ok(&["title", "description", "start_at", "end_at", "project_id"]),
        "library_items" => Ok(&["title", "description", "url", "type", "project_id"]),
        "inbox_items" => Ok(&["content", "type"]),
        _ => Err("지원하지 않는 항목 종류입니다.".into()),
    }
}
fn text<'a>(row: &'a Value, key: &str) -> Result<&'a str> {
    row[key]
        .as_str()
        .ok_or_else(|| format!("{key} 입력을 확인해 주세요."))
}
fn limit(s: &str, max: usize, required: bool) -> Result<()> {
    if (required && s.trim().is_empty()) || s.chars().count() > max {
        return Err("내용 길이를 확인해 주세요.".into());
    }
    Ok(())
}
fn choice(row: &Value, key: &str, allowed: &[&str]) -> Result<()> {
    if !allowed.contains(&text(row, key)?) {
        return Err(format!("{key} 값을 확인해 주세요."));
    }
    Ok(())
}
fn date(row: &Value, key: &str) -> Result<()> {
    if row[key].is_null() {
        return Ok(());
    }
    let s = text(row, key)?;
    if NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|d| d.to_string())
        .ok()
        .as_deref()
        != Some(s)
    {
        return Err("올바른 날짜를 입력해 주세요.".into());
    }
    Ok(())
}
fn instant(s: &str) -> Result<DateTime<chrono::FixedOffset>> {
    DateTime::parse_from_rfc3339(s).map_err(|_| "일정 시간을 확인해 주세요.".into())
}
fn validate(table: &str, row: &Value) -> Result<()> {
    for key in fields(table)? {
        if ["project_id", "start_date", "due_date"].contains(key) && row[*key].is_null() {
            continue;
        }
        text(row, key)?;
    }
    let label = if table == "projects" {
        "name"
    } else if table == "inbox_items" {
        "content"
    } else {
        "title"
    };
    limit(
        text(row, label)?,
        if table == "inbox_items" { 20000 } else { 300 },
        true,
    )?;
    if let Some(id) = row["project_id"].as_str() {
        Uuid::parse_str(id).map_err(|_| "Project ID를 확인해 주세요.")?;
    }
    match table {
        "tasks" => {
            choice(row, "status", &["todo", "in_progress", "done"])?;
            choice(row, "priority", &["low", "medium", "high"])?;
            date(row, "start_date")?;
            date(row, "due_date")?;
            if let (Some(start), Some(end)) = (row["start_date"].as_str(), row["due_date"].as_str())
            {
                if start > end {
                    return Err("마감일은 시작일 이후여야 합니다.".into());
                }
            }
        }
        "notes" => limit(text(row, "content")?, 1000000, false)?,
        "events" => {
            if instant(text(row, "start_at")?)? >= instant(text(row, "end_at")?)? {
                return Err("종료 시간은 시작 시간 이후여야 합니다.".into());
            }
        }
        "projects" => {
            choice(row, "status", &["active", "paused", "completed"])?;
            let color = text(row, "color")?;
            if color.len() != 7
                || !color.starts_with('#')
                || !color[1..].bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err("색상을 확인해 주세요.".into());
            }
        }
        "library_items" => {
            choice(
                row,
                "type",
                &[
                    "website", "article", "github", "video", "pdf", "file", "other",
                ],
            )?;
            let url = url::Url::parse(text(row, "url")?).map_err(|_| "URL을 확인해 주세요.")?;
            if !["http", "https"].contains(&url.scheme()) {
                return Err("HTTP(S) URL만 저장할 수 있습니다.".into());
            }
        }
        "inbox_items" => choice(
            row,
            "type",
            &[
                "unclassified",
                "task",
                "note",
                "event",
                "project",
                "resource",
            ],
        )?,
        _ => unreachable!(),
    }
    Ok(())
}
fn validate_settings(row: &Value) -> Result<()> {
    limit(text(row, "workspace_name")?, 80, true)?;
    limit(text(row, "display_name")?, 64, false)?;
    choice(row, "appearance", &["light", "dark", "system"])?;
    if !row["avatar_url"].is_null() {
        let s = text(row, "avatar_url")?;
        let url = url::Url::parse(s).map_err(|_| "HTTPS 이미지 URL을 확인해 주세요.")?;
        if s.len() > 2048
            || url.scheme() != "https"
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("HTTPS 이미지 URL을 확인해 주세요.".into());
        }
    }
    Ok(())
}
fn json_rows(conn: &Connection, query: &str, args: &[SqlValue]) -> Result<Vec<Value>> {
    let mut stmt = conn.prepare(query).map_err(sql_error)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt
        .query_map(params_from_iter(args), |row| {
            let mut result = Map::new();
            for (i, name) in names.iter().enumerate() {
                let value: Option<String> = row.get(i)?;
                result.insert(
                    name.clone(),
                    value.map(Value::String).unwrap_or(Value::Null),
                );
            }
            Ok(Value::Object(result))
        })
        .map_err(sql_error)?;
    rows.collect::<std::result::Result<Vec<_>, _>>()
        .map_err(sql_error)
}
fn sql_value(value: &Value) -> Result<SqlValue> {
    if value.is_null() {
        Ok(SqlValue::Null)
    } else {
        Ok(SqlValue::Text(
            value.as_str().ok_or("입력 형식 오류")?.into(),
        ))
    }
}

pub struct Database {
    conn: Connection,
}
impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        let mut conn = Connection::open(path).map_err(sql_error)?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(sql_error)?;
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(sql_error)?;
        if version > 1 {
            return Err(
                "이 DB는 더 새로운 Timora 버전에서 생성됐습니다. 업데이트한 앱으로 열어 주세요."
                    .into(),
            );
        }
        conn.execute_batch(
            "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
        )
        .map_err(sql_error)?;
        if version == 0 {
            let tx = conn.transaction().map_err(sql_error)?;
            tx.execute_batch(include_str!("../migrations/001_initial_local_schema.sql"))
                .map_err(|_| {
                    "Local migration 실패. 기존 DB를 삭제하지 말고 진단 문서를 확인하세요."
                        .to_string()
                })?;
            let id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO local_identity(singleton,id) VALUES(1,?1)",
                [&id],
            )
            .map_err(sql_error)?;
            tx.execute(
                "INSERT INTO workspace_settings VALUES(?1,'Local Workspace','system','',NULL,?2)",
                params![id, now()],
            )
            .map_err(sql_error)?;
            tx.pragma_update(None, "user_version", 1)
                .map_err(sql_error)?;
            tx.commit().map_err(sql_error)?;
        }
        conn.query_row("SELECT id FROM local_identity WHERE singleton=1", [], |r| {
            r.get::<_, String>(0)
        })
        .map_err(sql_error)?;
        Ok(Self { conn })
    }
    pub fn owner(&self) -> Result<String> {
        self.conn
            .query_row("SELECT id FROM local_identity WHERE singleton=1", [], |r| {
                r.get(0)
            })
            .map_err(sql_error)
    }
    pub fn account(&self) -> Result<Value> {
        Ok(json!({"id":self.owner()?,"local":true}))
    }
    pub fn load(&self) -> Result<Value> {
        let mut data = Map::new();
        for table in TABLES {
            data.insert(
                table.into(),
                Value::Array(json_rows(
                    &self.conn,
                    &format!("SELECT * FROM {table} ORDER BY updated_at DESC,id DESC"),
                    &[],
                )?),
            );
        }
        data.insert(
            "settings".into(),
            json_rows(&self.conn, "SELECT * FROM workspace_settings", &[])?
                .into_iter()
                .next()
                .ok_or("설정이 없습니다.")?,
        );
        Ok(Value::Object(data))
    }
    fn write(
        conn: &Connection,
        owner: &str,
        table: &str,
        input: &Value,
        id: &str,
        update: bool,
        imported: bool,
    ) -> Result<Value> {
        validate(table, input)?;
        Uuid::parse_str(id).map_err(|_| "항목 ID를 확인해 주세요.")?;
        let columns = fields(table)?;
        let mut row = Map::new();
        for col in columns {
            row.insert((*col).into(), input[*col].clone());
        }
        row.insert("id".into(), json!(id));
        row.insert("user_id".into(), json!(owner));
        row.insert(
            "updated_at".into(),
            json!(if imported {
                text(input, "updated_at")?.to_string()
            } else {
                now()
            }),
        );
        if update {
            let mut keys: Vec<String> = columns.iter().map(|s| s.to_string()).collect();
            keys.push("updated_at".into());
            let mut args = keys
                .iter()
                .map(|k| sql_value(&row[k]))
                .collect::<Result<Vec<_>>>()?;
            args.push(SqlValue::Text(id.into()));
            args.push(SqlValue::Text(owner.into()));
            let set = keys
                .iter()
                .map(|k| format!("{k}=?"))
                .collect::<Vec<_>>()
                .join(",");
            let n = conn.execute(&format!("UPDATE {table} SET {set},sync_state=CASE WHEN remote_updated_at IS NULL THEN 'local' ELSE 'modified' END WHERE id=? AND user_id=?"), params_from_iter(args)).map_err(sql_error)?;
            if n == 0 {
                return Err("항목이 없거나 수정할 수 없습니다.".into());
            }
        } else {
            row.insert(
                "created_at".into(),
                json!(if imported {
                    text(input, "created_at")?.to_string()
                } else {
                    now()
                }),
            );
            row.insert(
                "remote_updated_at".into(),
                if imported {
                    input["updated_at"].clone()
                } else {
                    Value::Null
                },
            );
            row.insert(
                "sync_state".into(),
                json!(if imported { "imported" } else { "local" }),
            );
            let keys: Vec<_> = row.keys().cloned().collect();
            let args = keys
                .iter()
                .map(|k| sql_value(&row[k]))
                .collect::<Result<Vec<_>>>()?;
            let placeholders = vec!["?"; keys.len()].join(",");
            conn.execute(
                &format!(
                    "INSERT INTO {table} ({}) VALUES({placeholders})",
                    keys.join(",")
                ),
                params_from_iter(args),
            )
            .map_err(sql_error)?;
        }
        json_rows(
            conn,
            &format!("SELECT * FROM {table} WHERE id=?"),
            &[SqlValue::Text(id.into())],
        )?
        .into_iter()
        .next()
        .ok_or("저장 응답이 없습니다.".into())
    }
    pub fn save(&mut self, table: &str, input: Value, id: Option<String>) -> Result<Value> {
        let owner = self.owner()?;
        let update = id.is_some();
        let id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let tx = self.conn.transaction().map_err(sql_error)?;
        let row = Self::write(&tx, &owner, table, &input, &id, update, false)?;
        tx.commit().map_err(sql_error)?;
        Ok(row)
    }
    fn delete(conn: &Connection, table: &str, id: &str) -> Result<()> {
        fields(table)?;
        let row = json_rows(
            conn,
            &format!("SELECT remote_updated_at FROM {table} WHERE id=?"),
            &[SqlValue::Text(id.into())],
        )?
        .into_iter()
        .next()
        .ok_or("항목이 없거나 이미 삭제됐습니다.")?;
        if !row["remote_updated_at"].is_null() {
            conn.execute(
                "INSERT INTO tombstones VALUES(?1,?2,?3,?4)",
                params![table, id, row["remote_updated_at"].as_str(), now()],
            )
            .map_err(sql_error)?;
        }
        if table == "projects" {
            for child in ["tasks", "notes", "events", "library_items"] {
                conn.execute(&format!("UPDATE {child} SET project_id=NULL,updated_at=?1,sync_state=CASE WHEN remote_updated_at IS NULL THEN 'local' ELSE 'modified' END WHERE project_id=?2"),params![now(),id]).map_err(sql_error)?;
            }
        }
        conn.execute(&format!("DELETE FROM {table} WHERE id=?1"), [id])
            .map_err(sql_error)?;
        Ok(())
    }
    pub fn remove(&mut self, table: &str, id: &str) -> Result<()> {
        let tx = self.conn.transaction().map_err(sql_error)?;
        Self::delete(&tx, table, id)?;
        tx.commit().map_err(sql_error)
    }
    pub fn convert(&mut self, id: &str, target: &str) -> Result<()> {
        let owner = self.owner()?;
        let tx = self.conn.transaction().map_err(sql_error)?;
        let source = json_rows(
            &tx,
            "SELECT content FROM inbox_items WHERE id=?",
            &[SqlValue::Text(id.into())],
        )?
        .into_iter()
        .next()
        .ok_or("Inbox 기록이 없거나 이미 이동됐습니다.")?;
        let content = text(&source, "content")?;
        let title = content
            .trim()
            .lines()
            .next()
            .unwrap_or("Inbox 기록")
            .chars()
            .take(300)
            .collect::<String>();
        let (table, input) = match target {
            "task" => (
                "tasks",
                json!({"title":title,"description":content,"status":"todo","priority":"medium","start_date":null,"due_date":null,"project_id":null}),
            ),
            "note" => (
                "notes",
                json!({"title":title,"content":content,"project_id":null}),
            ),
            _ => return Err("Task 또는 Note로만 이동할 수 있습니다.".into()),
        };
        Self::write(
            &tx,
            &owner,
            table,
            &input,
            &Uuid::new_v4().to_string(),
            false,
            false,
        )?;
        Self::delete(&tx, "inbox_items", id)?;
        tx.commit().map_err(sql_error)
    }
    fn settings(conn: &Connection, owner: &str, input: &Value, imported: bool) -> Result<Value> {
        validate_settings(input)?;
        conn.execute("UPDATE workspace_settings SET workspace_name=?1,appearance=?2,display_name=?3,avatar_url=?4,updated_at=?5 WHERE user_id=?6",params![text(input,"workspace_name")?,text(input,"appearance")?,text(input,"display_name")?,input["avatar_url"].as_str(),if imported { text(input,"updated_at")?.to_string() } else { now() },owner]).map_err(sql_error)?;
        json_rows(conn, "SELECT * FROM workspace_settings", &[])?
            .into_iter()
            .next()
            .ok_or("설정 저장 실패".into())
    }
    pub fn save_settings(&mut self, input: Value) -> Result<Value> {
        let owner = self.owner()?;
        let tx = self.conn.transaction().map_err(sql_error)?;
        let row = Self::settings(&tx, &owner, &input, false)?;
        tx.commit().map_err(sql_error)?;
        Ok(row)
    }
    pub fn import(&mut self, cloud_user_id: &str, snapshot: Value) -> Result<()> {
        Uuid::parse_str(cloud_user_id).map_err(|_| "Cloud 사용자 ID 오류")?;
        let owner = self.owner()?;
        let tx = self.conn.transaction().map_err(sql_error)?;
        let imported: Option<String> = tx
            .query_row(
                "SELECT imported_at FROM local_identity WHERE singleton=1",
                [],
                |r| r.get(0),
            )
            .map_err(sql_error)?;
        if imported.is_some() {
            return Err(
                "이미 가져온 Workspace입니다. 자동 동기화는 아직 지원하지 않습니다.".into(),
            );
        }
        for table in TABLES {
            let count: i64 = tx
                .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
                .map_err(sql_error)?;
            if count > 0 {
                return Err(
                    "로컬 기록이 있습니다. 덮어쓰지 않기 위해 가져오기를 중단했습니다.".into(),
                );
            }
        }
        for table in TABLES {
            for row in snapshot[table].as_array().ok_or("가져오기 형식 오류")? {
                if text(row, "user_id")? != cloud_user_id {
                    return Err("다른 사용자 데이터는 가져올 수 없습니다.".into());
                }
                instant(text(row, "created_at")?)?;
                instant(text(row, "updated_at")?)?;
                Self::write(&tx, &owner, table, row, text(row, "id")?, false, true)?;
            }
        }
        if text(&snapshot["settings"], "user_id")? != cloud_user_id {
            return Err("설정 소유자 오류".into());
        }
        instant(text(&snapshot["settings"], "updated_at")?)?;
        Self::settings(&tx, &owner, &snapshot["settings"], true)?;
        tx.execute(
            "UPDATE local_identity SET cloud_user_id=?1,imported_at=?2 WHERE singleton=1",
            params![cloud_user_id, now()],
        )
        .map_err(sql_error)?;
        tx.commit().map_err(sql_error)
    }
    pub fn info(&self) -> Result<Value> {
        Ok(json_rows(
            &self.conn,
            "SELECT id,cloud_user_id,imported_at FROM local_identity",
            &[],
        )?
        .remove(0))
    }
}
