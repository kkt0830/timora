use serde_json::json;
use timora_local::Database;
#[test]
fn relations_reject_cycles_and_missing_endpoints_and_preserve_quotes() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("workspace.db");
    let mut db = Database::open(&path).unwrap();
    db.bind_verified_account(
        &json!({"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}),
        "https://test.supabase.co",
    )
    .unwrap();
    let a = db
        .save(
            "notes",
            json!({"title":"A","content":"","project_id":null}),
            None,
        )
        .unwrap();
    let b = db
        .save(
            "notes",
            json!({"title":"B","content":"","project_id":null}),
            None,
        )
        .unwrap();
    let edge = json!({"source_id":a["id"],"source_kind":"note","target_id":b["id"],"target_kind":"note","kind":"depends_on"});
    db.save("object_relations", edge.clone(), None).unwrap();
    assert!(db.save("object_relations", edge.clone(), None).is_err());
    let reverse = json!({"source_id":b["id"],"source_kind":"note","target_id":a["id"],"target_kind":"note","kind":"depends_on"});
    assert!(db.save("object_relations", reverse.clone(), None).is_err());
    let mut reference = reverse;
    reference["kind"] = json!("references");
    db.save("object_relations", reference, None).unwrap();
    let mut missing = edge;
    missing["target_id"] = json!("22222222-2222-4222-8222-222222222222");
    assert!(db.save("object_relations", missing, None).is_err());
    db.save(
        "user_quotes",
        json!({"content":"한 걸음","author":"나","favorite":1}),
        None,
    )
    .unwrap();
    db.remove("notes", a["id"].as_str().unwrap()).unwrap();
    assert!(db.load().unwrap()["object_relations"]
        .as_array()
        .unwrap()
        .is_empty());
    drop(db);
    let db = Database::open(&path).unwrap();
    assert_eq!(db.load().unwrap()["user_quotes"][0]["favorite"], 1);
    assert_eq!(db.load().unwrap()["notes"].as_array().unwrap().len(), 1);
}
