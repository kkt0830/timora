# Android — Timora v0.3 Local-first Application Foundation

기존 Windows v0.3(PR #7) 위에 `feature/v0.3-android`로 Android를 추가합니다.
동일한 React UI/domain/repository/Rust Database를 사용합니다. Android 전용 schema는 없습니다.
실제 Galaxy 기기의 합격 여부는 [Android manual acceptance](manual-acceptance-v03-android.md)에
기록합니다. CI/에뮬레이터 성공만으로 실제 기기 지원 완료를 선언하지 않습니다.

## 설치와 실행

[Android Actions](https://github.com/kkt0830/timora/actions/workflows/android.yml)의 성공한 실행에서
`timora-v0.3-android-arm64-test` ZIP을 내려받아 압축을 풀고 **arm64 debug APK**를 설치합니다.
Galaxy 등 ARM64 기기용이며 x86_64 APK는 CI 에뮬레이터용입니다. 필요 시 브라우저/파일 앱의
'이 출처의 앱 설치 허용'을 설정합니다. 설치된 Timora는 .env/Cloud 로그인/Vite 서버 없이
실행합니다. APK에 프론트엔드 assets와 bundled SQLite를 포함합니다.

현재 APK는 **개발 테스트 서명**입니다. Play Store 배포/production signing/업데이트 보장은
없습니다. CI runner별 debug 인증서가 달라 재설치 업데이트가 거부될 수 있습니다.
개인 기록이 있는 앱을 이 문제 해결 목적으로 삭제하지 마세요. 앱 삭제/데이터 지우기는
로컬 DB를 삭제합니다. 최초 테스트는 비어 있는 기기 테스트 프로필에서 진행합니다.

## 개발 환경

[Tauri 공식 prerequisites](https://v2.tauri.app/start/prerequisites/#android)와
[CLI Android build](https://v2.tauri.app/reference/cli/#android-build)를 기준으로 합니다.

- Node >=22.18(검증 Node 24), npm ci, Rust stable.
- Android Studio와 JDK 21. JRE만으로는 Gradle compile 작업이 불가능합니다.
- Android SDK Platform/Platform Tools/Build Tools/Command-line Tools, side-by-side NDK.
- JAVA_HOME, ANDROID_HOME, NDK_HOME을 본인의 실제 설치 경로에 설정합니다.
- Rust `aarch64-linux-android`; 에뮬레이터 검증은 `x86_64-linux-android`도 설치합니다.

현재 잠긴 Tauri CLI 2.12.1이 생성한 AGP 9.3.1 / Gradle 9.6.1 / SDK 37을 기반으로 합니다.
CI에는 stable SDK `platforms;android-37.0`, Build Tools 37.0.0, NDK 30.0.16248370을 사용합니다.
이는 재현 가능한 빌드를 위한 실제 호환 버전 기록이며 임의의 구형 NDK 고정이 아닙니다.
Android SDK Manager에서 해당 안정 버전을 설치하고 licenses를 동의합니다.
최신 SDK만 설치했어도 프로젝트의 compile SDK가 빠지면 빌드할 수 없습니다.

```bash
npm ci
rustup target add aarch64-linux-android x86_64-linux-android
npm run android:dev
npm run android:apk -- --debug --ci
```

`android:dev`는 USB debugging 기기/에뮬레이터와 개발 서버 연결이 필요합니다.
오프라인 release gate는 개발 서버가 아닌 **assets가 포함된 설치 APK**로 검사합니다.
`android:apk`는 ARM64를 선택합니다. 전체 빌드 옵션은 다음처럼 지정합니다.

```bash
npm run android:build -- --apk --debug --target aarch64 x86_64 --split-per-abi --ci
npm run android:build -- --aab --debug --target aarch64 --ci
```

APK: `src-tauri/gen/android/app/build/outputs/apk/` 하위.
AAB: `src-tauri/gen/android/app/build/outputs/bundle/` 하위. Debug AAB 패키징을 로컬/CI에서 검증합니다.
실제 release 빌드는 --debug를 생략합니다. Release APK/AAB는 signing 설정
없이는 배포용 서명 산출물이 아닙니다. Play Console 등록/배포는 이번 범위에 없습니다.
기존 checkout에는 native project가 이미 있으므로 **android:init을 다시 실행하지 않습니다**.
이 script는 최초 target 생성용입니다. 다시 초기화하면 사용자 정의 MainActivity/Manifest 등이
덮어써질 수 있으므로 별도 checkout에서 생성 결과를 비교한 뒤 의도한 변경만 반영합니다.

## 재현 가능한 native project

Gradle wrapper/settings/build files, buildSrc Rust bridge, Manifest, MainActivity와 launcher
resources를 Git에 포함합니다. plugin dependency 설정(`tauri.settings.gradle`,
`tauri.build.gradle.kts`), Wry/Tauri generated Kotlin, JNI .so, assets, local.properties,
Gradle/Kotlin cache, build outputs는 생성·무시합니다. CI는 init으로 소스를 덮어쓰지 않습니다.

`app.timora.android`는 안정된 Android application ID입니다. Windows의
`app.timora.desktop` 및 기존 PC 데이터 경로는 변경하지 않습니다. 버전 이름은 0.3.0,
Android versionCode는 3000이며 다음 배포에서는 증가시켜야 합니다.

## 런타임과 데이터

`src-tauri/src/runtime.rs`에서 mobile entry point/managed connection/IPC를 공유합니다.
기존 Cargo feature 이름 `desktop`은 역사적 이름이며 Android도 native shell을 포함할 때
사용합니다. `--no-default-features`는 GUI 없는 SQLite 코어 검사입니다.

Tauri app_data_dir의 `timora.db`를 사용합니다. Android에서 application-private app data
영역에 위치하며 public/shared storage를 사용하지 않습니다. 실제 경로는 Settings →
Cloud 가져오기 / DB 위치에서 조회합니다. 넓은 storage/media permission을 요청하지 않습니다.
권한은 Cloud import/외부 웹 콘텐츠에 필요한 INTERNET만 선언합니다.

FK/WAL/synchronous FULL/transaction/migration/local UUID/6개 Entity/settings/import guard/
metadata/tombstones는 Windows와 같은 Database 구현입니다. 종료 전에 commit된 기록은
파일에서 복구합니다. DB 손상·새 schema·migration 오류를 자동 초기화하지 않습니다.
DB 암호화는 없고 Android sandbox에 의존합니다. Android 자동 backup은 끄며 사용자가
로컬 기록이 Cloud로 자동 백업된다고 오해하지 않도록 합니다.

**Windows와 Android DB는 독립적**입니다. Windows에서 만든 작업이 Android에 자동으로
나타나지 않습니다. Supabase initial import는 빈 DB에서 한 번 수행하는 읽기 전용 흐름입니다.
비밀번호/토큰은 temporary memory에서 정리하고 DB/localStorage/log에 기록하지 않습니다.
원격 schema/data/RLS 변경은 없습니다. 자동 Sync는 v0.4입니다.

## Mobile UI와 lifecycle

- Native HashRouter, Web BrowserRouter. 같은 Tasks/Today/Calendar/Search UI를 사용합니다.
- 기존 Drawer/44px controls 유지. bottom navigation redesign은 하지 않습니다.
- MainActivity의 Back callback → 우선순위 registry: Dialog > Popover > Drawer > route.
  작성한 Entity 폼은 '계속 편집/입력 버리고 닫기' 확인을 표시합니다. 저장 중 Back은
  입력을 폐기하지 않습니다. route history가 없으면 Home으로, Home root에서는 OS에 맡깁니다.
  Android가 먼저 IME를 닫는 Back 동작은 OS가 처리합니다.
- Wry가 setContentView 전에 호출하는 hook이므로 view 부착 후 system bar/cutout/IME
  inset을 parent에 적용합니다. adjustResize + visualViewport dialog 높이를 공유합니다.
- 기존 Manifest configChanges를 유지하므로 회전/keyboard 변경 때 불필요한 Activity 재생성을
  피합니다. 백그라운드 복귀의 local reload는 폼을 unmount하지 않습니다.
- 미저장 draft는 현재 Activity/WebView 메모리에 있습니다. background/foreground 동안 유지하지만
  process kill/앱 완전 재시작에서 복구하는 draft 저장 기능은 없습니다. 저장한 DB 기록과 구분합니다.
- 실제 Samsung Keyboard/Gboard composition은 manual gate이며 synthetic fixture로 대체하지 않습니다.
- HTTP(S) 자료/Markdown 링크는 scoped tauri-plugin-opener의 ACTION_VIEW로 외부 앱에 맡깁니다.
  브라우저/지원 앱이 없으면 UI에 오류를 표시합니다. 기타 scheme은 허용하지 않습니다.

## 기술 질문과 증거

| 질문 | 구현/검증 근거 |
| --- | --- |
| rusqlite Android compile | bundled SQLite + ARM64 native compile; 최종 APK/CI 결과는 verification.md |
| app_data_dir | Tauri Android path API 사용, 설정에서 실제 경로 조회; emulator/device 검증 분리 |
| 동일 IPC | runtime.rs의 같은 commands; emulator에서 local_account/load/save/settings 검증 |
| external opener | plugin Android ACTION_VIEW 구현과 HTTP(S) capability 확인; 실제 외부 앱 전환은 수동 |
| HashRouter | browser fixture와 Android emulator의 내부 navigation/Back 검사 |
| WAL/process 종료 | 실제 SQLite 단위 reopen + emulator force-stop 검사; 실제 Galaxy는 수동 |
| 플랫폼 코드 최소화 | runtime.ts/native-back.ts/MainActivity/Android config만 경계; Database/schema/domain 복제 없음 |

## CI 및 검사 한계

Android workflow: npm ci/typecheck/Node tests/Rust format/SQLite tests → ARM64/x86_64 APK →
signature/identity 검사 → API 36 에뮬레이터에서 비행기 모드, 실제 IPC로 6개 Entity/settings 저장,
force-stop/relaunch/identity·관계·날짜·Markdown 보존, HashRouter와 system Back 검사.
브라우저 fixture는 별도로 external network 차단/Cloud 설정 없음/초기 Retry/폼 입력 유지/
좁은 viewport/drawer/Back 우선순위를 검사합니다.

실제 Galaxy 설치·OS lifecycle·IME·gesture/cutout/soft keyboard는
[manual checklist](manual-acceptance-v03-android.md)에 기록합니다.
자동 Sync/push/widgets/share sheet/background sync/file attachment/Play Store/production signing/
DB encryption/backup UI는 미구현입니다.

## Production signing 준비 (후속 배포)

production keystore는 repository/PR/Actions artifact에 넣지 않습니다. 별도의 안전한 장소에서
생성·백업한 뒤 CI 환경을 구성할 경우 base64 keystore와 store/key passwords를 GitHub Secrets에
등록하고 job의 임시 파일로만 복원합니다. Gradle signingConfigs.release는 environment 또는
ignored keystore.properties에서 읽도록 구성합니다. log 출력/평문 commit은 금지합니다.
현재 workflow는 이 release signing 설정을 적용하지 않았고 test APK만 제공합니다.
