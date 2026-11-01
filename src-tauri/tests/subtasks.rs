use rusqlite::{params, Connection};
use serde_json::{json, Value};
use tempfile::tempdir;
use timora_local::{Database, SCHEMA_VERSION};
const CLOUD: &str = "11111111-1111-4111-8111-111111111111";
fn open(path: &std::path::Path) -> Database {
    let mut db = Database::open(path).unwrap();
    db.bind_verified_account(
        &json!({"id":CLOUD,"email":"fixture@example.com"}),
        "https://test.supabase.co",
    )
    .unwrap();
    db
}
fn task(db: &mut Database) -> Value {
    db.save("tasks",json!({"title":"parent","description":"","status":"todo","priority":"medium","start_date":null,"due_date":null,"project_id":null}),None).unwrap()
}
fn child(db: &mut Database, parent: &Value, title: &str, position: i64) -> Value {
    db.save(
        "subtasks",
        json!({"task_id":parent["id"],"title":title,"status":"todo","position":position}),
        None,
    )
    .unwrap()
}
#[test]
fn subtask_crud_reorder_restart_and_parent_completion_are_independent() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("test.db");
    let mut db = open(&path);
    let parent = task(&mut db);
    let a = child(&mut db, &parent, "첫째", 0);
    let b = child(&mut db, &parent, "둘째", 1);
    let mut edit = a.clone();
    edit["title"] = json!("수정");
    edit["status"] = json!("done");
    db.save("subtasks", edit, Some(a["id"].as_str().unwrap().into()))
        .unwrap();
    db.reorder_subtasks(
        parent["id"].as_str().unwrap(),
        vec![
            b["id"].as_str().unwrap().into(),
            a["id"].as_str().unwrap().into(),
        ],
    )
    .unwrap();
    assert!(db
        .reorder_subtasks(
            parent["id"].as_str().unwrap(),
            vec![a["id"].as_str().unwrap().into()]
        )
        .is_err());
    drop(db);
    let mut db = open(&path);
    let data = db.load().unwrap();
    assert_eq!(data["tasks"][0]["status"], "todo");
    let rows = data["subtasks"].as_array().unwrap();
    assert_eq!(
        rows.iter().find(|r| r["id"] == a["id"]).unwrap()["position"],
        1
    );
    assert_eq!(
        rows.iter().find(|r| r["id"] == b["id"]).unwrap()["position"],
        0
    );
    assert!(db.sync_status().unwrap()["pending"].as_i64().unwrap() > 0);
    db.remove("tasks", parent["id"].as_str().unwrap()).unwrap();
    assert_eq!(db.load().unwrap()["subtasks"], json!([]));
    let conn = Connection::open(path).unwrap();
    let deletes:i64=conn.query_row("SELECT count(*) FROM native_sync_outbox WHERE entity_table='subtasks' AND action='delete'",[],|r|r.get(0)).unwrap();
    assert_eq!(deletes, 2);
}
#[test]
fn invalid_subtasks_and_cross_owner_parent_are_rejected_without_queue_changes() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("test.db");
    let mut db = open(&path);
    let parent = task(&mut db);
    let pending = db.sync_status().unwrap()["pending"].clone();
    for bad in [
        json!({"task_id":parent["id"],"title":" ","status":"todo","position":0}),
        json!({"task_id":parent["id"],"title":"x","status":"done","position":-1}),
        json!({"task_id":parent["id"],"title":"x","status":"todo","position":0.5}),
        json!({"task_id":"22222222-2222-4222-8222-222222222222","title":"x","status":"todo","position":0}),
    ] {
        assert!(db.save("subtasks", bad, None).is_err());
    }
    assert_eq!(db.sync_status().unwrap()["pending"], pending);
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("PRAGMA foreign_keys=ON").unwrap();
    assert!(conn.execute("INSERT INTO subtasks(id,user_id,task_id,title,status,position,created_at,updated_at) VALUES('x','other',?1,'x','todo',0,'now','now')",[parent["id"].as_str().unwrap()]).is_err());
    db.sign_out().unwrap();
    assert!(db
        .reorder_subtasks(parent["id"].as_str().unwrap(), vec![])
        .is_err());
    assert!(db.load().is_err());
}
fn legacy(path: &std::path::Path) -> Connection {
    let conn = Connection::open(path).unwrap();
    for sql in [
        include_str!("../migrations/001_initial_local_schema.sql"),
        include_str!("../migrations/002_local_account_profile.sql"),
        include_str!("../migrations/003_durable_sync.sql"),
        include_str!("../migrations/004_sync_recovery.sql"),
    ] {
        conn.execute_batch(sql).unwrap();
    }
    conn.execute("INSERT INTO local_identity(singleton,id,access_state,cloud_user_id,local_avatar) VALUES(1,?1,'local_only',?2,'33333333-3333-4333-8333-333333333333.png')",params!["22222222-2222-4222-8222-222222222222",CLOUD]).unwrap();
    conn.execute("INSERT INTO workspace_settings VALUES(?1,'keep','dark','name',NULL,'2026-01-01T00:00:00Z')",["22222222-2222-4222-8222-222222222222"]).unwrap();
    conn.execute_batch("UPDATE native_sync_outbox SET attempts=2,last_error='keep failure',failed_at='2026-01-01T00:00:00Z'; INSERT INTO native_sync_conflicts VALUES('notes','keep','{}'); INSERT INTO tombstones VALUES('notes','deleted','2026-01-01T00:00:00Z','keep'); PRAGMA user_version=4;").unwrap();
    conn
}
#[test]
fn v4_upgrade_preserves_identity_failures_operation_ids_conflicts_and_tombstones() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("test.db");
    let conn = legacy(&path);
    let before:String=conn.query_row("SELECT json_group_array(json_object('op',operation_id,'payload',payload,'error',last_error,'attempts',attempts)) FROM native_sync_outbox",[],|r|r.get(0)).unwrap();
    drop(conn);
    let db = Database::open(&path).unwrap();
    assert_eq!(db.owner().unwrap(), "22222222-2222-4222-8222-222222222222");
    drop(db);
    let conn = Connection::open(path).unwrap();
    let after:String=conn.query_row("SELECT json_group_array(json_object('op',operation_id,'payload',payload,'error',last_error,'attempts',attempts)) FROM native_sync_outbox",[],|r|r.get(0)).unwrap();
    assert_eq!(before, after);
    assert_eq!(
        conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        SCHEMA_VERSION
    );
    assert_eq!(
        conn.query_row("SELECT count(*) FROM native_sync_conflicts", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row("SELECT count(*) FROM tombstones", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row("SELECT local_avatar FROM local_identity", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "33333333-3333-4333-8333-333333333333.png"
    );
}
#[test]
fn failed_v5_migration_rolls_back_and_preserves_original_schema() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("test.db");
    let conn = legacy(&path);
    conn.execute_batch(
        "CREATE TABLE subtasks(precious TEXT); INSERT INTO subtasks VALUES('keep');",
    )
    .unwrap();
    drop(conn);
    assert!(Database::open(&path).is_err());
    let conn = Connection::open(path).unwrap();
    assert_eq!(
        conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        4
    );
    assert_eq!(
        conn.query_row("SELECT precious FROM subtasks", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "keep"
    );
    assert_eq!(
        conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE name='tasks_id_owner'",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        0
    );
}
