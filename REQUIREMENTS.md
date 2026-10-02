# Requirements — Timora v0.1

목표는 기존 Skeleton 위에 실제 데이터를 생성·수정·삭제·저장하는 개인 웹 Workspace를 만드는 것입니다. 전용 Supabase 프로젝트와 Netlify production 사이트를 연결하고 코드 검사와 실제 서비스 검증 결과를 구분해 기록합니다.

## 구현 범위

- 9개 기존 화면과 Sidebar/반응형 Layout을 유지한다.
- Supabase Auth로 가입·로그인·로그아웃·세션 복원·갱신을 제공한다.
- 모든 Entity에 UUID와 user_id를 두고 RLS로 접근을 제한한다.
- Tasks/Notes/Projects/Events/Library/Inbox CRUD와 사용자 설정을 제공한다.
- Project 상세에서 연결된 Tasks/Notes/Events/Library를 조회·추가한다.
- Home은 현황을, Today는 날짜 기반 행동 목록을 보여준다.
- 빈 데이터/로딩/오류/재시도 상태를 제공하고 저장 실패 시 입력을 유지한다.
- 불필요한 장식을 추가하지 않고 키보드 포커스·명시적 label·기본 모달 포커스 관리를 제공한다.
- SQL/RLS를 재현 가능하게 남기고 설정·비밀 값은 커밋하지 않는다.
- production build와 Netlify SPA routing을 지원한다.

## 구현 중 확정한 결정

| 항목 | v0.1 결정과 이유 |
| --- | --- |
| Workspace | 사용자당 하나의 개인 공간; 공유와 별도 workspace_id는 후속 범위 |
| Object + Relation | UUID Entity와 project_id를 먼저 구현; ObjectRelation 타입은 v0.3 계약으로 유지 |
| Backend 접근 | AuthService/WorkspaceRepository 뒤의 Auth HTTP/PostgREST 어댑터; 기존 의존성과 lockfile 유지 |
| Task 날짜 | start_date/due_date는 date; UTC 변환으로 하루가 이동하는 문제 방지 |
| Event 시간 | UTC timestamptz 저장, 기기 시간대 표시, 날짜별 겹침 조회 |
| Today | 오늘 시작·마감하는 작업/미완료인 활성 날짜 구간의 작업 + 기한 지난 미완료 작업; 미지정 작업은 Tasks에서 관리 |
| Inbox 이동 | Task/Note만 원자적 변환; 다른 유형은 분류 표시만 제공 |
| Project 진행률 | 연결된 Task 완료율에서 계산; 수동 progress 저장 폐지 |
| Library | URL 우선; 파일 업로드와 Storage는 후속 범위 |
| Note | Markdown 원문 및 안전한 기본 미리보기; Wiki Link/Backlink는 후속 범위 |
| Settings | user_id 기본 키 테이블; Workspace 이름과 Appearance를 서버 저장 |

## 완료 확인

설치·TypeScript·단위 테스트·production build·브라우저 흐름·Postgres RLS 검사를 실행한다. 실제 Supabase의 회원가입 이메일, 로그인 유지, 사용자 두 명의 REST 격리, DB 설정과 Netlify 새로고침 검사는 PC에서 연결 후 별도 확인한다. 결과를 docs/verification.md에 기록하며 배포 완료로 과장하지 않는다.

## 다음 버전의 범위

GitHub Integration(v0.2), Object Relations/Backlinks(v0.3), Global Search/Command Palette/Quick Capture(v0.4), Windows(v0.5), Sync/Offline(v0.6), Backup/Security(v0.7), Performance/UX(v0.8), Mobile Preparation(v0.9), Android/Tablet(v1.0), Widgets/Notifications/Automation(v1.1+). 이번 버전에서 앞당기지 않는다.
