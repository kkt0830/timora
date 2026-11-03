use serde_json::json;
use timora_local::Database;
#[test]
fn deterministic_bounded_generation_preserves_completed_history() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("workspace.db");
    let mut db = Database::open(&path).unwrap();
    db.bind_verified_account(
        &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
        "https://test.supabase.co",
    )
    .unwrap();
    let mut rule=db.save("task_recurrences",json!({"title":"Monthly","description":"","frequency":"monthly","interval_days":1,"start_date":"2026-01-31","end_date":null,"occurrence_limit":3,"weekdays":"","timezone":"Asia/Seoul","status":"active","reminder_time":null,"category":"","priority":"medium","project_id":null}),None).unwrap();
    let id = rule["id"].as_str().unwrap().to_string();
    let revision = rule["updated_at"].as_str().unwrap().to_string();
    assert!(db
        .generate_tasks(&id, &revision, vec!["2026-02-28".into()])
        .is_err());
    assert!(db.load().unwrap()["tasks"].as_array().unwrap().is_empty());
    db.generate_tasks(
        &id,
        &revision,
        vec!["2026-01-31".into(), "2026-03-31".into()],
    )
    .unwrap();
    db.generate_tasks(&id, &revision, vec!["2026-01-31".into()])
        .unwrap();
    assert_eq!(db.load().unwrap()["tasks"].as_array().unwrap().len(), 2);
    let mut task = db.load().unwrap()["tasks"][0].clone();
    let task_id = task["id"].as_str().unwrap().to_string();
    task["status"] = json!("done");
    db.save("tasks", task, Some(task_id.clone())).unwrap();
    rule["status"] = json!("paused");
    db.save("task_recurrences", rule.clone(), Some(id.clone()))
        .unwrap();
    assert!(db
        .generate_tasks(&id, &revision, vec!["2026-05-31".into()])
        .is_err());
    assert!(db.remove("task_recurrences", &id).is_err());
    assert!(db.remove("tasks", &task_id).is_err());
    rule["status"] = json!("archived");
    db.save("task_recurrences", rule, Some(id)).unwrap();
    drop(db);
    let db = Database::open(&path).unwrap();
    assert_eq!(
        db.load().unwrap()["task_occurrences"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        db.load().unwrap()["tasks"]
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["id"] == task_id)
            .unwrap()["status"],
        "done"
    );
}
