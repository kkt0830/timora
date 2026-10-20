use serde_json::{json, Value};
use tempfile::tempdir;
use timora_local::Database;
const A: &str = "11111111-1111-4111-8111-111111111111";
const B: &str = "22222222-2222-4222-8222-222222222222";
fn bind(db: &mut Database) {
    db.bind_verified_account(
        &json!({"id":A,"email":"test@example.com"}),
        "https://test.supabase.co",
    )
    .unwrap();
    // First pull observes that Cloud has no settings before creating defaults.
    db.sync_page(
        A,
        "0",
        json!({"cursor":"0","records":[],"dependencies":[],"has_more":false}),
    )
    .unwrap();
    let op = db.sync_next(A).unwrap();
    let record = remote("workspace_settings", A, "1", op["payload"].clone());
    db.sync_ack(
        A,
        op["operation_id"].as_str().unwrap(),
        json!({"status":"applied","record":record}),
    )
    .unwrap();
}
fn note(content: &str) -> Value {
    json!({"title":"Note","content":content,"project_id":null})
}
fn remote(table: &str, id: &str, rev: &str, mut payload: Value) -> Value {
    if !payload.is_null() {
        payload["user_id"] = json!(A);
        payload["created_at"] = json!("2026-01-01T00:00:00Z");
        payload["updated_at"] = json!(format!(
            "2026-01-01T00:00:{:02}Z",
            rev.parse::<u64>().unwrap() % 60
        ));
    }
    json!({"user_id":A,"entity_table":table,"id":id,"revision":rev,"deleted":payload.is_null(),"payload":payload})
}
fn ack(db: &mut Database, op: &Value, rev: &str) {
    let r = remote(
        op["entity_table"].as_str().unwrap(),
        op["id"].as_str().unwrap(),
        rev,
        op["payload"].clone(),
    );
    db.sync_ack(
        A,
        op["operation_id"].as_str().unwrap(),
        json!({"status":"applied","record":r}),
    )
    .unwrap();
}
#[test]
fn queue_survives_restart_rolls_back_invalid_writes_and_rebases_later_edits() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("db");
    let mut db = Database::open(&path).unwrap();
    bind(&mut db);
    let row = db.save("notes", note("first"), None).unwrap();
    let id = row["id"].as_str().unwrap();
    let first = db.sync_next(A).unwrap();
    assert!(db.save("notes", json!({"title":""}), None).is_err());
    db.save("notes", note("second"), Some(id.into())).unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap();
    assert_eq!(db.sync_next(A).unwrap(), first);
    ack(&mut db, &first, "2");
    assert_eq!(db.load().unwrap()["notes"][0]["content"], "second");
    let second = db.sync_next(A).unwrap();
    assert_eq!(second["base_revision"], "2");
    ack(&mut db, &second, "3");
    assert_eq!(db.sync_status().unwrap()["pending"], 0);
    assert!(db.sync_next(B).is_err());
    db.sign_out().unwrap();
    assert!(db.sync_status().is_err());
}
#[test]
fn incoming_changes_do_not_echo_and_conflicts_preserve_local_until_explicit_choice() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    bind(&mut db);
    let id = uuid::Uuid::new_v4().to_string();
    let r = remote("notes", &id, "2", note("cloud"));
    let page = json!({"cursor":"2","dependencies":[],"records":[r]});
    assert!(db.sync_page(A, "0", page.clone()).unwrap());
    assert!(!db.sync_page(A, "0", page).unwrap());
    assert_eq!(db.sync_status().unwrap()["pending"], 0);
    db.save("notes", note("offline"), Some(id.clone())).unwrap();
    let r = remote("notes", &id, "3", note("other device"));
    db.sync_page(
        A,
        "2",
        json!({"cursor":"3","dependencies":[],"records":[r]}),
    )
    .unwrap();
    assert_eq!(db.load().unwrap()["notes"][0]["content"], "offline");
    assert_eq!(db.sync_status().unwrap()["conflict_count"], 1);
    assert!(db.sync_next(A).unwrap().is_null());
    db.sync_resolve(A, "notes", &id, "local").unwrap();
    let op = db.sync_next(A).unwrap();
    assert_eq!(op["base_revision"], "3");
    assert_eq!(op["payload"]["content"], "offline");
    ack(&mut db, &op, "4");
    let deleted = remote("notes", &id, "5", Value::Null);
    db.sync_page(
        A,
        "3",
        json!({"cursor":"5","dependencies":[],"records":[deleted]}),
    )
    .unwrap();
    assert_eq!(db.load().unwrap()["notes"].as_array().unwrap().len(), 0);
    assert_eq!(db.sync_status().unwrap()["pending"], 0);
}
#[test]
fn foreign_owner_or_invalid_page_rolls_back_cursor_and_all_records() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    bind(&mut db);
    let id = uuid::Uuid::new_v4().to_string();
    let r = remote("notes", &id, "2", note("valid"));
    let mut bad = r.clone();
    bad["user_id"] = json!(B);
    assert!(db
        .sync_page(
            A,
            "0",
            json!({"cursor":"3","dependencies":[],"records":[r,bad]})
        )
        .is_err());
    assert_eq!(db.sync_status().unwrap()["cursor"], "0");
    assert!(db.load().unwrap()["notes"].as_array().unwrap().is_empty());
    db.save("notes", note("still queues"), None).unwrap();
    assert_eq!(db.sync_status().unwrap()["pending"], 1);
}
#[test]
fn project_delete_conflict_keeps_pending_child_and_cloud_choice_detaches_it() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    bind(&mut db);
    let id = uuid::Uuid::new_v4().to_string();
    let project = remote(
        "projects",
        &id,
        "2",
        json!({"name":"P","description":"","status":"active","color":"#6b77dc"}),
    );
    db.sync_page(
        A,
        "0",
        json!({"cursor":"2","dependencies":[],"records":[project]}),
    )
    .unwrap();
    let mut input = note("offline child");
    input["project_id"] = json!(id);
    db.save("notes", input, None).unwrap();
    db.sync_page(
        A,
        "2",
        json!({"cursor":"3","dependencies":[],"records":[remote("projects",&id,"3",Value::Null)]}),
    )
    .unwrap();
    assert_eq!(db.sync_status().unwrap()["conflict_count"], 1);
    assert!(db.sync_next(A).unwrap().is_null());
    db.sync_resolve(A, "projects", &id, "cloud").unwrap();
    assert!(db.load().unwrap()["notes"][0]["project_id"].is_null());
    assert!(db.sync_next(A).unwrap()["payload"]["project_id"].is_null());
}

