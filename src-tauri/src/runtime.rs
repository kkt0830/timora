use crate::Database;
use base64::Engine;
use serde_json::{json, Value};
use std::io::Read;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;
struct LocalState {
    db: Mutex<Option<Database>>,
    path: std::path::PathBuf,
    auth_epoch: AtomicU64,
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
async fn local_sign_out(app: tauri::AppHandle, state: tauri::State<'_, Arc<LocalState>>) -> Result<(), String> {
    state.auth_epoch.fetch_add(1, Ordering::SeqCst);
    with_db(state, move |db| {
        let context=vault_context(db).ok();
        db.sign_out()?;
        // A durable local lock wins even if an OS credential store cannot be reached.
        if let Some((user,project))=context { let _=crate::session_vault::clear(&app,&user,&project); }
        Ok(())
    }).await
}
fn vault_context(db: &Database) -> Result<(String,String),String> {
    db.require_workspace()?;
    let identity=db.identity()?;
    if identity["access_state"]!="signed_in" {return Err("연결한 계정으로 인증해 주세요.".into())}
    let user=crate::text(&identity,"cloud_user_id")?.to_string();
    let project=crate::text(&identity,"cloud_project_url")?.to_string();
    if project!=option_env!("VITE_SUPABASE_URL").unwrap_or("").trim().trim_end_matches('/') {return Err("연결한 Cloud 서버가 이 앱 설정과 다릅니다.".into())}
    Ok((user,project))
}
#[tauri::command]
async fn local_session_read(app: tauri::AppHandle,state: tauri::State<'_,Arc<LocalState>>) -> Result<Option<String>,String> {
    with_db(state,move|db|{let (user,project)=vault_context(db)?;crate::session_vault::read(&app,&user,&project)}).await
}
#[tauri::command]
async fn local_session_write(app: tauri::AppHandle,state: tauri::State<'_,Arc<LocalState>>,refresh_token:String) -> Result<(),String> {
    let epoch=state.auth_epoch.load(Ordering::SeqCst);let owned=Arc::clone(state.inner());
    with_db(state,move|db|{if epoch!=owned.auth_epoch.load(Ordering::SeqCst){return Err("세션 저장이 취소됐습니다.".into())}let(user,project)=vault_context(db)?;crate::session_vault::write(&app,&user,&project,&refresh_token)}).await
}
#[tauri::command]
async fn local_sync_status(state: tauri::State<'_,Arc<LocalState>>) -> Result<Value,String> {with_db(state,|db|db.sync_status()).await}
#[tauri::command]
async fn local_sync_next(state: tauri::State<'_,Arc<LocalState>>,cloud_user_id:String) -> Result<Value,String> {with_db(state,move|db|db.sync_next(&cloud_user_id)).await}
#[tauri::command]
async fn local_sync_ack(state: tauri::State<'_,Arc<LocalState>>,cloud_user_id:String,operation_id:String,response:Value) -> Result<(),String> {with_db(state,move|db|db.sync_ack(&cloud_user_id,&operation_id,response)).await}
#[tauri::command]
async fn local_sync_page(state: tauri::State<'_,Arc<LocalState>>,cloud_user_id:String,after:String,page:Value) -> Result<bool,String> {with_db(state,move|db|db.sync_page(&cloud_user_id,&after,page)).await}
#[tauri::command]
async fn local_sync_resolve(state: tauri::State<'_,Arc<LocalState>>,cloud_user_id:String,table:String,id:String,choice:String) -> Result<(),String> {with_db(state,move|db|db.sync_resolve(&cloud_user_id,&table,&id,&choice)).await}
#[tauri::command]
async fn local_bind_account(
    state: tauri::State<'_, Arc<LocalState>>,
    access_token: String,
) -> Result<Value, String> {
    let epoch = state.auth_epoch.load(Ordering::SeqCst);
    // Never trust a caller-provided user ID/email/server. Verify against this build's Auth server.
    let url = option_env!("VITE_SUPABASE_URL")
        .unwrap_or("")
        .trim()
        .trim_end_matches('/');
    let key = option_env!("VITE_SUPABASE_PUBLISHABLE_KEY")
        .unwrap_or("")
        .trim();
    let parsed = url::Url::parse(url).map_err(|_| {
        "이 앱 빌드에 Cloud 연결 설정이 없습니다. 설정된 최신 설치 파일을 사용해 주세요."
    })?;
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || !key.starts_with("sb_publishable_")
    {
        return Err(
            "Native Cloud 공개 설정을 확인해 주세요. Secret 키는 사용할 수 없습니다.".into(),
        );
    }
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Cloud 연결 초기화 실패")?
        .get(format!("{url}/auth/v1/user"))
        .header("apikey", key)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| {
            "계정을 확인할 수 없습니다. 네트워크를 확인해 주세요. 로컬 기록은 보존됩니다."
        })?;
    if !response.status().is_success() {
        return Err(
            "Cloud 인증 확인에 실패했습니다. 다시 로그인해 주세요. 로컬 기록은 보존됩니다.".into(),
        );
    }
    let user: Value = response
        .json()
        .await
        .map_err(|_| "Cloud 계정 응답을 읽을 수 없습니다.")?;
    let url = url.to_string();
    let owned = Arc::clone(state.inner());
    with_db(state, move |db| {
        if owned.auth_epoch.load(Ordering::SeqCst) != epoch {
            return Err("로그인 요청이 취소되었습니다.".into());
        }
        db.bind_verified_account(&user, &url)
    })
    .await
}
fn avatar_data(state: &LocalState, db: &Database) -> Result<Option<String>, String> {
    let dir = state
        .path
        .parent()
        .ok_or("프로필 저장 위치 오류")?
        .join("profile");
    let Some(bytes) = db.read_avatar(&dir)? else {
        return Ok(None);
    };
    Ok(Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    )))
}
#[tauri::command]
async fn local_avatar(state: tauri::State<'_, Arc<LocalState>>) -> Result<Option<String>, String> {
    let state = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || locked_db(&state, |db| avatar_data(&state, db)))
        .await
        .map_err(|_| "사진 읽기 오류".to_string())?
}
#[tauri::command]
async fn local_pick_avatar(
    app: tauri::AppHandle,
    state: tauri::State<'_, Arc<LocalState>>,
) -> Result<Option<String>, String> {
    let state = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || {
        locked_db(&state, |db| db.require_workspace())?;
        let selected = app
            .dialog()
            .file()
            .set_title("프로필 사진 선택")
            .add_filter("사진", &["png", "jpg", "jpeg", "webp"])
            .set_picker_mode(tauri_plugin_dialog::PickerMode::Image)
            .blocking_pick_file();
        let Some(selected) = selected else {
            return locked_db(&state, |db| avatar_data(&state, db));
        };
        let mut bytes = Vec::new();
        app.fs()
            .open(
                selected,
                tauri_plugin_fs::OpenOptions::new().read(true).clone(),
            )
            .map_err(|_| "선택한 사진을 읽을 수 없습니다.")?
            .take(crate::AVATAR_INPUT_LIMIT + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "사진 읽기에 실패했습니다.")?;
        locked_db(&state, |db| {
            // A picker opened before Logout may not access a signed-out workspace.
            let dir = state
                .path
                .parent()
                .ok_or("프로필 저장 위치 오류")?
                .join("profile");
            db.store_avatar(&dir, &bytes)?;
            avatar_data(&state, db)
        })
    })
    .await
    .map_err(|_| "사진 선택 작업 오류".to_string())?
}
#[tauri::command]
async fn local_remove_avatar(state: tauri::State<'_, Arc<LocalState>>) -> Result<(), String> {
    let state = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || {
        locked_db(&state, |db| {
            let dir = state
                .path
                .parent()
                .ok_or("프로필 저장 위치 오류")?
                .join("profile");
            db.remove_avatar(&dir)?;
            Ok(())
        })
    })
    .await
    .map_err(|_| "사진 제거 오류".to_string())?
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
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(crate::session_vault::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            // Opening is lazy through commands: migration failures reach the error UI, never reset data.
            app.manage(Arc::new(LocalState {
                db: Mutex::new(None),
                auth_epoch: AtomicU64::new(0),
                path: dir.join("timora.db"),
            }));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            local_account,
            local_bind_account,
            local_sign_out,
            local_session_read,
            local_session_write,
            local_sync_status,
            local_sync_next,
            local_sync_ack,
            local_sync_page,
            local_sync_resolve,
            local_avatar,
            local_pick_avatar,
            local_remove_avatar,
            local_load,
            local_save,
            local_remove,
            local_convert,
            local_settings,
            local_import,
            local_info
        ])
        .run(tauri::generate_context!())
        .expect("Timora native runtime could not start");
}
