# Verification — v0.3 Android Expansion (2026-10-09)

Windows PR #7의 main merge 0c1521a 위에서 feature/v0.3-android/PR #8을 검증합니다.
기존 Windows/v0.2/v0.1 기록은 아래에 그대로 보존합니다. 실제 Android와 Windows gate는
각 manual checklist에서 PENDING이며 빌드/fixture로 완료했다고 추정하지 않습니다.

| 검사 | 현재 결과 |
| --- | --- |
| npm ci / TypeScript / production frontend build | 로컬 성공 |
| Node domain/services/runtime/back | 34개 성공 |
| 실제 SQLite file transactions/reopen | 기존 8개 성공; schema 변경 없음 |
| Web / Windows-mode / Android-mode browser fixture | 로컬 Chromium 성공 |
| Android ARM64 Rust + bundled rusqlite | 실제 target compile 성공 |
| Android ARM64 debug APK | 로컬 생성·apksigner verify 성공; app.timora.android / versionCode 3000 / min API 24 / target 37 |
| Android AAB | 로컬 ARM64 debug AAB 생성 성공; production signing/Play Store 미검증 |
| Windows CI | source df7d829의 run 37891475220 성공, exe/NSIS artifact 11598483957 |
| Android CI / emulator native force-stop | 첫 setup failure 수정 후 최신 run 검증 진행 |
| Web/Postgres CI | 첫 Android viewport fixture timing failure 수정 후 최신 run 검증 진행 |
| 실제 Android 기기 | 미실행; 설치/비행기 모드/CRUD/process 종료/보존/Task groups/IME/모바일 UX gate PENDING |
| 실제 Windows PC | 기존 수동 gate PENDING 기록 유지 |
| Cloud import 실제 사용자/외부 browser intent | shared 구현/모의 service 검사; 실제 Android 계정·기기 확인 대기 |

Android SDK CLI bootstrap의 'tools' 제거와 viewport resize 이벤트 timing 문제를 발견해
setup package/현재 command-line tools 및 dialog 높이/resize 대기 검사를 수정했습니다.
로컬 환경은 JRE만 있어 JDK 21 설치가 필요했고 JVM 프록시/CA 설정을 환경 안에서
설정했습니다. 이 환경 설정/credentials/keystore를 repository에 포함하지 않습니다.

Browser fixture는 IPC 모형이며 native Android SQLite 검사가 아닙니다. android-device-smoke는
API 36 emulator의 실제 Tauri IPC/SQLite와 6개 Entity/settings/identity/관계/날짜/Markdown을
force-stop 뒤 검사하도록 구성합니다. 이 검사도 실제 Samsung Keyboard/Gboard를 대체하지 않습니다.

