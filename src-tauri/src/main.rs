#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tauri::Manager;
use timora_local::Database;
struct LocalState {
    db: Mutex<Option<Database>>,
    path: std::path::PathBuf,
}
fn locked_db<T>(
    state: &LocalState,
    f: impl FnOnce(&mut Database) -> Result<T, String>,
) -> Result<T, String> {
    let mut guard = state.db.lock().map_err(|_| "Local DB 잠금 오류")?;
    if guard.is_none() {
        *guard = Some(Database::open(&state.path)?);
    }
    f(guard.as_mut().ok_or("Local DB 열기 실패")?)
}
// File IO, migration and busy waits must not block the native window event loop.
async fn with_db<T: Send + 'static>(
    state: tauri::State<'_, Arc<LocalState>>,
    f: impl FnOnce(&mut Database) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let state = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || locked_db(&state, f))
        .await
        .map_err(|_| "Local DB 작업 오류. 데이터를 보존하고 다시 시도해 주세요.".to_string())?
}
#[tauri::command]
async fn local_account(state: tauri::State<'_, Arc<LocalState>>) -> Result<Value, String> {
    with_db(state, move |db| db.account()).await
}
#[tauri::command]
async fn local_load(state: tauri::State<'_, Arc<LocalState>>) -> Result<Value, String> {
    with_db(state, move |db| db.load()).await
}
#[tauri::command]
async fn local_save(
    state: tauri::State<'_, Arc<LocalState>>,
    table: String,
    input: Value,
    id: Option<String>,
) -> Result<Value, String> {
    with_db(state, move |db| db.save(&table, input, id)).await
}
#[tauri::command]
async fn local_remove(
    state: tauri::State<'_, Arc<LocalState>>,
    table: String,
    id: String,
) -> Result<(), String> {
    with_db(state, move |db| db.remove(&table, &id)).await
}
#[tauri::command]
async fn local_convert(
    state: tauri::State<'_, Arc<LocalState>>,
    id: String,
    target: String,
) -> Result<(), String> {
    with_db(state, move |db| db.convert(&id, &target)).await
}
#[tauri::command]
async fn local_settings(
    state: tauri::State<'_, Arc<LocalState>>,
    input: Value,
) -> Result<Value, String> {
    with_db(state, move |db| db.save_settings(input)).await
}
#[tauri::command]
async fn local_import(
    state: tauri::State<'_, Arc<LocalState>>,
    cloud_user_id: String,
    snapshot: Value,
) -> Result<(), String> {
    with_db(state, move |db| db.import(&cloud_user_id, snapshot)).await
}
#[tauri::command]
async fn local_info(state: tauri::State<'_, Arc<LocalState>>) -> Result<Value, String> {
    let path = state.path.clone();
    with_db(state, move |db| {
        let mut info = db.info()?;
        info["path"] = json!(path);
        Ok(info)
    })
    .await
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            // Opening is lazy through commands: migration failures reach the error UI, never reset data.
            app.manage(Arc::new(LocalState {
                db: Mutex::new(None),
                path: dir.join("timora.db"),
            }));
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
