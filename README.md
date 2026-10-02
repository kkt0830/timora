# Timora

> «나의 일상과 시간, 기록과 작업을 하나의 흐름으로.»

Timora는 Tasks, Notes, Calendar, Projects, Library를 하나의 개인 Workspace에서 관리하고 연결하는 생산성 웹 애플리케이션입니다. 장기적으로 Windows, Android, Tablet에서 같은 흐름을 이어가는 Personal Workspace를 지향합니다.

**현재 상태: Timora v0.1 — Core Workspace 구현, 전용 Supabase 연결 및 Netlify production 배포 완료. 사용자가 실제 로그인·Task 저장·새로고침 유지를 확인했습니다.**

웹 앱: **https://timora-sfj2.netlify.app** 기존 Pre-v0.1의 React/Vite 구조, Sidebar, 9개 화면과 디자인을 이어서 개발했습니다. 설정 없이 실행하면 연결 안내를 표시하며, 샘플 데이터를 실제 저장 데이터처럼 보여주지 않습니다.

## 현재 기능

| 화면 | 구현 내용 |
| --- | --- |
| Home | 오늘 Task 진행도, 다음 일정, 최근 프로젝트·노트, 미분류 Inbox, 다가오는 마감 |
| Today | 오늘 시작/진행/마감하는 작업, 기한이 지난 미완료 작업, 오늘과 겹치는 일정, 프로젝트 링크 |
| Inbox | 빠른 기록, 수정·삭제, 분류, Task/Note로 원자적 이동 |
| Tasks | 생성·수정·삭제, 완료 전환, 상태, 우선순위, 시작일·마감일, 프로젝트 연결, 기본 필터 |
| Notes | 생성·수정·삭제, Markdown 원문 저장 및 기본 미리보기, 프로젝트 연결 |
| Calendar | 월 이동, 오늘 이동, 날짜별 Event 및 Task 마감 조회, Event CRUD |
| Projects | CRUD, 상태·색상, Task 기반 완료율, Overview/Tasks/Notes/Events/Library 상세 |
| Library | URL CRUD, Website/Article/GitHub Repository/Video/PDF/File URL/Other, 프로젝트 연결 |
| Settings | Account, Logout, Workspace 이름, Light/Dark/System, 후속 기능 Coming later |

회원가입·로그인·로그아웃·새로고침 후 세션 복원 및 토큰 갱신을 구현했습니다. 사용자 소유권은 PostgreSQL RLS로 제한하며, 다른 사용자의 프로젝트 연결은 복합 외래 키로 차단합니다. 설정도 사용자별로 저장합니다. 서울 리전의 전용 Supabase에 SQL/RLS를 적용하고 실제 DB 권한 검사와 배포 연결 검증을 수행했습니다. 기본 SMTP의 가입 이메일 제한은 아래 배포 문서에 기록합니다.

## PC에서 시작하기

Node.js **22.18 이상**(권장 24)과 npm을 사용합니다. ZIP 다운로드로 작업해도 실행할 수 있습니다.

```bash
npm ci
```

1. 새 Supabase 프로젝트의 SQL Editor에서 [db/schema.sql](db/schema.sql)을 **한 번** 실행한 뒤 `db/migrations/*.sql`을 파일명 순서대로 적용합니다. 기존 테이블을 초기화하는 스크립트가 아닙니다. 현재 Timora 프로젝트에는 이미 적용했으므로 재실행하지 않습니다.
2. `.env.example`을 `.env`로 복사하고 아래 두 공개 설정을 넣습니다.
3. Supabase Auth의 Site URL/Redirect URLs에 개발 주소 `http://localhost:5173`을 등록하고 Email 인증을 활성화합니다.
4. `npm run dev`로 시작하고 계정을 만듭니다. 이메일 확인이 켜져 있으면 확인 링크를 연 뒤 로그인합니다.

| 환경 변수 | 설명 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 브라우저용 publishable key; legacy anon 키도 호환 |

