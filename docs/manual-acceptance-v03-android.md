# v0.3 Android Manual Acceptance

현재 실제 기기 결과: **PENDING**. CI/에뮬레이터/브라우저 fixture로 체크하지 않습니다.
Windows 합격 기록은 기존 [manual-acceptance-v03.md](manual-acceptance-v03.md)를 유지합니다.

기록: tester / 날짜 / 기기 모델 / Android 버전 / WebView 버전 / keyboard 이름·버전 /
artifact commit SHA / application ID / app version / 각 항목 PASS 또는 오류.
개인 DB·비밀번호·토큰·Note 본문을 공개 PR에 첨부하지 않습니다.

## A — Install

- [ ] 성공한 Android Actions의 arm64 debug APK를 비어 있는 테스트 프로필에 설치한다.
- [ ] Cloud 설정 없이 Timora가 실행되며 crash/과도한 permission 요청이 없다.
- [ ] Local Workspace와 DB 위치가 열리고 app-private sandbox 경로다.

## B — Offline launch

- [ ] 앱을 완전히 종료하고 비행기 모드를 켠다. Wi-Fi도 꺼져 있는지 확인한다.
- [ ] 설치 APK로 실행한다. 개발 Vite 서버나 Cloud 연결 대기 없이 열린다.
- [ ] Home/Today/Inbox/Tasks/Notes/Calendar/Projects/Library/Search/Profile/Settings가 열린다.
- [ ] 초기 빈 데이터/Loading/Error/Retry 안내가 정상이다.

## C — Offline CRUD

- [ ] Project 생성·수정, 연결된 Task/Note/Event/Library 생성·수정.
- [ ] Task 완료↔미완료, priority/start/due/filter/delete; Note Markdown/preview/delete.
- [ ] Inbox 빠른 기록·수정·분류 및 Task/Note 이동에서 원문 보존·원본 제거.
- [ ] Event Calendar 표시/수정, Library URL metadata 저장/삭제, 로컬 Search.
- [ ] Workspace 이름/Profile/Appearance 저장; Project 삭제 후 하위 자료 보존·연결 해제.
- [ ] 저장 실패를 재현했다면 draft 보존/Retry 결과를 기록한다. 임의 DB 손상을 만들지 않는다.

## D — Persistence / process kill

- [ ] C의 각 Entity 및 설정 일부를 저장해 남긴다. 삭제한 기록도 구분한다.
- [ ] Background → Recent Apps 제거 → 시스템 앱 설정 '강제 종료' 또는 adb force-stop.
- [ ] 비행기 모드를 유지한 채 Timora를 다시 실행한다.
- [ ] 6개 Entity/settings/관계/날짜/완료/Markdown이 유지되고 삭제 기록은 돌아오지 않는다.
- [ ] Local identity와 DB 위치가 유지된다. 미저장 draft는 재시작 복구 대상이 아니다.

## E — Task groups

- [ ] overdue/today/week/month/later/90+ days/unscheduled/과거 완료 작업을 만든다.
- [ ] 중복 없는 분류/count/collapse/status·priority·project·period filter/date presets/range 표시.
- [ ] 장기 Task/Today의 활성 범위 규칙과 재실행 후 접기 preference 보존.

## F — 실제 Korean IME

- [ ] Samsung Keyboard에서 Search/Task title/Note editor에 `안녕하세요`를 입력한다.
- [ ] 연속 입력/Backspace/한·영 전환/조합 확정 뒤 이동에서 중복·유실이 없다.
- [ ] 가능하면 Gboard에서 같은 검사. 사용하지 못한 keyboard는 미검증으로 표시한다.

## G — Lifecycle / drafts

- [ ] 미저장 Note/Task/Inbox 입력 중 Home 버튼 → 다른 앱 → Timora 복귀에서 입력 유지.
- [ ] Workspace가 초기화되거나 Cloud 로그인 화면으로 이동하지 않는다.
- [ ] 저장 중 background/foreground 후 기록을 다시 열어 확인한다.
- [ ] 회전 후 폼/DB가 유지된다. process kill 이후에는 저장된 DB만 복구한다.

## H — Mobile UX

- [ ] Portrait/landscape/작은 화면/long Note scroll/Markdown preview/Calendar 7열.
- [ ] Search/Task/Note/Inbox/Project/Profile/Settings keyboard 입력과 저장 버튼 접근.
- [ ] status/navigation bars/gesture/cutout/IME와 UI가 겹치지 않는다.
- [ ] 모든 completion/menu/calendar/day/delete/group controls의 44px 터치 영역.
- [ ] Back: 필요 시 IME 닫기 → 편집기(미저장 확인/저장 중 보호) → popover → drawer → 이전 route.
- [ ] Home root의 Back은 정상 OS 동작이며 데이터 삭제를 실행하지 않는다.
- [ ] Library 및 Markdown HTTP(S) 링크가 외부 브라우저/앱에 열리고 복귀하면 draft/자료가 남는다.

## I — Optional Cloud import

별도의 **빈 테스트 Workspace**에서만 검사합니다. 개인 로컬 기록을 지우지 않습니다.

- [ ] Network ON → Cloud login → counts preview → 확인 → import.
- [ ] 원본 ID/관계/날짜/원문/시각 보존 및 Cloud 내용 불변 확인.
- [ ] Network OFF → local edit → force-stop/relaunch → 보존.
- [ ] 기존 로컬 자료/반복 import를 덮어쓰지 않음. password/token 미저장 정책 확인.

필수 A~H가 실제 기기에서 PASS여야 Android 완료로 표시합니다.
I를 생략했다면 실제 사용자 Cloud import는 Needs verification으로 남깁니다.
APK/CI만 PASS인 경우 release candidate와 Draft PR 상태를 유지합니다.
