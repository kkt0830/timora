//! Isolated integration test IPC adapter. Never bundled into the native application.
use serde_json::{json, Value};
use std::io::{self, BufRead};
use timora_local::Database;
fn main() {
    let args: Vec<_> = std::env::args().collect();
    let mut db = Database::open(std::path::Path::new(&args[1])).unwrap();
    db.bind_verified_account(
        &json!({"id":args[2],"email":"isolated@example.com"}),
        "https://sync-fixture.supabase.co",
    )
    .unwrap();
    for line in io::stdin().lock().lines() {
        let request: Value = serde_json::from_str(&line.unwrap()).unwrap();
        let a = &request["args"];
        let s = |key: &str| a[key].as_str().unwrap();
        let result: Result<Value, String> = match request["command"].as_str().unwrap() {
            "local_sync_status" => db.sync_status(),
            "local_sync_next" => db.sync_next(s("cloudUserId")),
            "local_sync_ack" => db
                .sync_ack(s("cloudUserId"), s("operationId"), a["response"].clone())
                .map(|_| Value::Null),
            "local_sync_page" => db
                .sync_page(s("cloudUserId"), s("after"), a["page"].clone())
                .map(Value::Bool),
            "local_sync_resolve" => db
                .sync_resolve(s("cloudUserId"), s("table"), s("id"), s("choice"))
                .map(|_| Value::Null),
            "local_save" => db.save(
                s("table"),
                a["input"].clone(),
                a["id"].as_str().map(str::to_string),
            ),
            "local_remove" => db.remove(s("table"), s("id")).map(|_| Value::Null),
            "local_load" => db.load(),
            _ => Err("Unknown isolated test command".into()),
        };
        println!(
            "{}",
            match result {
                Ok(v) => json!({"result":v}),
                Err(e) => json!({"error":e}),
            }
        );
    }
}
