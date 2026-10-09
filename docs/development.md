# Development / PC setup — v0.3

`version/v0.3`의 검증 후보와 main/운영 v0.2 Web을 구분합니다.
[desktop.md](desktop.md), [offline.md](offline.md), [verification.md](verification.md)를 참고하세요.

## 공통 준비

Node 22.18 이상(권장 24), lockfile 기준 `npm ci`. 실제 `.env`/DB/토큰을 commit하지 않습니다.

### Desktop

Rust stable MSVC, Windows SDK와 Visual Studio C++ Build Tools, WebView2를 설치합니다.
공식 사전 조건은 https://v2.tauri.app/start/prerequisites/ 입니다.

```bash
npm ci
npm run tauri dev
npm run desktop:build
```

Desktop core에는 `.env`/Supabase 로그인/네트워크가 필요 없습니다. 개발 CSP는 Vite inline preamble/HMR을 허용하고 production CSP의 self-only script 정책은 유지합니다.
SQL migration은 앱이 로컬 DB version을 확인해 transaction으로 실행합니다. Cloud SQL을
Desktop SQLite에 적용하지 않습니다. `tauri dev`는 Vite 5173을 자동 시작합니다.
설치된 production exe로 오프라인 수동 합격을 검사하세요.

### Web

1. `.env.example`을 `.env`로 복사하고 VITE_SUPABASE_URL/PUBLISHABLE_KEY를 설정합니다.
   PowerShell: `Copy-Item .env.example .env`. Secret/service_role/DB password를 넣지 않습니다.
2. 새 빈 Supabase DB에만 `db/schema.sql` → `db/migrations/*.sql`을 파일명 순서대로 한 번 적용합니다.
   기존 Timora production DB에는 v0.3 schema 변경이 없습니다. bootstrap을 재실행하지 않습니다.
3. Data API public schema, authenticated grant/RLS, max rows 최소 500을 확인합니다.
4. Auth Email provider, Site URL과 Redirect URLs에 `http://localhost:5173`/실제 배포 URL을 등록합니다.
   기본 SMTP는 조직 팀원 이메일만 발송하며 일반 사용자 가입에는 Custom SMTP가 필요합니다.
5. `npm run dev`. `.env` 변경 뒤 서버를 다시 시작합니다.

현재 연결 대상/배포 실적은 deployment.md에 있습니다. 처음 접속한 신규 환경에서
secret/service_role을 설정하면 안내 화면을 표시하고 인증 요청을 시작하지 않습니다.

## 자동 검증

```bash
npm run typecheck
npm test
npm run build
npm run test:local
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

test:local은 Rust가 필요하며 GUI 라이브러리 없이 `--no-default-features`로 SQLite core를
검증합니다. Cargo.lock 고정 CI 검사:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features
npm run desktop:build -- --ci -- --locked
```

별도 lint 설정은 없습니다. Rust formatter와 TypeScript strict를 사용합니다.
Native tests는 temporary 실제 SQLite 파일만 사용하고 개인 앱 DB를 열지 않습니다.
Web service tests는 HTTP fixture, Cloud preview tests는 읽기/소유 필터/logout/오류를 확인하며
실제 운영 계정에 로그인하거나 자료를 쓰지 않습니다.

브라우저 일회성 테스트 도구(런타임 의존성/lockfile 변경 아님):

```bash
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
npm run test:browser
npm run test:browser:desktop
```

Web fixture는 Vite 4173, Desktop-mode IPC fixture는 4175 포트를 사용합니다. 다른 서버가 점유하면 먼저 종료합니다.
이미 설치된 Chromium을 사용할 때 TIMORA_CHROMIUM_PATH를 지정할 수 있고,
외부 설치한 Playwright는 TIMORA_PLAYWRIGHT_MODULE에 module 경로를 지정할 수 있습니다.
CI는 Playwright Chromium을 설치하며 test-results 이미지를 artifact로 남깁니다.

GitHub Actions `ci.yml`: Web install/types/Node/build/browser, 격리 Postgres 16 core/Profile RLS.
`desktop.yml`: Linux SQLite/format 검사, Windows Node/SQLite/production exe+NSIS 빌드.
CI 전용 tests/db-bootstrap.sql을 실제 Supabase에 실행하지 않습니다.

## 실제 PC/Cloud 확인

필수 Desktop A~E는 [manual-acceptance-v03.md](manual-acceptance-v03.md)에 기록합니다.
Windows build 성공만으로 Wi-Fi 차단/완전 종료/재실행/OS IME 합격을 선언하지 않습니다.
Cloud import는 본인 계정과 빈 로컬 테스트 Workspace에서 별도로 검증합니다.
기존 자료를 삭제하거나 DB를 reset해 테스트하지 않습니다.

Web 운영 확인은 실제 두 계정 Auth/JWT/RLS, CRUD/Inbox/Project detach, 날짜/시간대,
토큰 만료/두 탭, Profile/Search와 새로고침/빈 상태/오류/모바일을 포함합니다.
자동 HTTP/DB fixture가 실제 SMTP/다중기기 검사를 대체하지 않습니다.

## Netlify와 Git

Netlify build `npm run build`, publish `dist`, Node 24, 기존 SPA rewrite/두 VITE 변수를 유지합니다.
개발 commit마다 production 배포하지 않습니다. 이번 v0.3에서는 source-upload v0.2 production을
변경하지 않았습니다. GitHub 자동 배포 연결과 앱 내 GitHub Integration은 별개입니다.
main → version/v0.x → tests → PR → review → merge 절차를 유지합니다.

## 제한

기기 timezone, 기본 Markdown 부분집합, 전 객체 in-memory 검색. Desktop 외부 자료 파일은
캐시하지 않습니다. Web 오프라인 편집, 자동 sync/conflict, DB encryption/백업 UI,
password recovery/계정 삭제 UI, 여러 로컬 Workspace는 아직 없습니다.
