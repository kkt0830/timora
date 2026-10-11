# v0.3 Android Manual Acceptance

기존 Android Tablet basic smoke: **사용자 보고로 앱 실행·기본 UI/Workspace에 특별한 문제 없음 확인**.
모델/Android/WebView/상세 CRUD 범위는 미제공이며 포괄적 PASS를 의미하지 않습니다.
이번 계정 유지·사진·Phone 실기기 결과: **PENDING**. CI/에뮬레이터/브라우저 fixture로 체크하지 않습니다.
Windows 합격 기록은 기존 [manual-acceptance-v03.md](manual-acceptance-v03.md)를 유지합니다.

기록: tester / 날짜 / 기기 모델 / Android 버전 / WebView 버전 / keyboard 이름·버전 /
artifact commit SHA / application ID / app version / 각 항목 PASS 또는 오류.
개인 DB·비밀번호·토큰·Note 본문을 공개 PR에 첨부하지 않습니다.

## A — Install

- [ ] 성공한 Android Actions의 arm64 debug APK를 비어 있는 테스트 프로필에 설치한다.
- [ ] 새 설치는 공유 로그인/가입 화면, 로그인 후 Local Workspace. 과도한 permission/crash 없음.
- [ ] Local Workspace와 DB 위치가 열리고 app-private sandbox 경로다.

## B — Offline launch (첫 온라인 로그인 후)

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

- [ ] Network ON → 같은 계정 연결 → Cloud login → counts preview → 확인 → import.
- [ ] 원본 ID/관계/날짜/원문/시각 보존 및 Cloud 내용 불변 확인.
- [ ] Network OFF → local edit → force-stop/relaunch → 보존.
- [ ] 기존 로컬 자료/반복 import를 덮어쓰지 않음. password/token 미저장 정책 확인.

필수 A~H가 실제 기기에서 PASS여야 Android 완료로 표시합니다.
I를 생략했다면 실제 사용자 Cloud import는 Needs verification으로 남깁니다.
APK/CI만 PASS인 경우 검증 후보 상태를 유지합니다. 이번 변경은 새 PR 없이 version/v0.3에 반영합니다.

## J — Native account / private photo (새 개선 필수 gate)

아래는 기존 Tablet smoke와 별도로 **새 source APK**에서 실제 확인합니다. 개인 기록이 있는
앱을 삭제하지 말고 같은 서명 업데이트 또는 비어 있는 별도 기기 테스트 프로필을 사용합니다.

- [ ] 새 설치: 로그인/회원가입 UI → 실제 계정 A 인증 → Home. 메일 확인 뒤 앱 재로그인 가능.
- [ ] Task/Note 저장 → 강제 종료 → 재실행: 같은 계정/로컬 기록.
- [ ] 비행기 모드/Wi-Fi OFF → 강제 종료 → 재실행: 로그인 화면 없이 로컬 CRUD 가능.
- [ ] Supabase 연결 실패/Cloud session 만료에서도 로컬 기록 보존/사용 가능.
- [ ] Profile Cloud 재인증 필요 상태 → 네트워크 복귀 → A 재인증, local UUID/기록 불변.
- [ ] Logout 확인 취소는 기록을 계속 사용, 승인은 Login UI. 강제 종료 후에도 Login UI.
- [ ] Logout 후 A 재로그인으로 자료 복원. B 로그인/가져오기 거부, A 기록 비노출·보존.
- [ ] 기존 v1 업데이트: UUID/자료/설정 유지, 연결/Later 안내, 연결 시 기존 기록 보관.
- [ ] Profile PNG/JPEG/WebP 선택 → 실제 Android picker → 사진 저장. broad media 권한 없음.
- [ ] 시스템 picker 취소/읽기 불가/10 MB 초과/손상 파일은 기존 사진을 보존하고 오류 안내.
- [ ] 원본 gallery 파일 삭제 → 강제 종료 → 재실행 → 사진/닉네임 유지.
- [ ] 오프라인 → 강제 종료 → 재실행 → 사진 유지. Profile와 sidebar 같은 사진.
- [ ] 사진 제거/닉네임 수정 → 재실행/offline 유지. 사진 파일 Cloud 업로드 없음; 닉네임 설정은 자동 Sync 대상.
- [ ] Tablet과 별도로 Phone portrait/landscape/키보드/Back를 확인. 미수행은 PENDING.

상태: 위 J 전체 PENDING. CI의 mocked Auth/IPC, seed한 anonymous DB, SQLite reopen은
실제 Supabase 첫 로그인→Native process restart를 대체하지 않습니다.


## 자동 Cloud 동기화 — 추가 실기기 gate (2026-10-11)

상태: **PENDING**. 기존 개인 앱을 삭제/초기화하지 않습니다. 같은 서명의 업데이트와
운영 sync migration이 준비된 상태에서 확인합니다. 첫 업데이트 시 같은 계정으로 Cloud
재인증하여 OS refresh credential을 저장합니다. APK/installer source와 결과를 기록합니다.

- [ ] 비행기 모드에서 Project 및 연결된 Task/Note 저장, 앱 완전 종료·재실행 후 기록 유지.
- [ ] 인터넷을 켜고 앱으로 복귀: 별도 가져오기 없이 대기 개수가 0으로 줄어들고 Cloud에 UUID/내용/관계가 한 번 저장됨.
- [ ] 같은 계정의 두 번째 기기를 온라인에서 열어 같은 기록 확인. 운영 v0.2 웹에서는 새로고침 후 확인.
- [ ] 두 번째 기기 수정·삭제가 첫 기기 온라인 복귀/30초 확인에 반영되며 삭제가 다시 생성되지 않음.
- [ ] 같은 항목을 두 기기에서 오프라인 수정 후 연결: 충돌 화면에서 양쪽 내용 보존. 각각 이 기기/Cloud 선택을 확인.
- [ ] 원격 Project 삭제와 로컬 child 편집 충돌: Project 선택 후 child 본문 보존, 연결 해제 또는 Project 복구, 전송 이어짐.
- [ ] 전송 중 연결 끊기·재연결: 대기 기록 유지, 동일 항목 중복 생성 없음.
- [ ] 앱 강제 종료 후 온라인 재실행: Cloud 재인증 입력 없이 OS credential로 전송 가능. 재인증 필요 오류가 나면 기록 보존·같은 계정 복구 확인.
- [ ] 명시적 로그아웃 후 재실행은 로그인 화면/로컬 잠금. 다른 계정은 기존 기록 비노출, 원래 계정은 기록 보존.
- [ ] 기존 사진·Task 날짜 그룹·IME·Back 회귀. 사진 파일은 Cloud로 전송하지 않음.

자동 emulator의 암호화 refresh fixture는 실제 Supabase 세션 회전/두 사용자 기기 인증을
대체하지 않습니다. 앱 완전 종료 중에는 전송하지 않고 다음 실행에서 이어갑니다.
