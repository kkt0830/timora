//! Refresh credential only. Android Keystore / Windows Credential Manager.
//! Passwords/access tokens are never written to SQLite or localStorage.
use serde_json::{json, Value};
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
struct AndroidVault(tauri::plugin::PluginHandle<tauri::Wry>);

pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("session-vault")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            _app.manage(AndroidVault(_api.register_android_plugin(
                "app.timora.android",
                "SessionVaultPlugin",
            )?));
            Ok(())
        })
        .build()
}

pub fn read(app: &tauri::AppHandle, user: &str, project: &str) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    let value: Option<String> = {
        let response: Value = app
            .state::<AndroidVault>()
            .0
            .run_mobile_plugin("read", json!({}))
            .map_err(|_| "보안 세션 복원 실패")?;
        response["value"].as_str().map(str::to_string)
    };
    #[cfg(target_os = "windows")]
    let value = match keyring::Entry::new("Timora cloud refresh", &format!("{user}@{project}"))
        .map_err(|_| "Windows 보안 세션 열기 실패")?
        .get_password()
    {
        Ok(v) => Some(v),
        Err(keyring::Error::NoEntry) => None,
        Err(_) => return Err("Windows 보안 세션 복원 실패".into()),
    };
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    let value: Option<String> = {
        let _ = app;
        None
    };
    let Some(value) = value else { return Ok(None) };
    let value: Value = serde_json::from_str(&value).map_err(|_| "보안 세션 형식 오류")?;
    if value["cloud_user_id"] != user || value["project_url"] != project {
        return Err("보안 세션 계정/서버 불일치".into());
    }
    Ok(value["refresh_token"].as_str().map(str::to_string))
}
pub fn write(
    app: &tauri::AppHandle,
    user: &str,
    project: &str,
    refresh: &str,
) -> Result<(), String> {
    if refresh.is_empty() || refresh.len() > 2048 {
        return Err("보안 세션 입력 오류".into());
    }
    let value =
        json!({"cloud_user_id":user,"project_url":project,"refresh_token":refresh}).to_string();
    #[cfg(target_os = "android")]
    {
        let _: Value = app
            .state::<AndroidVault>()
            .0
            .run_mobile_plugin("write", json!({"value":value}))
            .map_err(|_| "Android 보안 세션 저장 실패")?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        keyring::Entry::new("Timora cloud refresh", &format!("{user}@{project}"))
            .map_err(|_| "Windows 보안 세션 열기 실패")?
            .set_password(&value)
            .map_err(|_| "Windows 보안 세션 저장 실패".into())
    }
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    {
        let _ = (app, value);
        Err("이 플랫폼은 보안 세션 복원을 지원하지 않습니다.".into())
    }
}
pub fn clear(app: &tauri::AppHandle, user: &str, project: &str) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        let _ = (user, project);
        let _: Value = app
            .state::<AndroidVault>()
            .0
            .run_mobile_plugin("clear", json!({}))
            .map_err(|_| "Android 보안 세션 삭제 실패")?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        match keyring::Entry::new("Timora cloud refresh", &format!("{user}@{project}"))
            .map_err(|_| "Windows 보안 세션 열기 실패")?
            .delete_credential()
        {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("Windows 보안 세션 삭제 실패".into()),
        }
    }
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    {
        let _ = (app, user, project);
        Ok(())
    }
}
