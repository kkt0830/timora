#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::Manager;
use timora_local::Database;
struct LocalState {
    db: Mutex<Option<Database>>,
    path: std::path::PathBuf,
}
fn with_db<T>(
    state: &LocalState,
    f: impl FnOnce(&mut Database) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state.db.lock().map_err(|_| "Local DB 잠금 오류")?;
    if guard.is_none() {
        *guard = Some(Database::open(&state.path)?);
    }
    f(guard.as_mut().ok_or("Local DB 열기 실패")?)
}
#[tauri::command]
fn local_account(state: tauri::State<LocalState>) -> Result<Value, String> {
    with_db(&state, |db| db.account())
}
#[tauri::command]
fn local_load(state: tauri::State<LocalState>) -> Result<Value, String> {
    with_db(&state, |db| db.load())
}
#[tauri::command]
fn local_save(
    state: tauri::State<LocalState>,
    table: String,
    input: Value,
    id: Option<String>,
) -> Result<Value, String> {
    with_db(&state, |db| db.save(&table, input, id))
}
#[tauri::command]
fn local_remove(state: tauri::State<LocalState>, table: String, id: String) -> Result<(), String> {
    with_db(&state, |db| db.remove(&table, &id))
}
#[tauri::command]
fn local_convert(
    state: tauri::State<LocalState>,
    id: String,
    target: String,
) -> Result<(), String> {
    with_db(&state, |db| db.convert(&id, &target))
}
#[tauri::command]
fn local_settings(state: tauri::State<LocalState>, input: Value) -> Result<Value, String> {
    with_db(&state, |db| db.save_settings(input))
}
#[tauri::command]
fn local_import(
    state: tauri::State<LocalState>,
    cloud_user_id: String,
    snapshot: Value,
) -> Result<(), String> {
    with_db(&state, |db| db.import(&cloud_user_id, snapshot))
}
#[tauri::command]
fn local_info(state: tauri::State<LocalState>) -> Result<Value, String> {
    with_db(&state, |db| {
        let mut info = db.info()?;
        info["path"] = json!(state.path);
        Ok(info)
    })
}
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            // Opening is lazy through commands: migration failures reach the error UI, never reset data.
            app.manage(LocalState {
                db: Mutex::new(None),
                path: dir.join("timora.db"),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            local_account,
            local_load,
            local_save,
            local_remove,
            local_convert,
            local_settings,
            local_import,
            local_info
        ])
        .run(tauri::generate_context!())
        .expect("Timora Desktop runtime could not start");
}
