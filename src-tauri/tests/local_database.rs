use rusqlite::Connection;
use serde_json::{json, Value};
use tempfile::tempdir;
use timora_local::{Database, TABLES};
use uuid::Uuid;

const CLOUD: &str = "11111111-1111-4111-8111-111111111111";
const STAMP: &str = "2026-01-01T09:00:00+09:00";
fn input(table: &str, project: Option<&str>) -> Value {
    match table {
        "projects" => {
            json!({"name":"프로젝트","description":"설명","status":"active","color":"#6484ff"})
        }
        "tasks" => {
            json!({"title":"작업","description":"설명","status":"todo","priority":"high","start_date":"2026-02-28","due_date":"2026-03-01","project_id":project})
        }
        "notes" => {
            json!({"title":"노트","content":"# 한국어\n[[확장 예정]]\n- Markdown","project_id":project})
        }
        "events" => {
            json!({"title":"일정","description":"설명","start_at":"2026-01-01T23:00:00+09:00","end_at":"2026-01-02T01:00:00+09:00","project_id":project})
        }
        "library_items" => {
            json!({"title":"자료","description":"설명","url":"https://example.com/문서","type":"article","project_id":project})
        }
        "inbox_items" => json!({"content":"빠른 기록\n다음 줄","type":"unclassified"}),
        _ => unreachable!(),
    }
}
fn snapshot() -> Value {
    let mut result = json!({});
    let project = Uuid::new_v4().to_string();
    for table in TABLES {
        let mut row = input(table, Some(&project));
        row["id"] = json!(if table == "projects" {
            project.clone()
        } else {
            Uuid::new_v4().to_string()
        });
        row["user_id"] = json!(CLOUD);
        row["created_at"] = json!(STAMP);
        row["updated_at"] = json!(STAMP);
        result[table] = json!([row]);
    }
    result["settings"] = json!({"user_id":CLOUD,"workspace_name":"Cloud Workspace","appearance":"dark","display_name":"이름","avatar_url":null,"updated_at":STAMP});
    result
}

#[test]
fn all_entities_and_identity_persist_after_closing_the_real_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("timora.db");
    let (owner, saved);
    {
        let mut db = Database::open(&path).unwrap();
        owner = db.owner().unwrap();
        assert!(db.account().unwrap()["local"].as_bool().unwrap());
        let project = db.save("projects", input("projects", None), None).unwrap();
        for table in TABLES.into_iter().filter(|t| *t != "projects") {
            let mut value = input(table, project["id"].as_str());
            value["user_id"] = json!(CLOUD);
            let row = db.save(table, value.clone(), None).unwrap();
            assert_eq!(row["user_id"], owner); // A caller cannot replace local ownership.
            if table == "tasks" {
                value["status"] = json!("done");
            } else if table == "inbox_items" {
                value["content"] = json!("수정한 입력");
            } else {
                value["title"] = json!("수정한 제목");
            }
            let updated = db
                .save(table, value, Some(row["id"].as_str().unwrap().into()))
                .unwrap();
            assert_eq!(updated["id"], row["id"]);
            assert_eq!(updated["created_at"], row["created_at"]);
        }
        db.save_settings(json!({"workspace_name":"내 공간","appearance":"dark","display_name":"이름","avatar_url":null})).unwrap();
        saved = db.load().unwrap();
    }
    let mut reopened = Database::open(&path).unwrap();
    assert_eq!(reopened.owner().unwrap(), owner);
    assert_eq!(reopened.load().unwrap(), saved);
    for table in TABLES {
        reopened
            .remove(table, saved[table][0]["id"].as_str().unwrap())
            .unwrap();
    }
    drop(reopened);
    let db = Database::open(&path).unwrap();
    for table in TABLES {
        assert!(db.load().unwrap()[table].as_array().unwrap().is_empty());
    }
    assert_eq!(db.load().unwrap()["settings"]["workspace_name"], "내 공간");
}

#[test]
fn native_validation_and_foreign_keys_prevent_invalid_writes() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    let mut task = input("tasks", None);
    task["due_date"] = json!("2026-02-30");
    assert!(db.save("tasks", task.clone(), None).is_err());
    task["due_date"] = json!("2026-02-01");
    assert!(db.save("tasks", task, None).is_err());
    assert!(db.save("notes", input("notes", Some(CLOUD)), None).is_err());
    assert!(db
        .save("notes; DROP TABLE tasks", input("notes", None), None)
        .is_err());
    assert!(db.remove("tasks", CLOUD).is_err());
    assert!(db
        .save("tasks", input("tasks", None), Some(CLOUD.into()))
        .is_err());
    let mut event = input("events", None);
    event["end_at"] = event["start_at"].clone();
    assert!(db.save("events", event, None).is_err());
    let mut library = input("library_items", None);
    library["url"] = json!("javascript:alert(1)");
    assert!(db.save("library_items", library, None).is_err());
    assert!(db.save_settings(json!({"workspace_name":"x","appearance":"dark","display_name":"x","avatar_url":"http://example.com"})).is_err());
    for table in TABLES {
        assert!(db.load().unwrap()[table].as_array().unwrap().is_empty());
    }
}

#[test]
fn project_deletion_detaches_children_instead_of_losing_them() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    let project = db.save("projects", input("projects", None), None).unwrap();
    for table in ["tasks", "notes", "events", "library_items"] {
        db.save(table, input(table, project["id"].as_str()), None)
            .unwrap();
    }
    db.remove("projects", project["id"].as_str().unwrap())
        .unwrap();
    let data = db.load().unwrap();
    for table in ["tasks", "notes", "events", "library_items"] {
        assert_eq!(data[table].as_array().unwrap().len(), 1);
        assert!(data[table][0]["project_id"].is_null());
    }
}

