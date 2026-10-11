# Desktop — Timora v0.3

Windows 11 x64 우선입니다. Windows 10에서 실행 가능성을 고려한 Tauri/WebView2 구조지만
Windows 10 실제 호환 확인은 아직 하지 않았습니다. macOS/Linux 패키지는 이번 범위가 아닙니다.

## 설치 및 실행

[Desktop Actions](https://github.com/kkt0830/timora/actions/workflows/desktop.yml)의 성공한
`version/v0.3` 실행 → Artifacts → `timora-v0.3-windows-x64`를 다운로드/압축 해제합니다. Source 9e0826c의 Windows CI가 통과했으며 [자동 동기화 exe/NSIS ZIP](https://github.com/kkt0830/timora/actions/runs/38103096311/artifacts/11688687451)을 받을 수 있습니다. 검사 범위는 [verification.md](verification.md)에 기록합니다. 이전 source bc90a62 artifact는 자동 동기화를 포함하지 않습니다.
`Timora_0.3.0_x64-setup.exe`(실제 파일명은 artifact 안에서 확인)로 설치하거나
WebView2가 설치된 PC에서 `timora-desktop.exe`를 실행합니다.

NSIS에는 WebView2 offline installer를 포함합니다. installer 크기가 크지만 설치 중
WebView2를 다운로드할 필요를 줄입니다. 개발/CI build 자체에는 의존성·WebView2
installer 다운로드를 위한 인터넷이 필요합니다. unsigned 검증용 빌드이며 code signing과
자동 updater는 아직 없습니다. 빌드 완료와 실제 PC 합격은 구분합니다.

새 설치는 공개 Supabase build 설정과 온라인 첫 로그인이 필요합니다. 로그인 후에는
Cloud 계정 확인을 기다리지 않고 Local Workspace로 시작합니다. 기존 v1 익명 DB는 그대로 열립니다. 네트워크 없이도 Task/Note/
Project/Event/Library URL metadata/Inbox/설정 생성·편집·삭제·검색이 가능합니다.
외부 웹사이트·avatar 이미지를 오프라인에서 다운로드하거나 캐시하지 않습니다.

## 개발 및 빌드

Node 24 권장, Rust stable MSVC, Visual Studio C++ Build Tools(Windows SDK), WebView2.
공식 조건: https://v2.tauri.app/start/prerequisites/ . 저장소 root에서 실행합니다.

```bash
npm ci
npm run tauri dev
npm run desktop:build
```

`tauri dev`는 Vite 5173을 자동 실행합니다. 다른 서버가 해당 포트를 점유하면 종료 후
다시 실행하세요. 개발 서버가 필요한 dev 모드는 배포 앱 오프라인 합격 검사를 대신하지 않습니다.

CI와 같은 locked build:

```bash
npm run desktop:build -- --ci -- --locked
```

첫 `--`는 npm, 두 번째는 Tauri가 Cargo runner에 옵션을 전달하는 경계입니다.
산출물은 `src-tauri/target/release/timora-desktop.exe`와 `bundle/nsis/*-setup.exe`입니다.
Linux에서 native GUI를 빌드하려면 별도 WebKit/GTK 사전 조건이 필요하며 이 작업의
Windows artifact는 windows-latest CI에서 생성합니다.

## 저장 위치와 보존

Tauri `app_data_dir()/timora.db`, identifier `app.timora.desktop`.
Windows 기본 위치는 `%APPDATA%\app.timora.desktop\timora.db`이며 실제 경로는
Settings → Cloud 가져오기 / DB 위치에서 확인합니다.

앱을 완전히 종료한 뒤 DB와 존재하는 `timora.db-wal`, `timora.db-shm`를 함께 복사해
보관할 수 있습니다. 실행 중 파일 하나만 복사하는 방식은 일관된 백업을 보장하지 않습니다.
UI 백업/복원 기능은 없습니다. 문제 해결을 위해 DB를 삭제하거나 schema version을 임의로
바꾸지 마세요. 오류 메시지·앱 버전·경로를 기록하고 원본을 보존해 진단합니다.

`PRAGMA user_version=3` migration은 transaction이며 실패하면 rollback합니다.
더 최신 버전의 DB나 손상된 DB는 오류/Retry를 표시하고 자동 초기화하지 않습니다.
앱 identifier를 유지해 재설치/업데이트 후 같은 DB를 사용하도록 합니다.
이 버전은 단일 로컬 Workspace입니다. 같은 Cloud 계정에 연결한 다른 PC/Android의
기록은 자동 동기화하며, 서로 다른 OS 사용자나 Cloud 계정의 DB를 합치지 않습니다.

## UI 및 권한

기존 Sidebar/검색/Profile/설정과 native titlebar, 1200×800 초기 창 및 800×600 최소 창을
사용합니다. HashRouter로 Desktop 경로/새로고침을 유지합니다. 키보드 focus/dialog/Escape
패턴을 공유합니다. HTTP(S) 외부 링크는 scoped opener로 기본 브라우저에 엽니다.
임의 SQL·파일시스템·쉘 command permission을 노출하지 않습니다.

실제 Wi-Fi 차단/완전 종료/재실행/IME 검사 및 기록은
[manual-acceptance-v03.md](manual-acceptance-v03.md)를 따릅니다.

## Android 확장 이후

Windows PR #7은 main에 병합됐고 Android 확장은 PR #8에서 같은 Database/runtime을 사용합니다.
Windows identifier/설치/DB 경로는 유지합니다. src/main.rs는 shared runtime.rs의 run 함수를 호출합니다.
Android 프로젝트 추가 후에도 desktop.yml이 exe/NSIS를 다시 빌드합니다. 실제 PC 합격 결과는
기존 Windows checklist를 유지하며 자동 CI를 수동 PASS로 바꾸지 않습니다.

계정 연결/로그아웃/OS 보안 refresh credential과 private 사진 복사는 [offline.md](offline.md)를 참고하세요.
이번 개선은 version/v0.3에 직접 반영하며 기존 Windows CI 합격과 새 실기기 합격을 구분합니다.

기본 자동 동기화와 충돌 처리/실기기 검사 흐름은 [cloud-sync.md](cloud-sync.md)를 참고하세요.
