# Timora v0.3 — Local-first Application Foundation

> «나의 일상과 시간, 기록과 작업을 하나의 흐름으로.»

**현재 소스: v0.3 자동 Cloud 동기화 검증 후보.** 기존 Windows/Android Local-first,
Task 그룹, 계정 유지와 로컬 사진 기능 위에 자동 push/pull·재전송·충돌 선택을 추가합니다.
`version/v0.3`에서 개발하며 새 PR/main merge와 Netlify 재배포는 하지 않습니다.

사용자는 기존 Android 앱 실행과 Cloud 가져오기 성공을 보고했습니다. 새 동기화의
실제 Supabase 세션 회전과 두 실기기 검수는 별도입니다. 자동 테스트와 설치 빌드가
사용자의 실기기 합격을 대신하지 않습니다. [동기화 안내](docs/cloud-sync.md),
[검증 기록](docs/verification.md), [이전 체크포인트](docs/cloud-sync-checkpoint.md)를 참고하세요.

Source `9e0826c`의 Web/DB와 Android APK·AAB/실제 emulator CI가 통과했습니다.
[자동 동기화 Android test APK ZIP](https://github.com/kkt0830/timora/actions/runs/38103096257/artifacts/11688033981)을 받을 수 있습니다. Windows 최종 빌드는 검증 기록에서 확인합니다.

**운영 Web: v0.2**, https://timora-sfj2.netlify.app . 이번 개발에서 Netlify production을
재배포하지 않았습니다. 자동 동기화용 Supabase metadata·trigger·RLS·RPC는
사용자 승인 후 추가했으며 기존 사용자 기록은 보존했습니다.
Issue #4의 버그/UI 수정은 PR #6으로 main에 병합됐습니다. GitHub commit과
Netlify source-upload production 배포는 별개입니다.

## 기능

- Home / Today / Inbox / Tasks / Notes / Calendar / Projects / Library / Settings,
  Profile, Search와 기존 DESIGN.md 디자인을 공유합니다.
- Windows / Android: 새 설치는 Web과 같은 회원가입/로그인 화면에서 시작합니다.
  첫 로그인 후 로컬 계정과 Workspace는 재실행·오프라인에서도 유지됩니다.
  기존 익명 v0.3 기록은 보존하고 계정 연결을 나중에 진행할 수 있습니다. 6개 Entity CRUD,
  Task 완료/우선순위/날짜/Project 연결, Markdown, Month Calendar, Project 상세,
  Inbox → Task/Note, 검색과 설정 저장을 SQLite로 처리합니다.
- Tasks: 기한 지남 / 오늘 / 이번 주 / 이번 달 / 나중에 / 장기 / 일정 없음,
  과거 완료 기록 그룹. 개수·접기·기간 필터·오늘/내일/주/월 날짜 프리셋,
  시작~마감 범위와 남은 일수·장기 개월/년 표시. Issue #5 구현 대상입니다.
- Native Profile: 오프라인 닉네임 수정, 시스템 사진 선택기 → 앱 전용 PNG 복사,
  원본 삭제·재실행 후 사진 유지. PNG/JPEG/WebP, 최대 10 MB, 최대 256px. Cloud 업로드 없음.
- Native 명시적 로그아웃: 데이터·사진 보관, 같은 계정 재로그인으로 복구. 다른 계정 연결/접근 차단.
- Native Cloud 가져오기: 연결한 계정 로그인 → 항목 개수 미리보기 → 확인 → 빈 로컬 DB에
  한 번 가져오기. UUID·관계·원문·날짜·시각 보존. 실패 시 전체 rollback.
  Cloud에는 읽기만 수행하며 반복 가져오기·기존 로컬 덮어쓰기를 거부합니다.
- Web: 기존 Supabase Auth/PostgreSQL/RLS 저장. 웹 자체의 오프라인 편집은 지원하지 않습니다.
- Native 자동 Cloud 동기화: 오프라인 저장 → SQLite outbox → 온라인/화면 복귀/저장 후 전송, 다른 기기 변경 확인. 삭제 전파, 응답 유실 재전송, 충돌 시 이 기기/Cloud 선택. 로그인 refresh credential은 Android Keystore/Windows Credential Manager에 보관합니다. 앱 종료 중 background worker와 사진 파일 업로드는 제외합니다.
- Native 외부 HTTP(S) 자료/Markdown 링크는 기본 브라우저로 엽니다.

## 플랫폼별 상태

| 기능 | Web | Windows | Android |
| --- | --- | --- | --- |
| 6개 Entity / Calendar / Search / Settings | Supabase | SQLite | 공유 SQLite |
| 계정 유지 / Offline 재실행 | Web session | 구현·실기기 대기 | 구현·실기기 대기 |
| 새 설치 첫 로그인 | 인터넷 필요 | 공개 Cloud 빌드 설정 필요 | 공개 Cloud 빌드 설정 필요 |
| 앱 전용 프로필 사진 | HTTPS URL | 시스템 선택기 / 로컬 복사 | 시스템 선택기 / 로컬 복사 |
| Offline editing | 미지원 | 구현 | 구현 |
| Cloud → Local initial import | 원본 Cloud | 구현 | 구현·사용자 성공 보고 |
| 자동 Cloud Sync / 기기 간 동기화 | 새 소스 30초 확인 / 운영 Web 새로고침 | 구현·플랫폼/실기기 검수 | 공유 구현·실기기 검수 |
| 설치 산출물 | 운영 v0.2 URL | exe / NSIS | 테스트 APK / CI |
| 실제 OS 오프라인 재실행·IME gate | 해당 없음 | PENDING | PENDING |

**Windows와 Android의 로컬 DB는 기기별로 독립적**이며, 같은 Supabase 계정에 연결하면
Cloud를 통해 기록을 주고받습니다. 앱을 사용하는 동안 온라인 복귀·저장·화면 복귀와
30초 주기로 동기화합니다. 완전히 종료된 앱은 다음 실행에서 이어갑니다.
Settings → Cloud 동기화에서 대기/오류/충돌을 확인하세요. 기존 설치에서 첫 업데이트 후
Cloud 재인증이 한 번 필요할 수 있습니다. 기존 데이터가 있으면 앱 삭제/데이터 초기화로
업데이트 문제를 해결하지 마세요. 테스트 APK는 서명 차이로 기존 설치 위에 설치되지 않을 수
있으므로 같은 서명으로 업데이트해야 기록을 보존할 수 있습니다.

## 실행

Node 22.18 이상(권장 24), React 19, TypeScript, Vite 6, Router 7, Lucide.
Windows/Android Native는 Tauri 2 + Rust + bundled SQLite(`rusqlite`)를 사용합니다.

```bash
npm ci
```

**Windows Desktop**: [Tauri 공식 사전 조건](https://v2.tauri.app/start/prerequisites/)에
따라 Rust MSVC, Visual Studio C++ Build Tools 및 WebView2를 설치합니다.
첫 로그인에는 `.env`의 공개 Supabase 설정과 인터넷이 필요합니다.
기존 로컬 계정 복원은 Cloud 응답을 기다리지 않습니다.

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
개발 서버는 필요하지 않습니다. 새 설치의 첫 로그인에는 인터넷이 필요하며,
로그인한 뒤에는 오프라인에서도 계정과 기록을 유지합니다. 일반 사용자가 `.env`를 만들지 않습니다.

1. Android 폰/Tablet의 브라우저에서 [Timora 저장소](https://github.com/kkt0830/timora)를 열고 GitHub에 로그인합니다.
2. **Actions → Timora Android checks** ([바로가기](https://github.com/kkt0830/timora/actions/workflows/android.yml))를 엽니다.
3. `version/v0.3` 브랜치의 최신 **성공한 실행**을 선택하고, 실행 source가 자동 Cloud 동기화를 포함하는지 [검증 기록](docs/verification.md)에서 확인합니다.
   예전 성공 실행은 이번 기능을 포함하지 않을 수 있습니다.
4. 실행 페이지 하단 **Artifacts → timora-v0.3-android-arm64-test**를 눌러 ZIP을 다운로드합니다.
5. 파일 앱에서 ZIP을 풀고 `arm64/debug/app-arm64-debug.apk`를 엽니다.
   `x86_64/debug/app-x86_64-debug.apk`는 에뮬레이터용입니다.
6. 필요하면 브라우저/파일 앱의 **이 출처의 앱 설치 허용**을 설정하고 설치합니다.
7. **열기** 또는 홈 화면의 **Timora** 아이콘 → 회원가입/로그인. 확인 메일이 필요한 계정은
   메일 링크를 브라우저에서 연 뒤 앱으로 돌아와 로그인합니다. 그 뒤에는 오프라인 사용이 가능합니다.

Actions 파일 보관 기간은 30일입니다. artifact가 만료되었으면 새 성공 실행의 파일을 받습니다.
향후 Releases 배포를 검토하지만 현재 APK는 Play Store/정식 release 서명 버전이 아닙니다.
CI runner마다 debug 인증서가 달라 기존 APK 업데이트가 거부될 수 있습니다.
**개인 기록이 있는 앱을 삭제하거나 데이터 지우기로 서명 오류를 해결하지 마세요.**
이전 APK와 같은 서명으로 업데이트하거나 별도의 비어 있는 기기 테스트 프로필을 사용합니다.
이전 source `70e1da1`의 APK는 익명 로컬 시작 방식이며 이번 계정/사진 기능을 포함하지 않습니다.

#### 설치 후 오프라인 확인

1. 먼저 인터넷에서 같은 계정으로 로그인한 뒤 앱을 완전히 종료합니다.
   비행기 모드를 켜고 Wi-Fi도 꺼져 있는지 확인한 뒤 Timora를 실행합니다.
2. Task·Note·Project를 생성·수정하고 저장합니다.
3. Android **설정 → 앱 → Timora → 강제 종료**로 프로세스를 종료합니다.
   최근 앱 목록에서 제거하는 것만으로는 완전 종료가 보장되지 않습니다.
4. 비행기 모드를 유지한 채 Timora 아이콘을 눌러 다시 실행하고 저장한 내용이 남아 있는지 확인합니다.
5. Profile에서 사진을 선택하고 원본 삭제 → 앱 강제 종료 → 오프라인 재실행 후 사진도 확인합니다.
   로그아웃은 기록을 지우지 않지만 다시 열려면 같은 계정의 온라인 로그인이 필요합니다.
6. 한국어 입력·Task 그룹·뒤로가기도 확인하고, 기기 모델/Android 버전/사용한 APK source와 결과를 기록합니다.

저장하지 않은 입력은 프로세스 종료 후 복구하지 않습니다. 이후 인터넷을 켜고 앱을
열면 저장한 기록을 Cloud로 전송합니다. 같은 계정의 다른 기기도 온라인에서 앱을
열어 확인합니다. 충돌이 있으면 Cloud 동기화 화면에서 내용을 확인하고 선택합니다.
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
같은 계정의 Android/Windows 앱이 전송한 기록도 확인할 수 있습니다. 운영 v0.2 웹은
다른 기기 변경을 보려면 새로고침이 필요합니다. iPhone/iPad용 native 앱은 현재 제공하지 않습니다.

**Web 개발**: `.env.example`을 `.env`로 복사하고 `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤 `npm run dev`.
변수는 공개 설정이며 secret/service_role/DB password를 넣지 않습니다.
Auth Site URL/Redirect URLs 설정과 Custom SMTP 제한은 [개발 문서](docs/development.md)에 있습니다.
새 Cloud DB는 `db/schema.sql` 후 `db/migrations/*.sql`을 순서대로 한 번 적용합니다.
기존 Timora DB에는 자동 동기화용 additive migration을 적용했습니다. 순서와 역할은
[동기화 문서](docs/cloud-sync.md)에 기록합니다.

## Architecture 및 저장

공유 UI → Provider / domain → `AuthService` / `WorkspaceRepository`.
Web은 Supabase adapter, Windows/Android는 Local adapter → Tauri IPC → Rust → SQLite입니다.
UI에서 SQL을 실행하지 않습니다. Native는 native 쓰기가 성공한 후 UI 상태를 갱신합니다.

로컬 DB는 앱 데이터 디렉터리의 `timora.db`에 보관하며
`PRAGMA user_version=3`과 트랜잭션 migration을 사용합니다.
손상·migration 실패·더 새로운 schema를 자동 초기화하지 않습니다.
로컬 UUID와 Cloud 계정은 분리되며 연결 후 로컬 UUID/행 소유권을 바꾸지 않습니다.
Cloud access token은 메모리, refresh credential은 Android Keystore/Windows Credential
Manager에 보관합니다. SQLite/localStorage에 평문 토큰·비밀번호를 저장하지 않습니다.
SQLite outbox와 Cloud의 revision/receipt로 재전송·삭제·충돌을 처리합니다. 로컬 DB는
암호화되지 않으며 OS 계정/디스크 보호에 의존합니다. 동기화는 백업 기능을 대신하지
않습니다. Android는 app-private sandbox에 저장하고 자동 OS backup을 끕니다.
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
`cargo fmt --check`를 사용합니다. 실제 SQLite 파일 테스트 16개, Node 테스트 47개,
Web 브라우저 회귀와 두 SQLite/PostgreSQL 동기화 통합 검사를 통과했습니다.
이번 Windows/Android 빌드·런타임 결과는 검증 기록을 확인합니다. [설치 파일](https://github.com/kkt0830/timora/actions/workflows/desktop.yml)을 받을 수 있습니다. 수동 결과와 검사 범위는
[verification](docs/verification.md)에 기록합니다. 브라우저 fixture나 SQLite 단위 검사는
실제 Windows/Android 재실행·OS IME·운영 Supabase 계정 확인을 대체하지 않습니다. Android CI는 실제 emulator IPC/force-stop 보존도 별도로 검사합니다.

## 배포 및 다음 버전

Netlify: `npm run build`, publish `dist`, Node 24, SPA fallback 유지.
두 VITE 변수를 Netlify Environment Variables에 등록합니다. Native Actions에는
Settings → Secrets and variables → Actions → **Variables** → Repository variables로
같은 두 공개 설정을 등록합니다. 없거나 잘못된 키면 배포용 Native CI 빌드를 중단합니다. Native는 Windows installer/Android APK
artifact로 배포하며 Netlify에 SQLite를 저장하지 않습니다. 개발 commit마다 production을
배포하지 않습니다.

기본 Cloud Sync / Conflict Resolution은 이번 v0.3 개선에 포함합니다. v0.4는 동기화
운영 안정화·고급 충돌·백그라운드/오프라인 개선 범위 확정, v0.5는 GitHub Integration,
v0.6은 Relations입니다. 루틴·일기·오늘의 한 문장, 파일 첨부·Drawing·Project cover,
다중 Workspace·Password recovery·계정 삭제 UI는 이번 범위에 없습니다.
[Roadmap](ROADMAP.md), [requirements](REQUIREMENTS.md),
[UI](docs/ui-structure.md), [Git workflow](docs/git-workflow.md)를 참고하세요.

## License

아직 결정되지 않았습니다.
