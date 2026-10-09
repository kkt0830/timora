# Timora v0.3 — Local-first Application Foundation

> «나의 일상과 시간, 기록과 작업을 하나의 흐름으로.»

**현재 소스: v0.3 Local-first Application Foundation 검증 후보.**
Windows 구현은 PR #7, Android 확장은 [PR #8](https://github.com/kkt0830/timora/pull/8)로
main에 병합됐습니다. 두 플랫폼은 같은 Core를 공유합니다.
실제 Windows 및 Android의 오프라인 CRUD → process 종료 → 재실행 보존과 한국어 IME가
정식 완료 조건입니다. [Windows](docs/manual-acceptance-v03.md) /
[Android](docs/manual-acceptance-v03-android.md) 합격 기록은 아직 PENDING입니다.

**운영 Web: v0.2**, https://timora-sfj2.netlify.app . 이번 개발에서 Netlify production을
재배포하거나 기존 Supabase DB·RLS·사용자 데이터를 변경하지 않았습니다.
Issue #4의 버그/UI 수정은 PR #6으로 main에 병합됐습니다. GitHub commit과
Netlify source-upload production 배포는 별개입니다.

## 기능

- Home / Today / Inbox / Tasks / Notes / Calendar / Projects / Library / Settings,
  Profile, Search와 기존 DESIGN.md 디자인을 공유합니다.
- Windows / Android: Cloud 로그인·환경 변수 없이 로컬 Workspace 시작. 6개 Entity CRUD,
  Task 완료/우선순위/날짜/Project 연결, Markdown, Month Calendar, Project 상세,
  Inbox → Task/Note, 검색과 설정 저장을 SQLite로 처리합니다.
- Tasks: 기한 지남 / 오늘 / 이번 주 / 이번 달 / 나중에 / 장기 / 일정 없음,
  과거 완료 기록 그룹. 개수·접기·기간 필터·오늘/내일/주/월 날짜 프리셋,
  시작~마감 범위와 남은 일수·장기 개월/년 표시. Issue #5 구현 대상입니다.
- Native Cloud 가져오기: 로그인 → 항목 개수 미리보기 → 확인 → 빈 로컬 DB에
  한 번 가져오기. UUID·관계·원문·날짜·시각 보존. 실패 시 전체 rollback.
  Cloud에는 읽기만 수행하며 반복 가져오기·기존 로컬 덮어쓰기를 거부합니다.
- Web: 기존 Supabase Auth/PostgreSQL/RLS 저장. 웹 자체의 오프라인 편집은 지원하지 않습니다.
- Native 외부 HTTP(S) 자료/Markdown 링크는 기본 브라우저로 엽니다.

## 플랫폼별 상태

| 기능 | Web | Windows | Android |
| --- | --- | --- | --- |
| 6개 Entity / Calendar / Search / Settings | Supabase | SQLite | 공유 SQLite |
| Local identity / Cloud 설정 없는 시작 | 미지원 | 구현 | 구현 |
| Offline editing | 미지원 | 구현 | 구현 |
| Cloud → Local initial import | 원본 Cloud | 구현 | 공유 구현·실제 계정 검수 대기 |
| 자동 Cloud Sync / 기기 간 동기화 | 미구현 | 미구현 | 미구현 |
| 설치 산출물 | 운영 v0.2 URL | exe / NSIS | 테스트 APK / CI |
| 실제 OS 오프라인 재실행·IME gate | 해당 없음 | PENDING | PENDING |

**Windows와 Android의 로컬 DB는 서로 독립적입니다.** Windows에서 저장한 Task가
Android에 자동으로 나타나지 않습니다. 각 기기에서 Cloud 원본을 한 번 가져올 수 있으며
이후 편집은 해당 기기에만 저장됩니다. v0.4에서 동기화/충돌 처리를 개발합니다.

## 실행

Node 22.18 이상(권장 24), React 19, TypeScript, Vite 6, Router 7, Lucide.
Windows/Android Native는 Tauri 2 + Rust + bundled SQLite(`rusqlite`)를 사용합니다.

```bash
npm ci
```