#[test]
fn inbox_conversion_is_atomic_and_cannot_be_repeated() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    for target in ["task", "note"] {
        let inbox = db
            .save("inbox_items", input("inbox_items", None), None)
            .unwrap();
        let id = inbox["id"].as_str().unwrap();
        assert!(db.convert(id, "event").is_err()); // Source survives rejected conversion.
        assert_eq!(
            db.load().unwrap()["inbox_items"].as_array().unwrap().len(),
            1
        );
        db.convert(id, target).unwrap();
        assert!(db.convert(id, target).is_err());
    }
    let data = db.load().unwrap();
    assert!(data["inbox_items"].as_array().unwrap().is_empty());
    assert_eq!(data["tasks"][0]["description"], "빠른 기록\n다음 줄");
    assert_eq!(data["notes"][0]["content"], "빠른 기록\n다음 줄");
}

#[test]
fn import_preserves_ids_dates_relations_and_metadata_across_restart() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("db");
    let source = snapshot();
    let mut db = Database::open(&path).unwrap();
    let owner = db.owner().unwrap();
    db.import(CLOUD, source.clone()).unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap();
    let saved = db.load().unwrap();
    for table in TABLES {
        let original = &source[table][0];
        let local = &saved[table][0];
        for key in original
            .as_object()
            .unwrap()
            .keys()
            .filter(|k| k.as_str() != "user_id")
        {
            assert_eq!(local[key], original[key], "{table}.{key}");
        }
        assert_eq!(local["user_id"], owner);
        assert_eq!(local["sync_state"], "imported");
        assert_eq!(local["remote_updated_at"], STAMP);
    }
    assert_eq!(db.info().unwrap()["cloud_user_id"], CLOUD);
    assert_eq!(
        saved["settings"]["display_name"],
        source["settings"]["display_name"]
    );
    assert!(db.import(CLOUD, source.clone()).is_err());
    assert_eq!(db.load().unwrap(), saved);
    let id = saved["notes"][0]["id"].as_str().unwrap();
    let row = db
        .save("notes", input("notes", None), Some(id.into()))
        .unwrap();
    assert_eq!(row["sync_state"], "modified");
    db.remove("projects", saved["projects"][0]["id"].as_str().unwrap())
        .unwrap();
    assert_eq!(db.load().unwrap()["tasks"][0]["sync_state"], "modified");
    db.remove("notes", id).unwrap();
    drop(db);
    let conn = Connection::open(&path).unwrap();
    let count: i64 = conn
        .query_row("SELECT count(*) FROM tombstones", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 2);
    let db = Database::open(&path).unwrap();
    assert!(db.load().unwrap()["notes"].as_array().unwrap().is_empty());
}

#[test]
fn invalid_import_rolls_back_all_tables_settings_and_import_marker() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    let before = db.load().unwrap();
    for failure in ["owner", "relation", "duplicate", "settings", "date"] {
        let mut source = snapshot();
        match failure {
            "owner" => source["notes"][0]["user_id"] = json!(Uuid::new_v4().to_string()),
            "relation" => source["notes"][0]["project_id"] = json!(Uuid::new_v4().to_string()),
            "duplicate" => {
                let duplicate = source["notes"][0].clone();
                source["notes"].as_array_mut().unwrap().push(duplicate);
            }
            "settings" => source["settings"]["appearance"] = json!("invalid"),
            "date" => source["events"][0]["created_at"] = json!("invalid"),
            _ => unreachable!(),
        }
        assert!(db.import(CLOUD, source).is_err(), "{failure}");
        assert_eq!(db.load().unwrap(), before);
        assert!(db.info().unwrap()["imported_at"].is_null());
    }
    db.import(CLOUD, snapshot()).unwrap();
}

#[test]
fn import_never_overwrites_an_existing_local_workspace() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    db.save("notes", input("notes", None), None).unwrap();
    let before = db.load().unwrap();
    assert!(db.import(CLOUD, snapshot()).is_err());
    assert_eq!(db.load().unwrap(), before);
}

#[test]
fn future_versions_corruption_and_failed_migrations_are_never_reset() {
    let dir = tempdir().unwrap();
    let blocked = dir.path().join("blocked-directory");
    std::fs::write(&blocked, b"keep existing file").unwrap();
    assert!(Database::open(&blocked.join("timora.db")).is_err());
    assert_eq!(std::fs::read(&blocked).unwrap(), b"keep existing file");
    let path = dir.path().join("future.db");
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TABLE precious (content TEXT); INSERT INTO precious VALUES('keep'); PRAGMA user_version=99;").unwrap();
    drop(conn);
    assert!(Database::open(&path).is_err());
    let conn = Connection::open(&path).unwrap();
    assert_eq!(
        conn.query_row("SELECT content FROM precious", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "keep"
    );
    drop(conn);
    let corrupt = dir.path().join("corrupt.db");
    std::fs::write(&corrupt, b"broken database keep these bytes").unwrap();
    assert!(Database::open(&corrupt).is_err());
    assert_eq!(
        std::fs::read(&corrupt).unwrap(),
        b"broken database keep these bytes"
    );
    let conflict = dir.path().join("conflict.db");
    let conn = Connection::open(&conflict).unwrap();
    conn.execute_batch(
        "CREATE TABLE projects (content TEXT); INSERT INTO projects VALUES('keep');",
    )
    .unwrap();
    drop(conn);
    assert!(Database::open(&conflict).is_err());
    let conn = Connection::open(&conflict).unwrap();
    assert_eq!(
        conn.query_row("SELECT content FROM projects", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "keep"
    );
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert!(conn.prepare("SELECT * FROM local_identity").is_err()); // Entire migration rolled back.
}