[Android 환경/기술 질문](android.md), [Android manual acceptance](manual-acceptance-v03-android.md),
[Windows manual acceptance](manual-acceptance-v03.md), [PR #8 checks](https://github.com/kkt0830/timora/pull/8/checks).

---

# Verification — Timora v0.3 Candidate

2026-10-09: branch `version/v0.3`, base main `576db72` (PR #6 merged).
이전 버전 기록은 아래에 보존하며 이번 검사와 구분합니다.

| 검사 | 결과 / 범위 |
| --- | --- |
| Install | npm ci 성공; Node 24.19.0; npm/Cargo lockfile 사용 |
| TypeScript | npm run typecheck 성공 |
| Node domain/service | 32개 통과: 기존 Auth/RLS filter/검색/profile, Local IPC no-network, Cloud preview read-only/finally logout, Task 그룹/날짜 경계 |
| Web production build | npm run build 성공; 기존 Netlify dist 설정 유지 |
| Browser | 로컬 Chromium + HTTP fixture 성공; Task 프리셋/그룹 개수/접기 reload/필터 및 기존 Auth/CRUD/Markdown/Calendar/Search IME composition/Profile/error/loading/mobile 회귀 |
| Desktop-mode UI | IPC fixture + dev CSP: Cloud config 없이 시작, 외부 HTTP 차단, DB error retry/failed-save draft/hash reload/search, 기존 로컬 import 시작 차단 통과. 실제 native/Windows 검사 아님 |
| SQLite core | 실제 temporary 파일 테스트 8개 통과; Linux, cargo test --locked --no-default-features |
| Rust format | cargo fmt --check 성공 |
| Remote schema / RLS regression | [CI 37880376118](https://github.com/kkt0830/timora/actions/runs/37880376118) web/database 성공; 격리 Postgres 16, 운영 DB 변경 없음 |
| Windows exe / NSIS | [CI 37880376091](https://github.com/kkt0830/timora/actions/runs/37880376091) 성공, bc90a62 Windows exe/NSIS 및 SQLite tests/format 통과 |
| lint | 별도 lint 설정 없음; strict TS/Rust format 검사 |
| 실제 Windows offline restart / IME | 미실행; 필수 수동 release gate |
| Netlify / Supabase production | 이번 개발에서 재배포·schema/data/RLS 변경 없음 |

## 실제 SQLite 파일 검사

`src-tauri/tests/local_database.rs`:

1. 6개 Entity 생성/수정/삭제, settings, local owner 및 실제 connection close/reopen 일치.
2. native invalid dates/range/unknown table/unsafe URL/FK/missing row 거부.
3. Project 삭제 시 하위 데이터 보존/연결 해제.
4. Inbox Task/Note 원문 보존/원본 제거/반복 실패, 실패 후 원본 유지.
5. import UUID/관계/시각/내용/local owner mapping/metadata 재열기 유지,
   modified/tombstone 및 삭제 뒤 기록 부활 방지.
6. owner/FK/duplicate/settings/date import 오류 시 모든 데이터/설정/import marker rollback.
7. 이미 core 데이터가 있는 로컬 Workspace 덮어쓰기 거부.
8. newer schema/손상 파일/충돌 migration 오류 시 기존 내용 보존과 migration 전체 rollback.

Native core는 네트워크 dependency를 사용하지 않습니다. Local adapter HTTP 금지 fixture는
fetch 호출 0회를 검사합니다. Cloud preview tests는 mock Auth/read data 요청을 사용하며
실제 운영 비밀번호/token/data를 테스트에 넣지 않습니다.

## 검증 중 수정한 문제

- Node strip-only runner와 호환되지 않는 TS parameter property를 명시적 field로 변경.
- Task 경계 테스트의 다음날이 같은 주인 경우 기대값을 수정; 분류 precedence 확인.
- Tauri CLI에 --locked를 직접 전달해 Windows CI가 실패한 문제를 Cargo runner 인수 경계로 수정.
- Desktop deep-link/reload는 HashRouter, Web은 BrowserRouter를 유지.
- migration 버전 거부 전 journal 설정을 바꾸지 않도록 버전 검사 순서 조정.
- imported settings 시각도 native RFC3339 검증으로 보호.
- Windows native UI thread가 SQLite IO/busy wait에 막히지 않도록 worker에서 직렬 실행.
- devCsp를 분리해 Vite inline preamble/HMR을 허용하고 production script CSP는 제한 유지.
- 로컬 기록이 있으면 Cloud 로그인 전에 가져오기 불가 안내/비활성화. Native empty guard도 유지.
- Cloud import URL 끝 슬래시를 정규화해 중복 API 경로를 방지; read-only/owner filter/logout 테스트에서 정상 경로를 확인.
- 앱 데이터 디렉터리 생성도 lazy DB open에서 수행해 디렉터리/권한 오류가 앱 시작을 종료하지 않고 Retry UI로 전달되도록 보완. 기존 파일 보존 테스트 통과.

첫 Windows CI [37878113958](https://github.com/kkt0830/timora/actions/runs/37878113958)는
옵션 전달 오류로 실패했고 성공으로 기록하지 않습니다. 실행 코드 bc90a62의 Windows CI는 성공했습니다. 이후 Cloud import URL 끝 슬래시 정규화와 회귀 assertion을 추가했습니다. 최신 검사/산출물은 [PR #7 checks](https://github.com/kkt0830/timora/pull/7/checks)에서도 확인합니다.

## Windows 산출물 — source bc90a62

[Artifact 11594795491](https://github.com/kkt0830/timora/actions/runs/37880376091/artifacts/11594795491),
`timora-v0.3-windows-x64`, zip 약 224 MB(223,835,610 bytes), exe/NSIS 포함.
WebView2 offline installer를 포함해 크기가 큽니다. 이 artifact 이후 Cloud import URL 정규화를 보완했습니다. Native SQLite/IPC/오프라인 CRUD 코드는 위 source commit과 동일하며, PC 검수 기록은 사용한 artifact commit으로 구분합니다. 사용자에게 이 artifact의 실제 Windows 검수를
요청했으며 결과는 아직 PENDING입니다.

CodeRabbit은 Draft PR 기본 정책에 따라 자동 review를 **건너뛰었습니다**.
PR check의 표시가 pass여도 실제 CodeRabbit 코드 리뷰 완료를 의미하지 않습니다.

## 수동 합격 및 알려진 제한

[manual-acceptance-v03.md](manual-acceptance-v03.md)의 실제 Windows Wi-Fi 차단 → core CRUD →
완전 프로세스 종료 → 재실행 후 데이터 유지, 실제 한국어 IME를 아직 수행하지 않았습니다.
SQLite connection reopen/browser composition/Windows compilation은 이 합격을 대체하지 않습니다.
따라서 현재는 공식 v0.3 완료가 아닌 검증 후보입니다.

실제 계정 Cloud import, Windows 10, 설치/업데이트 후 보존, 큰 데이터, Safari/Firefox도
미확인입니다. 자동 Cloud sync/conflict, encrypted DB, backup/restore UI, code signing/
updater, Web offline editing, 파일 첨부, Routine/Journal/Today Sentence는 미구현입니다.

---

# Verification — Timora v0.2 Release Candidate

## Issue #4 후속 검증 — 2026-10-05 KST

- 기준: main `6063a78` / tree `687902c`, 기존 작업 파일 clean 확인 후
  `fix/issue-4-v02`에서 최소 수정.
- 로컬 TypeScript 및 production build 통과. `node --test --test-isolation=none
  tests/*.test.mjs`로 개별 25개 테스트 통과 확인. 별도 lint 설정은 없음.
- Browser assertions 추가: 조합 시작/진행 중 draft와 URL 분리, 종료 후 한국어 query,
  reload/back/forward/clear와 일반 검색, 메뉴 Workspace/Settings, 단일 logo 중앙 box,
  명시적 Note action과 삭제 취소/승인/reload.
- 로컬 browser는 이 환경에서 로그인 페이지를 불러오지 못해 실패했고 성공으로
  기록하지 않음. 수정 코드 `2b42a40`의 GitHub CI
  [37212723477](https://github.com/kkt0830/timora/actions/runs/37212723477)가 성공했고,
  web의 설치/타입/단위/build/Chromium 및 database의 기존 schema/RLS 회귀를 확인.
- OS의 실제 한국어 IME와 Safari/Firefox는 미검증. synthetic composition 이벤트는
  브라우저/React/Router 계약 검사이며 실제 IME 재현을 대체하지 않음.
- DB/schema/migration/RLS/service/data layer 변경 없음; 운영 데이터 변경 없음.
- 신규 루틴·일기·오늘의 문장 구현 없음. 운영 Netlify는 이 PR과 별도 배포 상태.

2026-10-04: v0.1 기능을 유지한 Design & Experience 변경을 검증합니다.
아래 v0.1 production 실적은 이전 버전의 기록이며 v0.2 배포 성공을 의미하지 않습니다.

| 검사 | v0.2 결과 |
| --- | --- |
| 의존성 설치 | npm ci 성공; 추가 런타임 라이브러리 없음 |
| TypeScript | npm run typecheck 성공 |
| Domain/service | Node 22.18/24에서 각각 25개 통과: 검색/프로필/계정 전환 guard/URL 정규화 |
| Production build | npm run build 성공 |
| PostgreSQL 16 | bootstrap → schema → 002 → 003 → 기존 RLS → Profile RLS 모두 성공 |
| Browser | Actions [37178620347](https://github.com/kkt0830/timora/actions/runs/37178620347) 통과; CRUD/프로필/검색/모바일/입력 보존 검사 성공 |
| lint | 기존 설정 없음 |
| 운영 적용 | v0.2 Profile migration/Netlify ready; URL·bundle·Hosted RLS 확인 |

## v0.2 추가 검증 범위

- 검색: NFKC/대소문자/복수 검색어, 내용·URL·Project context, 빈 결과, 다른 계정 dataset.
- 프로필: 닉네임 길이/공백, HTTPS URL 및 unsafe scheme/userinfo 차단, URL 제거, owner 유지.
- 인증: 이전 계정의 진행 중 refresh 및 대기 중 Web Lock이 새 계정을 변경하지 않음.
- DB: 기존 7개 테이블 CRUD/RLS, 다른 사용자 Profile 조회·수정·위조 owner 차단, URL 제약.
- 브라우저 fixture: 기존 CRUD/Settings/Auth/Error/Loading/Markdown, Profile 메뉴와 Escape,
  nickname/사진 URL 저장·새로고침·제거·실패 fallback, Search에서 Note 열기,
  다른 계정 UUID로 편집기 열기 차단, 1365px Desktop / 834px Tablet / 390px Mobile. 추가로 320px Calendar touch target/문서 폭과
  background refresh 실패 시 Note draft 보존을 검사합니다.

실제 Supabase 가입 메일, 여러 실제 기기의 동시 편집, Safari/Firefox, 자연 만료 및
대규모 데이터는 별도 운영 확인 대상입니다. RLS/Browser fixture 통과는 이 검사를
대체하지 않습니다. 로컬 Chromium의 페이지 응답 중단은 성공으로 기록하지 않으며,
위 Actions 실행에서 실제 UI의 브라우저 검사를 통과한 결과를 사용합니다.
로컬 DB와 fixture만 사용했고 기존 production 사용자 데이터는
변경하지 않았습니다. 배포 전 절차는 [deployment.md](deployment.md)에 기록합니다.

---

# Verification — Timora v0.1

2026-10-02 현재 코드 검사, 실제 Supabase 적용, Netlify production 배포와 사용자 로그인·저장 확인을 완료했습니다. 자동 검사와 수동 확인의 범위를 구분합니다.

| 검사 | 결과 / 근거 |
| --- | --- |
| Dependency install | 현재 환경 npm ci 성공; 기존 lockfile 유지 |
| TypeScript | 현재 환경 npm run typecheck 성공 |
| Domain/service | Node 24 테스트 18개 통과; --test-isolation=none으로 개별 결과 확인 |
| Production build | 로컬 및 Netlify Vite 원격 빌드 성공 |
| CI | [run 37027739790](https://github.com/kkt0830/timora/actions/runs/37027739790) 성공: 설치/타입/테스트/빌드/Chromium/Postgres |
| Hosted schema | 7개 테이블, RLS, FK, trigger, Inbox RPC 및 후속 인덱스 migration 적용 |
| Hosted RLS/CRUD | tests/rls.sql 실행 성공; 모든 fixture는 transaction rollback |
| Backend security | Advisor 보안 지적 없음; 누락 FK 인덱스 4건 수정 및 재검사 |
| Public API | Auth settings 200; email/signup/confirmation 활성; anon Task 접근 401 |
| Netlify | production ready; 실제 변수 목록과 bundle의 URL/활성 public key 일치 확인 |
| SPA / HTTPS | /, /tasks, /notes, /projects/:id HTTPS GET 200; React 진입 HTML과 nosniff header |
| 실제 계정 | 사용자 로그인·Task 저장·새로고침 유지 성공 확인; 서버 confirmed 계정 존재 확인 |
| lint | 기존 설정 없음; strict TypeScript 검사 사용 |
| Secrets | 커밋 대상에 실제 .env/키/DB 비밀번호/일회성 deploy credential 없음 |

## 검증 범위

18개 domain/service 테스트는 timezone별 date-only Task, Event day overlap/end-exclusive, 연도 경계 Calendar, URL·날짜 범위, 세션 복원·갱신·로그아웃·계정 전환 race, 실패 후 재시도, owner filter/Bearer, 0-row write, 401 retry와 pagination을 확인합니다.

CI Chromium 검사는 실제 React UI에 HTTP fixture를 연결해 Navigation, Project 상세, Entity CRUD, 완료/필터, Markdown 안전한 처리, Calendar 이동, Inbox→Note, 새로고침, 오류/재시도/로딩, 모바일 메뉴·폭, Appearance, 계정 전환, 이메일 확인 대기를 확인합니다. 1365px desktop/390px mobile review image를 Actions artifact에 남깁니다.

현재 cloud에서는 Chromium 렌더러가 page crash/closed로 종료되어 로컬 browser 검사는 실패했습니다. 옵션 변경으로 해결되지 않아 반복하지 않았습니다. 이 검사를 성공으로 기록하지 않으며 같은 Commit의 Actions Chromium 통과를 근거로 사용합니다. 배포 화면은 Netlify 생성 screenshot으로 별도 확인합니다.

Hosted SQL 검사는 실제 auth.uid()와 PostgreSQL RLS 엔진을 사용합니다. 다른 사용자 행 조회·수정·삭제 차단, 위조 owner/user_id 재할당 차단, 다른 사용자 Project FK 차단, Entity CRUD, Project 삭제 후 연결 해제/내용 유지, Inbox 원자적 변환·중복/실패, Settings ownership, anon table/RPC 차단을 검사합니다. 임시 UUID fixture 사용자와 데이터는 모두 rollback했습니다. Auth를 대체하는 CI 전용 db-bootstrap.sql은 Hosted DB에 실행하지 않았습니다.

## 수정한 문제

- 오래된 restore 응답이 새 로그인을 해제하는 race와 Today에 과거 완료 작업이 남는 경우를 수정하고 회귀 검사 추가.
- Markdown 타입, select label, hidden 미리보기 CSS, Inbox 변환 후 상태 보존, 목록 row limit, 테스트 서버 종료 문제 수정.
- Hosted Advisor 복합 FK index 지적: project_id/user_id 순서 인덱스 4개 추가, migration 및 CI 반영.
- Netlify 연결 준비 안내: build 전용 scope 등록 도구가 저장 실패를 성공으로 반환해 bundle 설정 누락. 전체 scope 등록 후 목록·bundle 값·사용자 로그인 재확인.

## 남은 운영 확인과 제한

- 두 실제 계정 JWT의 REST 격리는 별도로 실행하지 않았습니다. DB의 두 사용자 역할/claim 검사와 실제 사용자 로그인·저장은 통과했습니다.
- 실제 여러 탭의 refresh rotation, 자연 만료, Safari/Firefox, 대규모 데이터와 장기간 사용은 추가 검증 대상입니다.
- 기본 SMTP는 프로젝트 조직 팀원 이메일만 지원합니다. 다른 주소 가입에는 [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)를 설정합니다.
- Netlify GitHub 자동 배포 연결은 미설정이며 현재 source upload 배포입니다.
- 새 DB의 unused_index INFO는 트래픽이 없다는 의미이며 제거하지 않았습니다. [Advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- 오프라인 편집, 파일 업로드, 범용 Relations, GitHub Integration, Desktop/Mobile은 후속 버전 범위입니다.

연결 대상은 [deployment.md](deployment.md), 개발 절차는 [development.md](development.md)에 기록합니다.

## v0.2 production rollout — 2026-10-04

배포 전 CodeRabbit 지적 중 avatar URL 정규화/encoded length, 링크 radius,
Drawer scrim hover/active 및 문서 표시를 수정했습니다. 추가 회귀를 포함한
CI 37178620347의 web/database가 통과했습니다. Hosted SQL core/Profile
검사도 성공했고 fixture는 rollback했습니다. Anonymous Profile REST는
401, Auth settings는 200이며 실제 bundle에 연결 설정이 포함돼 있습니다.

Supabase security advisor에는 leaked password protection disabled 경고가
1건 있습니다. 프로필 migration의 RLS 누락 경고는 없으며, 해당 Auth 보호
설정은 이번 배포에서 변경하지 않았습니다. 실제 사용자 Profile 저장·
새로고침, 실제 여러 탭 및 Safari/Firefox 확인은 추가 검증 대상입니다.