**Windows Desktop**: [Tauri 공식 사전 조건](https://v2.tauri.app/start/prerequisites/)에
따라 Rust MSVC, Visual Studio C++ Build Tools 및 WebView2를 설치합니다.
Cloud 설정 없이 실행할 수 있습니다.

```bash
npm run tauri dev
npm run desktop:build
```

Windows 산출물: `src-tauri/target/release/timora-desktop.exe`,
`src-tauri/target/release/bundle/nsis/*-setup.exe`.
[Desktop Actions](https://github.com/kkt0830/timora/actions/workflows/desktop.yml)의
성공한 실행에서도 `timora-v0.3-windows-x64` artifact를 받습니다.
NSIS installer에 WebView2 offline installer를 포함합니다.
[설치·DB 위치·검증](docs/desktop.md)을 참고하세요.

### 모바일에서 실행 — Android 앱

ARM64 Android 7.0(API 24) 이상 기기용 테스트 APK입니다. Play Store에서 설치하는 버전은
아니며, APK 다운로드에는 인터넷과 GitHub 로그인이 필요합니다. 설치 후 로컬 사용에는
인터넷·Cloud 로그인·.env·개발 서버가 필요하지 않습니다.

1. Android 폰의 브라우저에서 [검증된 APK 다운로드](https://github.com/kkt0830/timora/actions/runs/37895917148/artifacts/11600741426)를 열고 GitHub에 로그인합니다.
2. `timora-v0.3-android-arm64-test` ZIP을 내려받습니다.
3. 파일 앱에서 ZIP을 압축 해제하고 `arm64/debug/app-arm64-debug.apk`를 엽니다.
   `x86_64/debug/app-x86_64-debug.apk`는 에뮬레이터용이므로 일반 ARM64 폰에는 설치하지 않습니다.
4. 설치 허용을 묻는 경우 APK를 여는 브라우저/파일 앱의 **이 출처의 앱 설치 허용**을
   설정하고 설치합니다. 메뉴 이름은 기기에 따라 다를 수 있습니다.
5. 설치 화면의 **열기** 또는 홈 화면/앱 목록의 **Timora** 아이콘을 누릅니다.
   Local Workspace가 열리면 바로 Task·Note·Project 등을 저장할 수 있습니다.

현재 파일은 source `70e1da1`의 검증된 테스트 서명 APK이며 Actions 보관 기간은 30일입니다.
링크가 만료되면 [Android Actions](https://github.com/kkt0830/timora/actions/workflows/android.yml)의
최근 성공한 실행에서 같은 이름의 artifact를 받습니다. CI runner마다 debug 인증서가 달라
기존 APK 업데이트가 거부될 수 있습니다. **개인 기록이 있는 앱을 삭제하거나 데이터 지우기로
서명 오류를 해결하지 마세요.** 이전 검증 APK를 이미 설치했다면 해당 APK로 테스트를 이어갈 수 있습니다.

#### 설치 후 오프라인 확인

1. 비행기 모드를 켜고 Wi-Fi도 꺼져 있는지 확인한 뒤 Timora를 실행합니다.
2. Task·Note·Project를 생성·수정하고 저장합니다.
3. Android **설정 → 앱 → Timora → 강제 종료**로 프로세스를 종료합니다.
   최근 앱 목록에서 제거하는 것만으로는 완전 종료가 보장되지 않습니다.
4. 비행기 모드를 유지한 채 Timora 아이콘을 눌러 다시 실행하고 저장한 내용이 남아 있는지 확인합니다.
5. 한국어 입력·Task 그룹·뒤로가기도 확인하고, 기기 모델/Android 버전/사용한 APK source와 결과를 기록합니다.

저장하지 않은 입력은 프로세스 종료 후 복구하지 않습니다. Windows·Android·웹 사이의
자동 동기화는 아직 없으므로 웹에서 저장한 기록이 앱에 자동으로 나타나지 않습니다.
전체 검수 항목은 [Android 실기기 체크리스트](docs/manual-acceptance-v03-android.md)를 참고하세요.

#### Android 개발자 실행

Android Studio, JDK 21, SDK/NDK와 Rust Android target이 필요합니다.

```bash
npm run android:dev
npm run android:apk -- --debug --ci
```

기존 checkout에서는 `android:init`을 다시 실행하지 않습니다. 초기화는 custom Activity를
덮어쓸 수 있습니다. [환경·APK·서명·DB·UX](docs/android.md)를 참고하세요.

### 모바일 브라우저에서 실행 — Web

Android/iPhone/iPad의 브라우저에서 https://timora-sfj2.netlify.app 에 접속하고 기존 Cloud
계정으로 로그인합니다. 웹은 Supabase에 데이터를 저장하므로 인터넷이 필요하며,
Android APK의 로컬 Workspace와는 별개입니다. iPhone/iPad용 native 앱은 현재 제공하지 않습니다.

**Web 개발**: `.env.example`을 `.env`로 복사하고 `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤 `npm run dev`.
변수는 공개 설정이며 secret/service_role/DB password를 넣지 않습니다.
Auth Site URL/Redirect URLs 설정과 Custom SMTP 제한은 [개발 문서](docs/development.md)에 있습니다.
새 Cloud DB는 `db/schema.sql` 후 `db/migrations/*.sql`을 순서대로 한 번 적용합니다.
기존 Timora DB에는 v0.3 remote migration을 적용할 필요가 없습니다.

## Architecture 및 저장

공유 UI → Provider / domain → `AuthService` / `WorkspaceRepository`.
Web은 Supabase adapter, Windows/Android는 Local adapter → Tauri IPC → Rust → SQLite입니다.
UI에서 SQL을 실행하지 않습니다. Native는 native 쓰기가 성공한 후 UI 상태를 갱신합니다.

로컬 DB는 앱 데이터 디렉터리의 `timora.db`에 보관하며
`PRAGMA user_version=1`과 트랜잭션 migration을 사용합니다.
손상·migration 실패·더 새로운 schema를 자동 초기화하지 않습니다.
로컬 UUID와 Cloud 계정은 분리됩니다. 로컬 DB는 암호화되지 않으며 OS 계정/디스크 보호에
의존합니다. 다른 기기·Web으로의 자동 동기화·백업은 없습니다. Android는 app-private sandbox에 저장하고 자동 OS backup을 끕니다.
[architecture](docs/architecture.md), [data model](docs/data-model.md),
[offline 정책](docs/offline.md)을 참고하세요.

## 검증

```bash
npm run typecheck
npm test
npm run build
npm run test:local
```

`test:local`에는 Rust가 필요합니다. 별도 lint 설정은 없으며 TypeScript와
`cargo fmt --check`를 사용합니다. 실제 SQLite 파일 테스트 8개, Node 테스트 34개,
Web 브라우저 회귀 검사를 통과했습니다. Windows exe/NSIS CI도 통과했습니다. [설치 파일](https://github.com/kkt0830/timora/actions/workflows/desktop.yml)을 받을 수 있습니다. 수동 결과와 검사 범위는
[verification](docs/verification.md)에 기록합니다. 브라우저 fixture나 SQLite 단위 검사는
실제 Windows/Android 재실행·OS IME·운영 Supabase 계정 확인을 대체하지 않습니다. Android CI는 실제 emulator IPC/force-stop 보존도 별도로 검사합니다.

## 배포 및 다음 버전

Netlify: `npm run build`, publish `dist`, Node 24, SPA fallback 유지.
두 VITE 변수를 Netlify Environment Variables에 등록합니다. Native는 Windows installer/Android APK
artifact로 배포하며 Netlify에 SQLite를 저장하지 않습니다. 개발 commit마다 production을
배포하지 않습니다.

v0.4는 Cloud Sync / Conflict Resolution, v0.5는 GitHub Integration,
v0.6은 Relations입니다. 루틴·일기·오늘의 한 문장, 파일 첨부·Drawing·Project cover,
다중 Workspace·Password recovery·계정 삭제 UI는 이번 범위에 없습니다.
[Roadmap](ROADMAP.md), [requirements](REQUIREMENTS.md),
[UI](docs/ui-structure.md), [Git workflow](docs/git-workflow.md)를 참고하세요.

## License

아직 결정되지 않았습니다.
