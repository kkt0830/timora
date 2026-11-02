use serde_json::json;
use timora_local::Database;
#[test]
fn workspace_tools_survive_restart_and_enforce_parent_integrity() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("workspace.db");
    let mut db = Database::open(&path).unwrap();
    db.bind_verified_account(
        &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
        "https://test.supabase.co",
    )
    .unwrap();
    let note = db
        .save(
            "notes",
            json!({"title":"N","content":"source","project_id":null}),
            None,
        )
        .unwrap();
    let tag = db
        .save("tags", json!({"name":"개발","color":"#5271ff"}), None)
        .unwrap();
    let link = json!({"note_id":note["id"],"tag_id":tag["id"]});
    let a = db.save("note_tags", link.clone(), None).unwrap();
    let b = db.save("note_tags", link, None).unwrap();
    assert_eq!(a["id"], b["id"]);
    db.save(
        "note_templates",
        json!({"title":"회의","content":"# 안건\n"}),
        None,
    )
    .unwrap();
    let project = db
        .save(
            "projects",
            json!({"name":"P","description":"","status":"active","color":"#5271ff"}),
            None,
        )
        .unwrap();
    let task=db.save("tasks",json!({"title":"T","description":"","status":"todo","priority":"medium","start_date":null,"due_date":null,"project_id":project["id"]}),None).unwrap();
    let block = json!({"task_id":task["id"],"start_at":"2026-11-02T10:00:00+09:00","end_at":"2026-11-02T11:00:00+09:00"});
    db.save("task_blocks", block.clone(), None).unwrap();
    let mut invalid = block.clone();
    invalid["end_at"] = json!("2026-11-02T00:00:00Z");
    assert!(db.save("task_blocks", invalid, None).is_err());
    db.reorder_board(
        project["id"].as_str().unwrap(),
        vec![task["id"].as_str().unwrap().into()],
    )
    .unwrap();
    let before = db.load().unwrap();
    assert!(db
        .reorder_board(project["id"].as_str().unwrap(), vec![])
        .is_err());
    assert_eq!(db.load().unwrap(), before);
    assert!(db
        .save(
            "note_tags",
            json!({"note_id":"22222222-2222-4222-8222-222222222222","tag_id":tag["id"]}),
            None
        )
        .is_err());
    drop(db);
    let mut db = Database::open(&path).unwrap();
    assert_eq!(db.load().unwrap()["note_tags"].as_array().unwrap().len(), 1);
    assert_eq!(db.load().unwrap()["board_positions"][0]["position"], 0);
    db.remove("tags", tag["id"].as_str().unwrap()).unwrap();
    assert!(db.load().unwrap()["note_tags"]
        .as_array()
        .unwrap()
        .is_empty());
    assert_eq!(db.load().unwrap()["notes"][0]["content"], "source");
    db.remove("tasks", task["id"].as_str().unwrap()).unwrap();
    for table in ["task_blocks", "board_positions"] {
        assert!(db.load().unwrap()[table].as_array().unwrap().is_empty());
    }
}