`VITE_*`는 빌드에 포함되어 브라우저에 공개됩니다. Secret/service_role 키, DB 비밀번호, 실제 `.env`는 저장소에 넣지 않습니다. 앱은 secret/service_role 키 설정을 거부합니다. 인증 토큰은 해당 브라우저의 localStorage에 저장되며 비밀번호는 저장하지 않습니다.

## 구조

```text
src/app/          Skeleton 셸, 기능 화면, 공통 편집기, 상태 제공자
src/domain/       Entity 계약, 날짜 규칙, 입력 검증
src/services/     AuthService/WorkspaceRepository 계약과 설정 진입점
src/data/         Supabase Auth HTTP / PostgREST 어댑터
db/schema.sql    재현 가능한 v0.1 bootstrap: 7개 테이블, RLS, 함수, 인덱스
db/migrations/   bootstrap 이후 순서대로 적용할 변경 SQL
tests/           도메인·서비스·브라우저·Postgres 권한 검사
```

기술: React 19, TypeScript, React Router 7, Vite 6, Lucide, Supabase Auth/PostgreSQL. 기존 lockfile을 유지하고 새로운 런타임 의존성을 추가하지 않았습니다. Backend SDK를 화면에서 호출하지 않으며 HTTP 어댑터를 공통 서비스 계약 뒤에 둡니다. [Architecture](docs/architecture.md), [Data model](docs/data-model.md), [UI structure](docs/ui-structure.md)를 참고하세요.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

GitHub Actions에서 설치, 타입 검사, 단위 테스트, production build, Chromium 화면 검사와 PostgreSQL 16 RLS 검사를 실행합니다. lint 설정은 기존 저장소에 없으며 `typecheck`가 엄격한 TypeScript 검사를 수행합니다. 브라우저 테스트는 실제 UI에 HTTP fixture를 연결합니다. PostgreSQL 테스트는 실제 RLS 엔진과 최소 Auth 계약을 사용합니다. 이 두 검사는 연결된 Supabase 서비스의 이메일 발송·Auth 설정·Data API 설정 검증을 대체하지 않습니다.

현재 검증 결과와 PC에서 필요한 확인은 [docs/verification.md](docs/verification.md)에 기록합니다. 실행 및 배포 절차는 [docs/development.md](docs/development.md)에 있습니다.

## Netlify 배포

`netlify.toml`에 Build Command **`npm run build`**, Publish Directory **`dist`**, SPA fallback을 설정했습니다. 전용 사이트 `timora-sfj2`에 소스 업로드 방식으로 production 배포했습니다. GitHub 자동 배포 연결은 아직 없으며, 필요하면 Netlify에서 `kkt0830/timora`의 main을 연결합니다.

Netlify Environment Variables에 위 두 `VITE_*` 설정을 넣고 배포합니다. 환경 변수를 변경하면 다시 빌드해야 합니다. Supabase Auth의 Site URL과 Redirect URLs에 실제 HTTPS 사이트 주소를 등록하세요. `/tasks`, `/projects/:id` 등의 직접 접근·새로고침도 확인해야 합니다.

## 범위와 다음 버전

v0.1은 사용자당 하나의 개인 Workspace를 제공합니다. 첨부 파일 업로드, 협업, GitHub OAuth, Wiki Link/Backlink/Graph, 전역 검색, 명령 팔레트, 오프라인 편집, Desktop/Mobile 앱은 포함하지 않습니다. Library의 File은 파일 URL 저장입니다. Notes는 Markdown 원문을 보존하며 미리보기는 제목·목록·인용·코드·굵은 글씨·HTTP 링크의 기본 부분집합입니다.

[ROADMAP.md](ROADMAP.md)의 방향을 유지합니다. **v0.2부터는 `version/v0.x` → 개발·테스트 → PR → 검토 → main merge** 흐름을 사용합니다. 상세 PR 형식은 [docs/git-workflow.md](docs/git-workflow.md)와 PR template에 있습니다. 다음 버전은 GitHub Integration이며 이번 버전에서 구현하지 않았습니다.

## License

라이선스는 아직 결정되지 않았습니다.
