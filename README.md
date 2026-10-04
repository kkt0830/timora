# Timora v0.2 — Design & Experience

> «나의 일상과 시간, 기록과 작업을 하나의 흐름으로.»

**v0.2 검토 후보**는 `version/v0.2`에서 개발합니다. `main`과
https://timora-sfj2.netlify.app 의 현재 정식 production은 **v0.1**입니다.
이 브랜치의 Commit은 production 배포를 의미하지 않습니다. PR 검토·merge와
프로필 migration 적용 후 필요한 시점에 배포합니다.

## 기능과 디자인

v0.1의 9개 화면, Auth, 사용자별 RLS, 모든 Entity CRUD, Inbox→Task/Note,
Markdown, Month Calendar 및 Project 상세를 보존합니다.

- Apple-inspired 단일 blue accent, neutral surface, hairline, 공유 token/control.
- Home은 진행도·다음 일정·최근 프로젝트/노트·Inbox·다가오는 마감에 집중.
- Sidebar 사용자 메뉴 → Profile / Settings / Logout. 모바일 drawer focus 관리.
- 가입 닉네임, 기존 계정의 프로필 편집, 이메일 표시, HTTPS avatar URL 변경/제거 및 실패 시 initials.
- Tasks/Notes/Projects/Library/Inbox/Events 텍스트 검색, 본문·프로젝트·URL 검색과 결과 Object 직접 열기.
- 저장 결과로 즉시 상태 갱신. window focus/online 시 재조회. 상시 Refresh 제거, 오류 Retry 유지.
- Light/Dark/System, 키보드 focus/Escape, 44px 입력·Action target, Desktop/Tablet/Mobile layout.

[DESIGN.md](DESIGN.md)의 Timora 섹션이 UI Source of Truth입니다. Apple 분석의
marketing hero/photography/극단적 여백은 적용하지 않습니다.

## 실행

Node 22.18 이상(권장 24), React 19 / TypeScript / Vite 6 / Router 7 / Lucide,
Supabase Auth/PostgreSQL. 새 런타임 dependency나 SQLite를 추가하지 않았습니다.

```bash
npm ci
```

`.env.example`을 `.env`로 복사하고 `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`를 설정한 뒤 `npm run dev`로 실행합니다.
이 변수는 브라우저 공개 설정입니다. service_role/secret/DB password는 넣지 않습니다.
Supabase Auth Site URL/Redirect URLs에 개발/배포 주소를 등록합니다.
현재 기본 SMTP는 팀원 이메일만 지원하며 일반 가입에는 Custom SMTP가 필요합니다.

새 DB: `db/schema.sql` 후 `db/migrations/*.sql`을 파일명 순서대로 한 번씩 적용.
기존 v0.1 DB: **003_profile_identity.sql만 새 migration으로 적용**합니다.
bootstrap을 재실행하거나 DB를 초기화하지 않습니다. production에는 아직 적용하지
않았으며 PR 검토 후 v0.2 배포 전에 적용해야 합니다.

## Architecture

UI → domain / provider → AuthService / WorkspaceRepository → Supabase adapter.
검색은 현재 사용자의 이미 로드된 데이터에서 실행합니다. 프로필은 RLS가 적용된
workspace_settings에 저장합니다. 가입 metadata의 이름은 표시용이며 권한 판단에
사용하지 않습니다. Adapter 경계는 Desktop/Local DB로 확장할 수 있으며 오프라인
저장·동기화를 이미 지원한다고 주장하지 않습니다.

## 검증

```bash
npm run typecheck
npm test
npm run build
```

브라우저/DB 검사는 [development](docs/development.md), 실제 결과와 한계는
[verification](docs/verification.md), migration 계약은 [data model](docs/data-model.md)에 기록합니다.
별도 lint는 없습니다. Browser HTTP fixture와 Postgres RLS는 실제 SMTP·두 실제
계정 JWT·실제 여러 탭 갱신 검증을 대체하지 않습니다.

## 배포

Netlify: `npm run build`, publish `dist`, Node 24. SPA rewrite는 netlify.toml 유지.
두 VITE 변수를 Netlify에 등록합니다. 개발 Commit마다 production을 배포하지 않습니다.
현재 production v0.1과 Supabase 데이터는 유지하며 v0.2 운영 배포는 별도 단계입니다.

## 범위와 제한

Avatar는 **HTTPS URL 방식**이며 파일 업로드/Storage/quota/파일 삭제 기능은 없습니다.
외부 이미지 서버에 요청이 전달되고 referrer는 보내지 않습니다. MIME/크기 검증,
owner-protected Storage lifecycle은 업로드를 도입할 후속 버전에서 구현합니다.
Notes/Inbox 이미지·그림판, Project cover, 고급 검색/Command Palette, GitHub Integration,
Relations/Backlinks, Desktop/Local DB, Sync/Offline은 이번 범위가 아닙니다.
비밀번호 변경/재설정·계정 삭제 UI, 다중 Workspace도 미구현입니다.

Issue #1은 UX/닉네임/검색/Avatar 부분을 반영하지만 첨부·그림판 요청이 남아 있어
전체 해결로 close하지 않습니다. [Roadmap](ROADMAP.md), [requirements](REQUIREMENTS.md),
[UI](docs/ui-structure.md), [Git workflow](docs/git-workflow.md)를 참고하세요.

## License

아직 결정되지 않았습니다.
