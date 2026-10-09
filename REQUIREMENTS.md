# Requirements — Timora v0.3

기존 v0.2 UI와 서비스 계약을 보존하며 `version/v0.3`에서 Windows Desktop과
오프라인 저장을 개발합니다. 실제 Windows 오프라인 재실행 합격이 정식 완료 조건입니다.

## 필수 범위

- Tauri 2, Windows 11 우선, 재사용하는 React UI/디자인/9개 화면/Profile/Search.
- 실제 SQLite 파일, 앱 데이터 디렉터리, 안정된 로컬 UUID, versioned transaction migration.
- Cloud 로그인/환경 변수/네트워크 없이 Desktop 시작 및 핵심 CRUD·검색·설정 저장.
- 6개 Entity CRUD, Task 완료/priority/start/due/Project, Markdown, Calendar,
  Project 상세, Inbox 원자적 Task/Note 변환. Project 삭제는 연결만 해제합니다.
- 명시적 Cloud → Local 최초 가져오기: 로그인·미리보기·확인, 빈 로컬만 허용,
  원본 ID·관계·원문·시각 보존, 실패 전체 rollback, 반복/덮어쓰기 거부.
- Task 그룹·개수·접기·기간 필터·날짜 프리셋·기간 및 남은 일수.
- 기존 Web Auth/CRUD/RLS/Netlify build 보존. 운영 Cloud schema/data 변경 없음.
- SQLite 파일 재열기·검증 오류·FK·가져오기·날짜 경계 테스트, Web/browser/RLS 회귀,
  Windows 빌드 및 Wi-Fi 차단/완전 종료/재실행/한국어 IME 수동 검사.

## 구현 결정

- `WorkspaceRepository`를 Local/Supabase 두 adapter로 구현합니다. LocalAuth는
  SQLite identity를 반환하며 Supabase Auth와 연결하지 않습니다. Web은 기존 인증 유지.
- plugin에 임의 SQL/파일/쉘 권한을 주지 않고 allowlist CRUD command를 사용합니다.
  HTTP(S) 외부 링크만 scoped opener로 기본 브라우저에 엽니다.
- Local schema v1에 `remote_updated_at`, `sync_state`, imported 행 삭제 tombstone을
  포함합니다. 이는 후속 Sync 준비 정보이며 전송 큐·자동 sync를 의미하지 않습니다.
- 로컬 행 user_id는 local UUID, Cloud owner 매핑은 local_identity에 보관합니다.
  Entity UUID/날짜/created_at/updated_at/content/project_id는 최초 가져오기에서 보존합니다.
- Task date-only / Event RFC3339 instant / Today day-overlap 규칙을 공유합니다.
  주는 월~일, 장기는 시작~마감 차이 90일 이상. 과거 완료 기록 그룹을 추가해
  완료 작업이 기한 지남·미래 할 일로 보이는 것을 방지합니다.
- DB 암호화·OS credential vault는 이번에 구현하지 않습니다. Desktop Cloud 로그인은
  가져오기 동안만 메모리에 유지하고 비밀번호/토큰을 SQLite/localStorage에 저장하지 않습니다.
- Desktop HashRouter, Web BrowserRouter. Custom titlebar 대신 native window를 유지합니다.

## 제외 및 release gate

Cloud 자동 sync/push/충돌 해결/다중 기기, Routine/Journal/Today Sentence,
GitHub Integration, Relations/Graph, 파일 첨부·업로드·Drawing, 다중 Workspace,
Web 오프라인 편집, DB encryption, updater/code signing, macOS/Linux packaging은 제외합니다.
손상·migration 실패 시 DB를 자동 삭제/복구하지 않습니다.

[Manual acceptance](docs/manual-acceptance-v03.md)의 A~E 및 Windows build가 합격해야
정식 v0.3 완료로 표시합니다. 미완료이면 검증 후보/Draft PR로 유지하고 한계를 공개합니다.
Issue #4를 전체 close하지 않으며 Issue #5와 관련된 실제 구현/검증 범위만 보고합니다.
