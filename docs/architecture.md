# Architecture — Timora v0.3

기존 React/Vite UI, DESIGN.md, AuthService/WorkspaceRepository 계약을 재사용합니다.

```text
Shared React UI / domain / providers
             ↓
AuthService / WorkspaceRepository
       ↙                    ↘
Web                       Native (Windows / Android)
SupabaseAuth              LocalAuth (persisted identity + memory-only Cloud session)
SupabaseRepository        LocalWorkspaceRepository
       ↓                    ↓ Tauri IPC
PostgREST / Auth           Rust Database / rusqlite
PostgreSQL + RLS           SQLite app data file
```

## Composition 및 경계

- `services/backend.ts`: Tauri runtime 존재 여부로 adapter 선택. Native는 SQLite repository를 선택하고 공개 빌드 설정이 있을 때만
  메모리 SupabaseAuth를 추가합니다. 기존 Local Identity 복원은 설정/Cloud 응답 없이 가능합니다.
- `main.tsx`: Web BrowserRouter / Native HashRouter. Native deep-link 새로고침은
  bundled index.html을 유지하고 Search/편집기 query는 Router 계약을 공유합니다.
- `app/providers.tsx`: account별 Workspace, generation guard, mutation lock,
  load/error/retry/empty 상태. 저장 완료 응답으로 UI를 갱신합니다. Native startup은 local DB만 읽습니다. 실행 중 Cloud token 검사는
  background이며 실패해도 Local Identity를 해제하지 않습니다. focus/online 재조회 역시 선택된 repository를 사용합니다.
- `data/local-repository.ts`: typed IPC adapter, 에러 정규화. 화면에서 SQL을 실행하지 않습니다.
- `src-tauri/src/runtime.rs`: worker에서 실행하는 단일 Mutex connection과 lazy open. 파일 IO/잠금 대기가 native UI event loop를 막지 않도록 spawn_blocking을 사용합니다. DB 열기/migration 오류를
  UI로 반환하며 자동 삭제하지 않습니다. DB 생성 위치는 app_data_dir/timora.db입니다.
- `src-tauri/src/lib.rs`: 허용된 entity/필드, native validation, FK 및 transaction CRUD,
  Inbox 이동·Project detach·settings·빈 DB import. 임의 SQL command는 없습니다.
- `domain/task-groups.ts`: 순수 날짜 그룹/필터/기간 표시/프리셋; 날짜별 판정은 기존
  `dates.ts`의 taskOnDay를 재사용합니다. UI collapse 설정만 localStorage에 저장합니다.

## Local identity와 쓰기

최초 migration에서 UUID를 생성해 파일에 보관합니다. LocalAuth는 이 UUID를 반환하므로
첫 로그인은 native build의 서버에서 /auth/v1/user로 확인하고 singleton에 Cloud ID/email을 연결합니다.
토큰 만료는 Native 사용을 막지 않습니다. signed_out/new 상태는 모든 Workspace IPC를 거부합니다.
Cloud ID 및 서버가 다르면 연결을 거부합니다. Local UUID/Entity ownership은 그대로입니다. Local 행의 user_id는 native
계층이 강제합니다. 단일 OS 사용자/로컬 Workspace이며 SQLite에는 Cloud RLS가 없습니다.

Create/Update/Delete → SQLite transaction commit → 행 응답 → Provider UI 갱신.
SQLite는 bundled library, FK ON, WAL, synchronous FULL, busy timeout 5초를 사용합니다.
Project 삭제 시 관련 행의 project_id만 NULL로 변경합니다. Inbox 이동은 대상 생성과 원본
삭제를 하나의 transaction으로 묶습니다. 버전/실패 보존 정책은 data-model.md를 참고하세요.

## Optional Cloud import

`CloudImportPage` → `CloudImportService` → 기존 Supabase Auth/read adapter로
본인 계정의 모든 page를 조회하고 counts를 표시합니다. 전용 메모리 Storage로 인증한 뒤
finally에서 signOut/clear합니다. Web 세션 저장소와 로컬 account를 교체하지 않습니다.