#[test]
fn failed_deliveries_survive_restart_block_only_dependencies_and_retry_latest_intent() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("db");
    let mut db = Database::open(&path).unwrap();
    bind(&mut db);
    let lib = db.save("library_items",json!({"title":"Original","url":"https://example.com/a b","type":"website","description":"","project_id":null}),None).unwrap();
    assert_eq!(lib["url"], "https://example.com/a%20b");
    let bad = db.sync_next(A).unwrap();
    db.sync_fail(
        A,
        bad["operation_id"].as_str().unwrap(),
        "constraint fixture (23514)",
    )
    .unwrap();
    db.save("library_items",json!({"title":"Latest","url":"https://example.com/c d","type":"website","description":"","project_id":null}),Some(lib["id"].as_str().unwrap().into())).unwrap();
    let independent = db.save("notes", note("independent"), None).unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap();
    assert_eq!(db.sync_status().unwrap()["failed_count"], 1);
    let next = db.sync_next(A).unwrap();
    assert_eq!(next["id"], independent["id"]);
    ack(&mut db, &next, "2");
    assert!(db.sync_next(A).unwrap().is_null());
    assert!(db
        .sync_retry(B, bad["operation_id"].as_str().unwrap())
        .is_err());
    db.sync_retry(A, bad["operation_id"].as_str().unwrap())
        .unwrap();
    let retry = db.sync_next(A).unwrap();
    assert_ne!(retry["operation_id"], bad["operation_id"]);
    assert_eq!(retry["payload"]["title"], "Latest");
    assert_eq!(retry["payload"]["url"], "https://example.com/c%20d");
    ack(&mut db, &retry, "3");
    assert_eq!(db.sync_status().unwrap()["pending"], 0);
}

