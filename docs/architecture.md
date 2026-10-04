# Architecture — Timora v0.2 (v0.1 foundation)

기존 React/Vite 진입점, Router와 서비스 경계를 유지하고 CSS는 DESIGN.md의 token과 공통 UI로 개편했습니다. 샘플 배열 import를 제거하고 서비스 계약과 Supabase 어댑터를 연결했습니다.

```text
React 화면 / 공통 편집기
    ↓
AuthProvider / WorkspaceProvider (세션·로딩·오류·저장 상태)
    ↓
AuthService / WorkspaceRepository 계약 + domain 날짜·검증 규칙
    ↓
SupabaseAuth HTTP adapter / SupabaseRepository PostgREST adapter
    ↓
Supabase Auth / PostgreSQL + RLS + composite FK + Inbox RPC
```

## 경계

- `src/app/App.tsx`: 기존 셸 및 인증/Workspace 경계, 9개 화면 라우팅.
- `src/app/WorkspacePages.tsx`: 기능 화면, 날짜/프로젝트 필터와 Dashboard 계산. `EntityEditor.tsx`, `rows.tsx`, `components.tsx`로 편집·표시 패턴을 분리.
- `src/domain`: Entity 계약, Task date/Event instant 규칙, URL·날짜·입력 검증. React에 의존하지 않음.
- `src/services/contracts.ts`: AuthService와 WorkspaceRepository. 모바일/데스크톱은 다른 UI에서 같은 계약을 사용할 수 있음.
- `src/data`: fetch를 사용한 Supabase Auth 및 REST 어댑터. public 환경 변수는 `services/backend.ts`에서만 읽음.
- `db/schema.sql`: DB 제약, 인덱스, updated_at 트리거, 소유권 RLS, Inbox 변환 트랜잭션.

## 결정

v0.1에서는 기존 의존성/lockfile을 유지하면서 Supabase의 Auth HTTP API와 PostgREST를 사용합니다. UI는 전송 형식을 직접 호출하지 않습니다. 이후 SDK나 다른 플랫폼의 인증 어댑터를 도입해도 계약 뒤에서 교체할 수 있습니다. 현재 HTTP 인증 어댑터는 이메일/비밀번호와 이메일 확인 링크만 지원하며 OAuth/Password recovery는 후속 범위입니다.

Auth 토큰은 프로젝트 URL별 localStorage에 저장하고 비밀번호는 저장하지 않습니다. 복원 시 `/auth/v1/user`로 서버 사용자를 확인합니다. 요청 전에 만료를 확인하고 갱신하며, Data API의 401은 한 번 갱신 후 재시도합니다. 30초 점검과 visibility 복귀 시 만료를 확인합니다. 동시 갱신은 단일 promise와 지원되는 브라우저의 Web Locks로 직렬화합니다. 다른 탭의 저장/로그아웃은 storage event로 반영합니다. 지연된 세션 복원 응답은 더 최근의 로그인이나 로그아웃 상태를 변경하지 않습니다. Web Locks 미지원 브라우저의 동시 탭 사용은 연결 후 추가 검증 대상입니다.

사용자 전환 시 WorkspaceProvider를 user ID로 새로 만들고 이전 데이터·편집 상태를 제거합니다. 오래된 load 응답은 generation 검사로 무시합니다. 생성·수정은 서버가 반환한 행으로 상태를 갱신하며 실패하면 편집기를 닫지 않습니다. 첫 조회 실패는 blocking error로, 이미 로드된 뒤의 재조회 실패는 inline error로 표시하여 편집 중 입력을 보존합니다. Inbox 변환은 RPC 완료 후 재조회합니다. 다른 탭에서 바뀐 데이터는 창 focus/online 복귀 시 재조회합니다. 저장 중에는 이 재조회를 생략합니다. 오프라인 큐/Realtime 동기화는 포함하지 않습니다.

RLS가 최종 권한 경계입니다. 클라이언트 user_id 필터는 방어 계층이며 권한 정책을 대체하지 않습니다. JWT user_metadata를 권한 판단에 사용하지 않습니다. FK가 다른 사용자의 프로젝트 연결을 막습니다. SECURITY DEFINER 함수/권한 우회 view는 없습니다.

## 데이터 규모와 후속 확장

각 테이블은 500개 단위로 조회해 Supabase 기본 1,000행 제한에 의한 누락을 피합니다. Data API max rows는 최소 500으로 설정합니다. 초기 개인 Workspace에 맞춰 모든 객체를 메모리에 유지하므로 큰 데이터의 화면별 서버 필터/페이지네이션은 v0.8에서 개선합니다. 동시에 다른 기기에서 편집할 때는 마지막 저장이 우선이며 충돌 병합은 v0.6 범위입니다.

`project_id`는 v0.1의 구체적인 관계입니다. 후속 버전의 범용 Relation Engine으로 교체할지 함께 유지할지는 그 버전에서 결정합니다. GitHub 외부 ID와 OAuth 토큰은 내부 UUID를 대체하지 않으며 후속 버전의 별도 integration 계층에서 설계합니다. Windows/Android 런타임과 Storage 버킷은 현재 없습니다.

## 배포 경계 — 2026-10-02

Netlify에서 Vite를 빌드하고 dist를 HTTPS로 제공합니다. Supabase 전용 프로젝트는 서울 리전이며 UI와 서비스 계약은 동일합니다. Netlify Free 플랜에서 build 전용 scope로 변수를 등록할 때 저장되지 않는 문제가 있어 두 공개 VITE 변수를 전체 scope로 등록하고 실제 목록과 빌드 산출물로 확인합니다. 비밀 키나 DB 비밀번호는 사용하지 않습니다. 소스 업로드 배포와 GitHub 자동 배포 연결은 별개이며 후자는 현재 설정되지 않았습니다.

## v0.2 decisions

Profile uses owner-protected workspace_settings fields; nickname signup metadata is
presentation only. Search is a pure domain function over loaded account data and
routes by object UUID. UI imports no Supabase transport. Browser Storage is injected
into Auth adapter at the composition root; future Desktop can replace the adapter.
Window focus/online are web lifecycle triggers, not offline support. SQLite/Tauri are
not introduced. Native controls plus src/design primitives avoid a new component library.
Avatar URL reference has no Storage/file lifecycle promises.

Refresh promises are scoped by authentication epoch. A valid new-account token bypasses
a previous account Web Lock; old completions cannot clear a newer pending request.
