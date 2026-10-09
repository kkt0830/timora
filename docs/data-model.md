# Data model — Timora v0.3 (Cloud v0.1/v0.2 preserved)

실행 가능한 SQL의 기준은 `db/schema.sql` 및 파일명 순서대로 적용하는 `db/migrations/*.sql`, TypeScript 계약은 `src/domain/models.ts`입니다. `auth.users`는 Supabase Auth가 관리합니다. 사용자당 하나의 개인 Workspace이며 공유 공간은 없습니다.

## 테이블

모든 Entity는 `id uuid`, `user_id uuid → auth.users`, `created_at timestamptz`, `updated_at timestamptz`를 가집니다. ID는 서버 `gen_random_uuid()`로 발급하며 생성/수정 시각은 서버에서 설정합니다. user 삭제 시 Entity를 cascade 삭제합니다.

| 테이블 | 주요 필드 |
| --- | --- |
| projects | name, description, status(active/paused/completed), color |
| tasks | title, description, status(todo/in_progress/done), priority(low/medium/high), start_date, due_date, project_id |
| notes | title, content(Markdown 원문), project_id |
| events | title, description, start_at, end_at, project_id |
| library_items | title, url, type(website/article/github/video/pdf/file/other), description, project_id |
| inbox_items | content, type(unclassified/task/note/event/project/resource) |
| workspace_settings | user_id(PK), workspace_name, appearance(light/dark/system), updated_at |

Tasks/Notes/Events/Library의 선택적 `project_id`는 `(project_id,user_id) → projects(id,user_id)` 복합 FK입니다. 다른 사용자 프로젝트는 연결할 수 없습니다. Project 삭제 시 project_id만 NULL이 되며 내용은 유지됩니다. Postgres 15 이상을 사용합니다.

Task 날짜는 timezone 없는 SQL date입니다. Event는 UTC instant이며 local day의 `[00:00, 다음 날 00:00)`와 겹치는지 확인합니다. 자정에 끝난 Event는 종료일에 중복 표시하지 않습니다. Task 시작일이 마감일보다 늦거나 Event 종료가 시작보다 빠른 입력은 UI와 DB에서 거부합니다.

## 권한·인덱스

7개 테이블 모두 RLS를 활성화하고 authenticated의 `(select auth.uid()) = user_id`를 USING/WITH CHECK 양쪽에 적용합니다. SELECT/INSERT/UPDATE/DELETE를 authenticated에만 명시적으로 부여합니다. anon 테이블 접근과 Inbox RPC 실행을 허용하지 않습니다. user_metadata의 값을 소유권으로 사용하지 않습니다.

user_id/updated_at, Task due_date/start_date/project_id, Event start/end/project_id, Note/Library project_id에 인덱스를 둡니다. 제목/이름은 1~300자, Inbox는 1~20,000자, Note content는 최대 1,000,000자입니다. Library URL은 HTTP(S)만 허용하며 UI에서도 실행 가능한 다른 protocol을 차단합니다.

## Inbox 이동

`convert_inbox(item_id uuid, target_kind text)`는 SECURITY INVOKER로 실행합니다. 자신의 Inbox 행을 FOR UPDATE로 잠그고 Task 또는 Note를 만든 뒤 원본을 삭제합니다. 실패하면 모두 rollback합니다. 다시 요청했을 때 원본이 없으므로 중복 생성하지 않습니다. 첫 줄의 최대 300자를 제목으로, 전체 원문을 description/content로 보존합니다. Event/Project/Library는 v0.1에서 분류만 가능하며 이동은 후속 확장입니다.

## Skeleton 모델에서 변경한 이유

- 공통 ownership/서버 시각을 추가해 사용자 격리와 실제 저장을 지원했습니다.
- Task dueAt를 due_date로 바꿔 날짜를 UTC timestamp로 취급하지 않습니다.
- Note excerpt/category 샘플 필드 대신 content와 project_id를 사용합니다. 목록 excerpt는 원문에서 계산합니다.
- Project title은 name, progress는 하위 Task 완료율로 계산합니다. 기존 색상 UI를 위한 color는 유지합니다.
- Event/Library/Inbox에도 updated_at을 추가해 최신 수정 순 정렬을 일관되게 합니다.
- Library resourceType 대신 실제 URL과 세분화된 자료 type을 제공합니다.
- Inbox processed 대신 미분류/분류 type을 사용합니다. 이동 성공 시 원본을 삭제해 중복 처리를 막습니다.
- Workspace 설정은 인증 user metadata에 섞지 않고 별도 소유 테이블에 저장합니다.

ObjectRelation 타입은 후속 버전의 계약 초안으로 남겼습니다. 범용 relations 테이블, GitHub FK, Storage 메타데이터, offline tombstone/version은 Cloud SQL에 포함하지 않습니다. Local schema v1에는 아래와 같이 추가합니다. 이후 DB 변경은 별도 SQL migration으로 남겨 기존 데이터에 적용하며 bootstrap을 재실행하지 않습니다.

## Hosted DB 적용 — 2026-10-02

서울 리전 Timora 프로젝트에 `timora_v01_core`, `timora_v01_project_foreign_key_indexes` migration을 적용했습니다. Supabase Advisor가 복합 FK의 컬럼 순서와 같은 인덱스를 요구하여 `(project_id, user_id)` 인덱스 4개를 추가했습니다. 기존 `(user_id, project_id)` 조회 인덱스는 유지합니다. 보안 지적과 누락된 FK 인덱스 지적은 없습니다. 새 빈 DB의 unused_index INFO는 삭제 근거로 사용하지 않습니다.

## v0.2 profile migration