#[test]
fn failed_project_holds_children_while_unrelated_items_can_send() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    bind(&mut db);
    let project = db
        .save(
            "projects",
            json!({"name":"P","description":"","status":"active","color":"#123456"}),
            None,
        )
        .unwrap();
    let op = db.sync_next(A).unwrap();
    db.sync_fail(A, op["operation_id"].as_str().unwrap(), "fixture")
        .unwrap();
    let mut child = note("child");
    child["project_id"] = project["id"].clone();
    db.save("notes", child, None).unwrap();
    let free = db.save("notes", note("free"), None).unwrap();
    let next = db.sync_next(A).unwrap();
    assert_eq!(next["id"], free["id"]);
    ack(&mut db, &next, "2");
    assert!(db.sync_next(A).unwrap().is_null());
}

#[test]
fn fresh_defaults_pull_cloud_settings_but_real_offline_preferences_still_conflict() {
    let dir = tempdir().unwrap();
    let mut db = Database::open(&dir.path().join("db")).unwrap();
    db.bind_verified_account(
        &json!({"id":A,"email":"a@example.com","user_metadata":{"display_name":"Auth nickname"}}),
        "https://test.supabase.co",
    )
    .unwrap();
    assert!(db.sync_next(A).unwrap().is_null());
    let mut settings = db.load().unwrap()["settings"].clone();
    settings["workspace_name"] = json!("Cloud workspace");
    settings["appearance"] = json!("dark");
    let record = remote("workspace_settings", A, "1", settings);
    db.sync_page(
        A,
        "0",
        json!({"cursor":"1","dependencies":[],"records":[record],"has_more":false}),
    )
    .unwrap();
    assert_eq!(
        db.load().unwrap()["settings"]["workspace_name"],
        "Cloud workspace"
    );
    assert_eq!(db.sync_status().unwrap()["pending"], 0);
    assert_eq!(db.sync_status().unwrap()["conflict_count"], 0);
    let mut local = db.load().unwrap()["settings"].clone();
    local["workspace_name"] = json!("Offline edit");
    db.save_settings(local).unwrap();
    let mut cloud = db.load().unwrap()["settings"].clone();
    cloud["workspace_name"] = json!("Other device");
    db.sync_page(A,"1",json!({"cursor":"2","dependencies":[],"records":[remote("workspace_settings",A,"2",cloud)],"has_more":false})).unwrap();
    assert_eq!(db.sync_status().unwrap()["conflict_count"], 1);
    assert_eq!(
        db.load().unwrap()["settings"]["workspace_name"],
        "Offline edit"
    );
}

#[test]
fn v3_upgrade_preserves_delivery_ids_and_user_preferences() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("v3.db");
    let conn = rusqlite::Connection::open(&path).unwrap();
    conn.execute_batch(include_str!("../migrations/001_initial_local_schema.sql"))
        .unwrap();
    conn.execute_batch(include_str!("../migrations/002_local_account_profile.sql"))
        .unwrap();
    conn.execute("INSERT INTO local_identity(singleton,id,access_state,created_at,cloud_user_id,cloud_project_url,email) VALUES(1,?1,'signed_in','2026-01-01T00:00:00Z',?1,'https://test.supabase.co','a@example.com')",[A]).unwrap();
    conn.execute("INSERT INTO workspace_settings VALUES(?1,'Offline custom','dark','Keep',NULL,'2026-01-01T00:00:00Z')",[A]).unwrap();
    conn.execute_batch(include_str!("../migrations/003_durable_sync.sql"))
        .unwrap();
    conn.pragma_update(None, "user_version", 3).unwrap();
    let old: String = conn
        .query_row("SELECT operation_id FROM native_sync_outbox", [], |r| {
            r.get(0)
        })
        .unwrap();
    drop(conn);
    let db = Database::open(&path).unwrap();
    assert_eq!(db.sync_next(A).unwrap()["operation_id"], old);
    assert_eq!(
        db.load().unwrap()["settings"]["workspace_name"],
        "Offline custom"
    );
}
