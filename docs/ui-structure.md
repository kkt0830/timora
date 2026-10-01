# UI structure — Timora v0.1

기존 Sidebar의 Workspace/Organize 그룹, 하단 Settings, Header, 카드 레이아웃 및 디자인을 유지합니다. 샘플 날짜와 데이터를 제거하고 현재 계정의 Workspace 이름·Inbox 개수·실제 데이터를 표시합니다. 검색/알림은 비활성화 상태와 후속 버전을 명시합니다.

| 경로 | 화면 | 동작 |
| --- | --- | --- |
| `/` | Home | 오늘 진행도, 다음 일정, 최근 프로젝트/노트, 미분류 Inbox, Upcoming |
| `/today` | Today | 오늘/활성 날짜 구간/기한 지난 작업, 오늘과 겹치는 일정, 바로 완료/편집 |
| `/inbox` | Inbox | 빠른 기록, 수정/삭제, 분류, Task/Note 이동 |
| `/tasks` | Tasks | CRUD, 상태/priority/프로젝트/제목 필터 |
| `/notes` | Notes | Markdown CRUD/기본 미리보기, 프로젝트/제목 필터 |
| `/calendar` | Calendar | 6주 Month View, 월/오늘 이동, 날짜별 Event/마감 작업 상세 |
| `/projects` | Projects | CRUD, 상태 필터, Task 기반 완료율 |
| `/projects/:id` | Project Workspace | Overview/Tasks/Notes/Events/Library, 연결된 항목 추가/편집 |
| `/library` | Library | URL CRUD, 유형/프로젝트 필터, 안전한 외부 링크 |
| `/settings` | Settings | Account/Logout, Workspace 이름, Appearance, Coming later |

로그인하지 않은 상태에서는 URL을 유지하며 가입/로그인 화면을 표시합니다. 설정이 없으면 연결 안내를 표시하고 인증 요청을 시작하지 않습니다. 알 수 없는 경로는 Home으로 이동하며 존재하지 않는 프로젝트는 목록 복귀 링크를 제공합니다.

## 공통 패턴

- 상단 생성 버튼/항목 제목을 눌러 공통 Entity 편집기를 엽니다.
- native dialog가 포커스를 가두며 Escape/닫기/취소로 돌아갑니다. 닫힌 뒤 시작 요소에 포커스를 복원합니다.
- 작업의 checkbox 버튼으로 완료/미완료를 전환하며 저장 동안 중복 동작을 막습니다.
- 삭제는 명시적 확인을 거칩니다. Project 삭제가 관련 내용은 유지한다는 점을 안내합니다.
- 초기/재조회 로딩, 오류와 재시도, 빈 목록, 저장 실패 입력 유지, 설정/Inbox 성공 안내를 제공합니다.
- 프로젝트 이름은 상세 화면 링크입니다. 일정은 기기 시간대로 표시합니다.
- Notes의 HTML은 텍스트로 취급하고 URL은 HTTP(S)만 링크로 표시합니다.

## 반응형

기존 넓은 화면 246px Sidebar, 중간 화면 218px, 760px 이하 메뉴/배경 닫기, 520px 이하 단열 구조를 이어갑니다. 폼은 작은 화면에서 한 열이 되고 Modal은 viewport 높이 안에서 스크롤합니다. Calendar는 7열을 유지하고 작은 셀에는 제한된 항목만 표시하며 전체 목록은 날짜 상세 영역에서 조회합니다. 터치/키보드 입력과 focus-visible을 제공합니다.

Android/Tablet 전용 앱은 v1.0에서 개발합니다. 현재는 모바일 브라우저에서 사용 가능한 웹 Layout입니다. 전역 Command Palette/단축키 시스템은 v0.4 범위입니다.
