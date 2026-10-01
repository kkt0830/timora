# Data model — Timora v0.1

실행 가능한 SQL의 기준은 `db/schema.sql`, TypeScript 계약은 `src/domain/models.ts`입니다. `auth.users`는 Supabase Auth가 관리합니다. 사용자당 하나의 개인 Workspace이며 공유 공간은 없습니다.

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

ObjectRelation 타입은 v0.3 계약 초안으로 남겼습니다. 범용 relations 테이블, GitHub FK, Storage 메타데이터, offline tombstone/version은 이번 SQL에 포함하지 않습니다. 이후 DB 변경은 별도 SQL migration으로 남겨 기존 데이터에 적용하며 bootstrap을 재실행하지 않습니다.
