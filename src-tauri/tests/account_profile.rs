use image::{DynamicImage, ImageFormat};
use rusqlite::Connection;
use serde_json::json;
use std::io::Cursor;
use tempfile::tempdir;
use timora_local::{Database, AVATAR_INPUT_LIMIT};
const A: &str = "11111111-1111-4111-8111-111111111111";
const B: &str = "22222222-2222-4222-8222-222222222222";
const SERVER: &str = "https://test.supabase.co";
fn user(id: &str) -> serde_json::Value {
    json!({"id":id,"email":format!("{id}@example.com"),"user_metadata":{"display_name":"Cloud name"}})
}
fn legacy(path: &std::path::Path, imported: bool) -> String {
    let conn = Connection::open(path).unwrap();
    conn.execute_batch(include_str!("../migrations/001_initial_local_schema.sql"))
        .unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO local_identity(singleton,id,cloud_user_id) VALUES(1,?1,?2)",
        rusqlite::params![id, if imported { Some(A) } else { None }],
    )
    .unwrap();
    conn.execute("INSERT INTO workspace_settings VALUES(?1,'기존 공간','dark','기존 이름',NULL,'2026-01-01T00:00:00Z')", [&id]).unwrap();
    conn.execute("INSERT INTO notes(id,user_id,title,content,created_at,updated_at) VALUES(?1,?2,'기존 노트','[[keep]]','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",rusqlite::params![uuid::Uuid::new_v4().to_string(),id]).unwrap();
    conn.pragma_update(None, "user_version", 1).unwrap();
    id
}
#[test]
fn first_login_restart_logout_same_account_and_account_b_isolation() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("db");
    let mut db = Database::open(&path).unwrap();
    let owner = db.owner().unwrap();
    assert!(db.account().unwrap().is_null());
    assert!(db.load().is_err());
    assert!(db
        .save(
            "notes",
            json!({"title":"private","content":"A","project_id":null}),
            None
        )
        .is_err());
    db.bind_verified_account(&user(A), SERVER).unwrap();
    let note = db
        .save(
            "notes",
            json!({"title":"private","content":"A","project_id":null}),
            None,
        )
        .unwrap();
    let before = db.load().unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap(); // No server, network or tokens involved.
    assert_eq!(db.account().unwrap()["cloud_user_id"], A);
    assert_eq!(db.owner().unwrap(), owner);
    assert_eq!(db.load().unwrap(), before);
    db.sign_out().unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap();
    assert!(db.account().unwrap().is_null());
    assert!(db.load().is_err());
    assert!(db.remove("notes", note["id"].as_str().unwrap()).is_err());
    assert!(db
        .save_settings(
            json!({"workspace_name":"B","appearance":"light","display_name":"B","avatar_url":null})
        )
        .is_err());
    assert!(db.convert("x", "note").is_err());
    assert!(db.info().is_err());
    assert!(db.avatar_name().is_err());
    assert!(db.bind_verified_account(&user(B), SERVER).is_err());
    assert!(db.account().unwrap().is_null());
    assert!(db
        .bind_verified_account(&user(A), "https://another.supabase.co")
        .is_err());
    db.bind_verified_account(&user(A), SERVER).unwrap();
    assert_eq!(db.load().unwrap(), before);
    assert!(db.import(B, json!({})).unwrap_err().contains("연결한 계정"));
    let conn = Connection::open(path).unwrap();
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(local_identity)")
        .unwrap()
        .query_map([], |r| r.get(1))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    assert!(columns
        .iter()
        .all(|c| !c.contains("token") && !c.contains("password")));
}
#[test]
fn migration_preserves_uuid_entities_settings_and_legacy_import_binding() {
    for imported in [false, true] {
        let dir = tempdir().unwrap();
        let path = dir.path().join("db");
        let owner = legacy(&path, imported);
        let mut db = Database::open(&path).unwrap();
        assert_eq!(db.owner().unwrap(), owner);
        assert_eq!(db.account().unwrap()["local_only"], true);
        assert_eq!(db.load().unwrap()["notes"][0]["content"], "[[keep]]");
        let before = db.load().unwrap();
        if imported {
            assert!(db.bind_verified_account(&user(B), SERVER).is_err());
        }
        db.bind_verified_account(&user(A), SERVER).unwrap();
        assert_eq!(db.load().unwrap(), before);
        assert_eq!(
            Connection::open(path)
                .unwrap()
                .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            3
        );
    }
}
#[test]
fn failed_v2_migration_rolls_back_instead_of_resetting_any_data() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("db");
    let owner = legacy(&path, false);
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("ALTER TABLE local_identity ADD COLUMN email TEXT;")
        .unwrap();
    drop(conn);
    assert!(Database::open(&path).is_err());
    let conn = Connection::open(path).unwrap();
    assert_eq!(
        conn.query_row("SELECT id FROM local_identity", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        owner
    );
    assert_eq!(
        conn.query_row("SELECT content FROM notes", [], |r| r.get::<_, String>(0))
            .unwrap(),
        "[[keep]]"
    );
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert!(conn
        .prepare("SELECT access_state FROM local_identity")
        .is_err());
}
#[test]
fn private_avatar_survives_source_deletion_and_restart_and_rejects_bad_inputs() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("db");
    let profile = dir.path().join("profile");
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(900, 500)
        .write_to(&mut bytes, ImageFormat::Png)
        .unwrap();
    let source = dir.path().join("gallery.png");
    std::fs::write(&source, bytes.get_ref()).unwrap();
    let mut db = Database::open(&path).unwrap();
    db.bind_verified_account(&user(A), SERVER).unwrap();
    db.store_avatar(&profile, &std::fs::read(&source).unwrap())
        .unwrap();
    let name = db.avatar_name().unwrap();
    std::fs::remove_file(source).unwrap();
    drop(db);
    let mut db = Database::open(&path).unwrap();
    let photo = db.read_avatar(&profile).unwrap().unwrap();
    let image = image::load_from_memory(&photo).unwrap();
    assert_eq!(image.width(), 256);
    assert!(image.height() <= 256);
    assert_eq!(db.avatar_name().unwrap(), name);
    for input in [
        vec![],
        b"not an image".to_vec(),
        b"GIF89a".to_vec(),
        vec![0; AVATAR_INPUT_LIMIT as usize + 1],
    ] {
        assert!(db.store_avatar(&profile, &input).is_err());
        assert_eq!(db.read_avatar(&profile).unwrap().unwrap(), photo);
    }
    assert!(db.set_avatar_name(Some("../../precious.png")).is_err());
    db.sign_out().unwrap();
    assert!(db.read_avatar(&profile).is_err());
    assert!(db.remove_avatar(&profile).is_err());
    db.bind_verified_account(&user(A), SERVER).unwrap();
    assert_eq!(db.read_avatar(&profile).unwrap().unwrap(), photo);
    db.remove_avatar(&profile).unwrap();
    assert!(db.read_avatar(&profile).unwrap().is_none());
    assert_eq!(std::fs::read_dir(profile).unwrap().count(), 0);
}
