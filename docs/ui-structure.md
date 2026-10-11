# UI structure — Timora v0.3

기존 Sidebar의 Workspace/Organize 그룹, 하단 Profile 메뉴, Header, 화면 구조를 유지하고 DESIGN.md 기반의 색상·간격·타이포그래피를 적용합니다. 현재 계정의 Workspace 이름·Inbox 개수·실제 데이터를 표시합니다. 기본 Search를 제공하고 미구현 알림 버튼은 표시하지 않습니다.

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
| `/profile` | Profile | 이메일 표시, 닉네임/HTTPS 사진 URL 저장·제거 |
| `/search` | Search | 6개 Entity 텍스트 검색, Object 편집기/Project 상세 이동 |

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

Desktop/Tablet은 232px Sidebar를 사용합니다. 760px 이하에서 264px Drawer와 배경 닫기를 제공하고, 520px 이하 폼/카드는 한 열로 전환합니다. 폼은 작은 화면에서 한 열이 되고 Modal은 viewport 높이 안에서 스크롤합니다. Calendar는 7열을 유지하고 작은 셀에는 제한된 항목만 표시하며 전체 목록은 날짜 상세 영역에서 조회합니다. 터치/키보드 입력과 focus-visible을 제공합니다.

Android v0.3는 같은 반응형 Layout을 Tauri WebView에서 재사용합니다. 실제 기기 검수는 별도이며 v1.0은 안정적인 Mobile/Multi-device release입니다. 전역 Command Palette/단축키 시스템은 후속 버전 범위입니다.

## v0.2 navigation and design

PR #6으로 반영한 Issue #4 UI: Sidebar user area의 ⋯ → 현재 Workspace 이름, Profile,
Settings, Logout. Workspace 이름 관리는 기존 Settings에서 한다. 가짜 전환 selector와
header의 중복 Workspace 이름을 제거하고 현재 화면명만 표시한다.
로고는 단일 t 노드를 중앙 정렬한다. NoteList의 `수정 / 삭제`는 기존 EntityEditor를
열며 삭제 확인/저장 로직을 그대로 재사용한다. Search는 draft와 URL query를 분리해
조합 중에는 URL/결과를 바꾸지 않고 composition 종료 후 확정한다.
Top-level Settings entry is removed, /settings remains. New /profile edits display
name/HTTPS avatar; /search finds all six object types with project/context metadata.
Results route to existing entity editors via ?object=UUID or Project detail; only
objects in the loaded user's dataset can open. Unknown/stale object IDs open no editor.

DESIGN.md Timora section overrides Apple marketing patterns. tokens.css supports
light/dark/system. Shared native fields, Button/IconButton, Popover, Avatar and Dialog
use 44px actions, focus-visible and Escape. Mobile drawer contains focus and makes
content inert. Error Retry remains; Header Refresh is removed. All nine original
features retain CRUD, filters, Project context and readable empty/loading/error states.

## v0.3 Desktop 및 Task 기간 UX

Windows/Android Native는 같은 경로를 `/#/tasks`, `/#/search?q=...`처럼 HashRouter로 사용합니다.
새 설치/명시적 로그아웃 후에는 공유 AuthPage를 표시합니다. 저장한 Identity/기존 익명 DB가
있으면 Local Workspace를 바로 열고 DB 오류는 Retry로 처리합니다. Native /account에서
기존 기록 연결 확인/나중에/Cloud 재인증을 제공합니다. 연결한 계정에는 데이터 보관 안내와
확인 후 로그아웃을 제공합니다. 익명 Workspace는 연결 전 로그아웃을 표시하지 않습니다.
`/cloud-import`는 Native local account에서만 접근할 수 있습니다. 로컬 시작 링크,
URL/public key/Cloud 로그인, counts 미리보기, 취소·확인·오류·완료 상태를 제공합니다.

Tasks는 필터를 적용한 결과를 상호 배타적인 그룹으로 표시합니다. 개수는 현재 필터 결과이며
빈 그룹은 표시하지 않습니다. 모든 결과가 비면 기존 Empty 상태를 표시합니다.
그룹 heading은 키보드 button/aria-expanded/aria-controls이며 접힌 결과는 hidden입니다.
접기 preference는 account별 localStorage에 보관하고 실제 객체 데이터는 DB에만 저장합니다.

분류 우선순위: 무날짜 → 과거 완료 → 기한 지난 미완료 → 90일 이상 장기 → 오늘/활성 범위
→ 이번 주(월~일, 오늘 제외) → 이번 달 → 나중에. 그룹은 하나지만 장기 활성 작업도
Today/오늘 필터에 나타납니다. 완료한 과거 기록은 별도 그룹에서 볼 수 있습니다.
주/월 필터는 해당 기간 날짜/현재 활성 범위/미완료 overdue를 포함합니다.
기간 프리셋은 date-only 값을 설정하고 수동 입력은 항상 가능합니다.
짧은 기간은 일수, 긴 기간은 약 개월/년과 정확한 일수, 미완료는 남은 일수/기한 지남을 표시합니다.

Desktop native titlebar/최소 800×600 창을 사용하고 외부 자료/Markdown 링크는 기본 브라우저를
엽니다. Web responsive UI 및 기존 IME composition 보호는 그대로 유지합니다.

## Android UX

기존 Drawer/Calendar/Task groups 유지. MainActivity Back → Dialog/Popover/Drawer/route,
미저장 Entity 폼 확인, root OS behavior. WebView는 system bars/cutout/IME inset으로 resize하고
editor는 visualViewport 높이 안에서 스크롤합니다. 실제 Korean IME/portrait/landscape/
외부 브라우저 전환은 Android manual acceptance에서 확인합니다. 새로운 Bottom navigation 없음.

Native Profile은 계정 email/작은 Cloud 상태/닉네임/시스템 사진 선택·제거/로컬 저장 안내를
표시합니다. UUID·DB 경로·import source ID는 primary Profile에 노출하지 않습니다. 사진은
선택 즉시 private-copy 저장, 닉네임은 저장 버튼입니다. Sidebar도 같은 로컬 사진을 사용하고
Web은 기존 HTTPS avatar URL 입력을 유지합니다.

## Cloud 동기화 화면

Native Header의 상태 아이콘, 프로필 메뉴 및 Settings/Profile → `/sync`. 전송 대기·충돌·마지막 확인·오류/재인증을 보여주며 수동 재시도와 양쪽 내용을 펼쳐보는 충돌 선택을 제공합니다. 선택은 확인 dialog를 거칩니다. 작은 화면은 header 아이콘만 표시하고 상세 화면에서 상태를 읽습니다. Web은 이 Native 화면 대신 기존 Supabase 저장 흐름을 사용합니다.