003_profile_identity.sql adds display_name text NOT NULL DEFAULT '' (up to 64 chars)
and nullable avatar_url text (HTTPS, up to 2048 chars) to workspace_settings.
Existing rows and owner_access USING/WITH CHECK policies remain. Names are nonunique
presentation values. New signup metadata is a fallback until settings are saved.
No Storage bucket or uploaded assets are created. No additional index is needed for
a single owner-keyed settings row.

Apply once using migration history. It intentionally fails duplicate execution,
preventing partial schema drift. It is additive and old v0.1 clients tolerate it.
Rollback: return the UI to v0.1, retain the extra columns; dropping them destroys profile
values and is not part of routine rollback. CLI generation was attempted but the managed
home was read-only, so the repository's sequential SQL convention is retained.
Production migration was applied on 2026-10-04; no production reset/data removal occurred.

## Hosted v0.2 rollout

2026-10-04 `003_profile_identity.sql`을 `timora_v02_profile_identity`로 적용했습니다.
기존 workspace_settings 1행, Tasks 3행, Projects 2행 및 다른 Entity 개수가
유지됐습니다. 소유권 RLS와 2개 profile column을 확인하고 core/Profile RLS
fixtures를 모두 rollback했습니다. 작은 settings table의 현재 migration은
두 CHECK를 즉시 검증합니다. lock_timeout 5초를 두며, 큰 테이블에 배포할
경우 NOT VALID 추가와 별도 검증 transaction으로 분리하는 개선을 검토합니다.

## v0.3 Local SQLite schema v2

실행 기준: `src-tauri/migrations/001_initial_local_schema.sql` +
`002_local_account_profile.sql`, native validator
`src-tauri/src/lib.rs`. Cloud 테이블/정책/migration 변경은 없습니다.

6개 Entity의 위 필드는 그대로 사용하지만 UUID/date/instant는 SQLite TEXT로 저장합니다.
Entity UUID는 native uuid v4, user_id는 안정된 local UUID입니다. 모든 생성/수정 응답은
실제 DB 행이며 updated_at은 native UTC clock으로 설정합니다. 최초 import에서는 원격의
UUID/created_at/updated_at/date-only/RFC3339/관계/내용을 그대로 보존합니다.

| 구조 | 주요 필드/규칙 |
| --- | --- |
| local_identity | singleton=1 PK, id unique, cloud_user_id/imported_at nullable, access_state, email, cloud_project_url, last_authenticated_at, created_at, local_avatar |
| 6개 Entity | id PK, user_id, created_at, updated_at, remote_updated_at nullable, sync_state(local/imported/modified) + 기존 필드 |
| workspace_settings | user_id PK, workspace_name, appearance, display_name, avatar_url nullable, updated_at |
| tombstones | (entity_table,id) PK, remote_updated_at, deleted_at |

tasks/notes/events/library_items.project_id → projects.id, `ON DELETE SET NULL`.
Native Project 삭제 transaction은 하위 updated_at/sync_state도 갱신합니다.
updated_at 정렬 index 및 project_id FK index를 포함합니다. 제목·내용·enum·Task range는
SQL CHECK와 native validator로 보호합니다. RFC3339/정확한 date/HTTP(S) URL/UUID 검증은
native 계층에서 수행합니다. UI 검증을 우회한 IPC에도 적용합니다.

FK ON, WAL, synchronous FULL. `PRAGMA user_version=2`.
새 DB는 001+002+UUID/settings를 한 transaction으로 만들고 access_state=new로 시작합니다.
기존 v1은 002를 한 transaction으로 적용하며 access_state=local_only로 기록/UUID를 보존합니다.
버전>2는 변경하지 않고 거부합니다. migration 실패/손상은 reset하지 않습니다.

access_state: new / local_only / signed_in / signed_out. signed_in은 Cloud token 유효 여부가
아닌 로컬 사용 자격입니다. Native runtime이 build-configured Auth 서버에서 검증한
Cloud 계정을 연결할 때만 signed_in으로 바꿉니다. signed_out/new는 데이터 IPC가 거부됩니다.
email/cloud_project_url/last_authenticated_at은 마지막 서버 인증 결과입니다. created_at은
새 Identity 생성 시각이며 v1 migration에서는 원래 생성 시각이 없어서 migration 시각을 기록합니다.
닉네임과 Cloud avatar URL은 기존 workspace_settings 필드를 재사용해 중복 Identity column을 피합니다.
local_avatar는 private PNG filename UUID.png뿐이며 절대 경로/content URI/토큰/비밀번호가 아닙니다.
Cloud ID가 이미 연결되었거나 기존 import mapping이 있으면 다른 계정으로 변경할 수 없습니다.

개별 Entity remote_updated_at은 import 기준값이며 로컬 수정 뒤에도 유지합니다.
imported 행 삭제에만 tombstone을 남깁니다. local-only 행 삭제는 물리 삭제입니다.
원자적 Inbox 이동/Project detach/import rollback을 실제 파일 tests로 검증합니다.

settings에는 이번 버전에서 sync_state/tombstone을 두지 않습니다. 아직 자동 sync가 없으며
v0.4 settings sync 계약에 포함해야 합니다. SQLite는 단일 OS/Workspace DB이며 RLS나
DB encryption이 없습니다. 보안·가져오기 제한은 [offline.md](offline.md)를 참고하세요.

## Android expansion

Android와 Windows는 같은 Local schema v2/migration/identity/FK/transaction/metadata/tombstones를
사용합니다. Android 전용 schema와 Cloud schema/RLS 변경은 없습니다. app_data_dir는 Android sandbox app data 영역이며
Windows 파일과 독립적입니다. remote_id는 별도 column 없이 보존한 Entity UUID를 사용합니다.
Sync는 아직 실행하지 않습니다. Android process termination 확인은 플랫폼별 acceptance입니다.
