//! Fixed-repository release downloads; no arbitrary URL/path execution from JavaScript.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    path::PathBuf,
    sync::Mutex,
};
use tauri::{Emitter, Manager};
const API: &str = "https://api.github.com/repos/kkt0830/timora/releases/latest";
const MAX_INSTALLER: u64 = 512 * 1024 * 1024;
struct Download {
    path: PathBuf,
    asset: u64,
    hash: String,
    version: String,
}
#[derive(Default)]
pub struct UpdateState(Mutex<Option<Download>>, Mutex<bool>);
fn version(value: &str) -> Option<[u64; 3]> {
    let parts = value
        .strip_prefix('v')
        .unwrap_or(value)
        .split('.')
        .map(str::parse::<u64>)
        .collect::<std::result::Result<Vec<_>, _>>()
        .ok()?;
    if parts.len() != 3 {
        return None;
    }
    Some([parts[0], parts[1], parts[2]])
}
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Timora update center")
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(300))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let url = attempt.url();
            if attempt.previous().len() > 3
                || url.scheme() != "https"
                || !matches!(
                    url.host_str(),
                    Some("github.com" | "api.github.com" | "release-assets.githubusercontent.com")
                )
            {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|_| "업데이트 연결 초기화 실패".into())
}
async fn release() -> Result<Value, String> {
    let response = client()?
        .get(API)
        .send()
        .await
        .map_err(|_| "릴리스 정보를 가져오지 못했습니다.")?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(json!({"available":false,"reason":"아직 정식 릴리스가 없습니다."}));
    }
    if !response.status().is_success() {
        return Err(format!("릴리스 확인 실패 ({})", response.status().as_u16()));
    }
    let mut body = Vec::new();
    let mut response = response;
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "릴리스 응답 읽기 실패")?
    {
        if body.len() + chunk.len() > 1024 * 1024 {
            return Err("릴리스 정보 크기 초과".into());
        }
        body.extend_from_slice(&chunk);
    }
    let v: Value = serde_json::from_slice(&body).map_err(|_| "릴리스 정보 형식 오류")?;
    let tag = v["tag_name"].as_str().ok_or("릴리스 버전 없음")?;
    let newer = version(tag)
        .zip(version(env!("CARGO_PKG_VERSION")))
        .is_some_and(|(a, b)| a > b);
    let suffix = if cfg!(target_os = "android") {
        "android-arm64.apk"
    } else if cfg!(target_os = "windows") {
        "Windows-x64.exe"
    } else {
        "unsupported"
    };
    let filename = format!("Timora-v{}-{suffix}", tag.trim_start_matches('v'));
    let asset = v["assets"]
        .as_array()
        .and_then(|items| items.iter().find(|a| a["name"] == filename));
    let ready = newer && v["draft"] == false && v["prerelease"] == false && asset.is_some();
    Ok(
        json!({"available":ready,"version":tag,"notes":v["body"].as_str().unwrap_or(""),"url":v["html_url"],"asset":asset,"reason":if !newer{"최신 버전입니다."}else if asset.is_none(){"이 플랫폼의 정식 설치 파일이 없습니다."}else{"업데이트가 있습니다."}}),
    )
}
fn validated_asset(info: &Value, id: u64) -> Result<(String, String, String, u64), String> {
    if info["available"] != true || info["asset"]["id"].as_u64() != Some(id) {
        return Err("릴리스가 변경되었거나 설치 파일이 없습니다. 다시 확인해 주세요.".into());
    }
    let asset = &info["asset"];
    let url = asset["browser_download_url"]
        .as_str()
        .ok_or("설치 파일 URL 오류")?;
    let parsed = url::Url::parse(url).map_err(|_| "설치 파일 URL 오류")?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("github.com")
        || !parsed
            .path()
            .starts_with("/kkt0830/timora/releases/download/")
    {
        return Err("허용되지 않은 설치 파일 출처입니다.".into());
    }
    let hash = asset["digest"]
        .as_str()
        .and_then(|s| s.strip_prefix("sha256:"))
        .filter(|s| {
            s.len() == 64
                && s.bytes()
                    .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        })
        .ok_or("GitHub가 제공한 SHA-256이 없어 설치를 진행할 수 없습니다.")?;
    let size = asset["size"]
        .as_u64()
        .filter(|n| *n > 0 && *n <= MAX_INSTALLER)
        .ok_or("설치 파일 크기 오류")?;
    Ok((
        url.into(),
        hash.into(),
        info["version"].as_str().unwrap().into(),
        size,
    ))
}
#[tauri::command]
pub async fn check_update() -> Result<Value, String> {
    release().await
}
#[tauri::command]
pub async fn download_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, UpdateState>,
    asset_id: u64,
) -> Result<Value, String> {
    {
        let mut busy = state.1.lock().map_err(|_| "업데이트 잠금 오류")?;
        if *busy {
            return Err("업데이트를 내려받는 중입니다.".into());
        }
        *busy = true;
    }
    let result = async {
        let (url, expected, version, size) = validated_asset(&release().await?, asset_id)?;
        let dir = app
            .path()
            .app_cache_dir()
            .map_err(|_| "업데이트 저장 위치 오류")?
            .join("updates");
        std::fs::create_dir_all(&dir).map_err(|_| "업데이트 폴더 오류")?;
        let ext = if cfg!(target_os = "android") {
            "apk"
        } else {
            "exe"
        };
        let path = dir.join(format!("{}.{ext}", uuid::Uuid::new_v4()));
        let mut temp =
            tempfile::NamedTempFile::new_in(&dir).map_err(|_| "업데이트 임시 파일 오류")?;
        let mut response = client()?
            .get(url)
            .send()
            .await
            .map_err(|_| "설치 파일 다운로드 실패")?;
        if !response.status().is_success() {
            return Err("설치 파일 다운로드 응답 오류".into());
        }
        let mut hash = Sha256::new();
        let mut received = 0u64;
        let mut reported = 0u64;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "다운로드가 중단되었습니다. 다시 시도해 주세요.")?
        {
            received += chunk.len() as u64;
            if received > size || received > MAX_INSTALLER {
                return Err("설치 파일 크기 제한 초과".into());
            }
            hash.update(&chunk);
            temp.write_all(&chunk).map_err(|_| "설치 파일 저장 오류")?;
            if received - reported > 1024 * 1024 {
                let _ = app.emit(
                    "timora:update-progress",
                    json!({"asset":asset_id,"received":received,"total":size}),
                );
                reported = received;
            }
        }
        if received != size || format!("{:x}", hash.finalize()) != expected {
            return Err("설치 파일 체크섬이 일치하지 않습니다. 설치하지 않았습니다.".into());
        }
        temp.as_file()
            .sync_all()
            .map_err(|_| "설치 파일 저장 완료 확인 오류")?;
        temp.persist_noclobber(&path)
            .map_err(|_| "설치 파일 보관 오류")?;
        *state.0.lock().map_err(|_| "업데이트 잠금 오류")? = Some(Download {
            path,
            asset: asset_id,
            hash: expected,
            version: version.clone(),
        });
        let _ = app.emit(
            "timora:update-progress",
            json!({"asset":asset_id,"received":size,"total":size}),
        );
        Ok(json!({"verified":true,"version":version,"asset":asset_id}))
    }
    .await;
    if let Ok(mut busy) = state.1.lock() {
        *busy = false;
    }
    result
}
#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    state: tauri::State<'_, UpdateState>,
    asset_id: u64,
) -> Result<(), String> {
    let info = release().await?;
    let (_, expected, version, _) = validated_asset(&info, asset_id)?;
    let path = {
        let guard = state.0.lock().map_err(|_| "업데이트 잠금 오류")?;
        let file = guard.as_ref().ok_or("먼저 설치 파일을 내려받아 주세요.")?;
        if file.asset != asset_id || file.hash != expected || file.version != version {
            return Err("설치 파일 정보가 변경되었습니다. 다시 내려받아 주세요.".into());
        }
        file.path.clone()
    };
    tauri::async_runtime::spawn_blocking(move || {
        let mut file = std::fs::File::open(&path)
            .map_err(|_| "설치 파일이 없습니다.")?
            .take(MAX_INSTALLER + 1);
        let mut hash = Sha256::new();
        let mut buf = [0; 65536];
        loop {
            let n = file.read(&mut buf).map_err(|_| "설치 파일 확인 오류")?;
            if n == 0 {
                break;
            }
            hash.update(&buf[..n]);
        }
        if format!("{:x}", hash.finalize()) != expected {
            return Err("설치 파일이 변경되었습니다. 다시 내려받아 주세요.".into());
        }
        #[cfg(target_os = "android")]
        {
            crate::native_files::install(&app, &path)?;
        }
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new(&path)
                .spawn()
                .map_err(|_| "설치 프로그램 실행 실패")?;
            app.exit(0);
        }
        #[cfg(not(any(target_os = "android", target_os = "windows")))]
        {
            let _ = app;
            return Err("이 플랫폼의 설치 흐름은 지원하지 않습니다.".into());
        }
        #[allow(unreachable_code)]
        Ok(())
    })
    .await
    .map_err(|_| "업데이트 설치 준비 오류".to_string())?
}