사용자 확인 → local_import → 빈 DB/이미 가져옴/Cloud owner/ID/날짜/FK 검증 → projects부터
전체 transaction → 원본 UUID/관계/시각 보존 → Local UUID로 owner 매핑. 실패는 전체
rollback합니다. 미리보기 이후 로컬 데이터가 생기면 native empty guard가 덮어쓰기를 막습니다.
Cloud는 여러 REST 조회이므로 동시 수정이 있으면 일관된 Cloud snapshot이 보장되지 않습니다.
가져오기 중 다른 기기의 편집을 피하고, 관계가 깨진 입력은 전체 거부합니다.

자동 pull/push/outbox/conflict resolution은 없습니다. Sync metadata는 로컬 변경/삭제를
나중에 판단하기 위한 기반으로만 사용합니다. v0.4에서 owner mapping, remote revision,
충돌·삭제·재시도 계약을 먼저 설계합니다.

## Web 보존과 보안

Web의 Auth HTTP adapter, persistent project-keyed localStorage session, refresh epoch,
Web Locks, 서버 사용자 확인, RLS/composite FK/Inbox RPC는 유지합니다. 500행 단위 pagination,
로드된 계정 dataset 검색, profile 설정과 avatar fallback도 유지합니다. Cloud migration을
추가하거나 운영 데이터에 테스트 fixture를 쓰지 않습니다.

Tauri main local window에만 capability를 적용합니다. dialog/fs plugin은 Rust 내부의
시스템 선택 결과 읽기에만 사용하고 JavaScript에 범용 fs/dialog/shell/SQL 권한을 주지 않습니다.
local_pick_avatar에는 경로 인자가 없고 local_avatar는 DB가 소유한 private 파일만 읽습니다.
사진 디코딩/크기 제한/PNG 축소/저장은 profile.rs, 표시 상태는 NativeProfileProvider가 담당합니다.
Native binding은 reqwest의 HTTPS/timeout/redirect 금지와 build-configured endpoint로 검증하고
UI가 전달한 사용자 ID/email/endpoint를 인증 근거로 사용하지 않습니다.
명시적 logout epoch는 진행 중 binding이 로그아웃 후 완료되어 잠금을 풀지 못하게 합니다.
Cloud session은 메모리 fallback으로 profile/offline 문서의 security tradeoff를 적용합니다.

opener는 http/https URL만 허용합니다. CSP는 self script와 IPC/HTTPS 연결만 허용하고 raw
Markdown HTML은 실행하지 않습니다. 개발 전용 devCsp는 Vite inline preamble/HMR만 추가 허용하며 production script-src 제한을 완화하지 않습니다. 로컬 DB는 암호화되지 않으며 OS 계정/디스크 보호가
경계입니다. 로컬 프로필 사진은 private 복사본입니다. 외부 HTTPS avatar/URL 원격 본문은 오프라인에 캐시하지 않습니다.

## 규모와 배포

개인 Workspace 전체 데이터를 메모리에 읽어 UI/search를 공유합니다. 큰 데이터의
화면별 paging/SQLite FTS는 후속 최적화 대상입니다. native titlebar와 최소 800×600 창을
사용합니다. Web은 Netlify dist, Native은 Windows exe/NSIS이며 배포 경계는 독립입니다.

## Android platform boundary

PR #7의 Windows native 명령/setup을 runtime.rs로 옮겨 `mobile_entry_point`를 제공합니다.
main.rs는 같은 run 함수를 호출하고 lib.rs의 실제 Database 구현은 그대로 유지합니다.
Cargo cdylib/staticlib/rlib은 Android JNI library와 host core 검사를 함께 지원합니다.

services/runtime.ts가 native/Android/Windows를 감지하고 backend/router/opener가 사용합니다.
Android MainActivity → __TIMORA_BACK__ → priority handler registry → overlay/React Router.
Root는 Android dispatcher에 반환합니다. Insets는 Wry view 부착 후 native parent에 적용하며
JS visualViewport가 dialog 높이를 보조합니다. 공유 DB/domain을 플랫폼별로 복제하지 않습니다.

Windows app.timora.desktop과 Android app.timora.android의 app_data_dir 파일은 독립적입니다.
현재 remote_id 별도 column은 없고 보존한 Entity UUID가 원격 ID 역할을 합니다.
remote_updated_at/sync_state/tombstones는 같은 schema이며 자동 Sync는 v0.4입니다.
