#[cfg(target_os = "android")]
use tauri::Manager;
#[cfg(target_os = "android")]
struct AndroidFiles(tauri::plugin::PluginHandle<tauri::Wry>);
pub fn init() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("timora-files")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            _app.manage(AndroidFiles(
                _api.register_android_plugin("app.timora.android", "FilesPlugin")?,
            ));
            Ok(())
        })
        .build()
}
pub fn filename(
    app: &tauri::AppHandle,
    path: &tauri_plugin_dialog::FilePath,
) -> Result<String, String> {
    if let Some(p) = path.as_path() {
        return p
            .file_name()
            .and_then(|s| s.to_str())
            .map(str::to_string)
            .ok_or("파일 이름을 읽을 수 없습니다.".into());
    }
    #[cfg(target_os = "android")]
    {
        let value: serde_json::Value = app
            .state::<AndroidFiles>()
            .0
            .run_mobile_plugin("filename", serde_json::json!({"uri":path.to_string()}))
            .map_err(|_| "파일 이름 확인 실패")?;
        return value["name"]
            .as_str()
            .map(str::to_string)
            .ok_or("파일 이름이 없습니다.".into());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("이 파일의 이름을 확인할 수 없습니다.".into())
    }
}

#[cfg(target_os = "android")]
pub fn install(app: &tauri::AppHandle, path: &std::path::Path) -> Result<(), String> {
    let response: serde_json::Value = app
        .state::<AndroidFiles>()
        .0
        .run_mobile_plugin(
            "install",
            serde_json::json!({"path":path.to_str().ok_or("설치 파일 경로 오류")?}),
        )
        .map_err(|_| "설치 준비 실패: 이 앱의 설치 권한과 기존 앱 서명 호환성을 확인해 주세요.")?;
    if response["ok"] == true {
        Ok(())
    } else {
        Err(response["error"]
            .as_str()
            .unwrap_or("설치 준비 실패")
            .into())
    }
}
