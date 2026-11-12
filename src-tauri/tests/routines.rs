use serde_json::json;
use timora_local::Database;
#[test]
fn routine_completion_identity_restart_undo_and_archive_preserve_history() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("workspace.db");
    let mut db = Database::open(&path).unwrap();
    db.bind_verified_account(
        &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
        "https://fixture.supabase.co",
    )
    .unwrap();
    let routine=db.save("routines",json!({"title":"습관","description":"","frequency":"daily","interval_days":1,"start_date":"2026-01-01","end_date":null,"occurrence_limit":null,"weekdays":"","timezone":"Asia/Seoul","status":"active","reminder_time":null,"category":""}),None).unwrap();
    let completed = json!({"routine_id":routine["id"],"local_date":"2026-11-01","status":"done"});
    let first = db
        .save("routine_completions", completed.clone(), None)
        .unwrap();
    let second = db.save("routine_completions", completed, None).unwrap();
    assert_eq!(first["id"], second["id"]);
    assert!(db
        .save(
            "routine_completions",
            json!({"routine_id":routine["id"],"local_date":"2026-02-30","status":"done"}),
            None
        )
        .is_err());
    let mut archived = routine.clone();
    archived["status"] = json!("archived");
    db.save(
        "routines",
        archived,
        Some(routine["id"].as_str().unwrap().into()),
    )
    .unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap();
    assert_eq!(
        db.load().unwrap()["routine_completions"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(db.load().unwrap()["routines"][0]["status"], "archived");
    assert!(db
        .remove("routines", routine["id"].as_str().unwrap())
        .is_err());
    db.save(
        "routine_completions",
        json!({"routine_id":routine["id"],"local_date":"2026-11-01","status":"todo"}),
        None,
    )
    .unwrap();
    assert_eq!(
        db.load().unwrap()["routine_completions"][0]["status"],
        "todo"
    );
}
