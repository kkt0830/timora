# v0.3 Windows Manual Acceptance

현재 결과: **PENDING**. 자동 테스트/Windows 빌드와 실제 PC 테스트를 구분합니다.
실제 실행 기록 없이 checkbox를 완료하거나 v0.3 정식 완료를 선언하지 않습니다.

기록: tester / 실행 날짜 / Windows 버전 / artifact의 commit SHA / 앱 버전 /
WebView2 버전 / 성공 또는 오류 메시지. 비밀번호·인증 링크·개인 DB를 공개 PR에 올리지 않습니다.

## A — Offline launch

- [ ] 성공한 Actions의 installer 또는 exe를 PC에 준비하고 새 설치는 온라인에서 첫 로그인 후 앱을 완전히 종료한다.
- [ ] Wi-Fi와 기타 인터넷 연결을 끊고 **설치된 production 앱**을 실행한다.
- [ ] 재인증·.env 입력 없이 저장된 계정으로 Home/Today/Tasks/Notes/Projects/Calendar/Inbox/Library/Search/Settings가 열린다.
- [ ] 빈 데이터 안내가 정상이고 Supabase 연결 대기 화면에 머무르지 않는다.

## B — Offline editing

- [ ] Project 생성, 수정; 연결된 Task/Note/Event/Library를 저장한다.
- [ ] Task 생성/수정/완료↔미완료/priority/start/due/filter/delete가 정상이다.
- [ ] Note Markdown 수정·미리보기·삭제 취소/확인, Event 수정/Calendar 날짜 표시가 정상이다.
- [ ] Inbox 기록 수정·분류·Task/Note 이동에서 원문 보존과 원본 제거를 확인한다.
- [ ] Library URL metadata 수정·삭제, Search 본문/프로젝트/URL 결과가 정상이다.
- [ ] Appearance/Workspace 이름/Profile 저장이 정상이다.
- [ ] Project 삭제 후 연결된 내용은 남고 프로젝트 연결만 해제된다.

## C — Persistence (release gate)

- [ ] B의 일부 자료를 남기고 앱 창을 닫아 프로세스가 완전히 종료됐는지 확인한다.
- [ ] 인터넷을 계속 차단한 채 다시 실행한다.
- [ ] Task/Note/Project/Event/Library/Inbox/Settings 및 완료·연결·날짜·Markdown이 그대로 유지된다.
- [ ] DB 파일 경로와 local identity가 유지되고 삭제한 자료는 다시 나타나지 않는다.

## D — Task groups

- [ ] 기한 지난 미완료/오늘/일요일 경계/이번 달 마지막 날/다음 달/90일 이상/무날짜 Task를 만든다.
- [ ] 그룹 개수, 중복 없는 분류, 펼치기·접기·재실행 preference를 확인한다.
- [ ] 오늘/주/월 필터, 날짜 프리셋 및 수동 날짜 입력, 장기 개월/년/남은 일수가 정상이다.
- [ ] 과거 완료 Task는 기한 지남으로 나타나지 않고, Today와 기간 중 미완료 Task 판정이 일치한다.

## E — Windows Korean IME

- [ ] 실제 Windows 한국어 IME로 검색창에 `안녕하세요`, 연속 타이핑, Backspace, 한/영 전환을 수행한다.
- [ ] 조합 중 글자가 중복되지 않고 검색 확정/라우팅이 입력을 깨뜨리지 않는다.
- [ ] 입력 확정 후 결과 열기, 뒤로/앞으로, 새로고침에서 검색어가 유지된다.
- [ ] 최소 창/창 크기 변경/키보드 Tab·Escape·dialog focus와 외부 HTTP(S) 링크를 확인한다.

## Optional Cloud import

기존 개인 로컬 자료를 삭제하지 말고 **별도의 새 OS 테스트 프로필/비어 있는 테스트 DB**에서 확인한다.

- [ ] 온라인에서 Cloud 계정 로그인 → counts → 확인 → 원본 ID/관계/내용/시각을 가져온다.
- [ ] 원격 데이터가 바뀌지 않고 로컬/Cloud identity가 구분된다.
- [ ] 반복 가져오기·로컬 기록이 있는 경우·잘못된 인증/관계 입력이 거부된다.
- [ ] 네트워크를 끊고 가져온 자료를 편집, 완전 종료/재실행한 뒤 그대로 유지된다.

Windows 10, 실제 사용자 Cloud import, 설치/업데이트 후 데이터 보존은 별도 결과를 기록한다.
모든 필수 A~E를 확인한 뒤 verification/README 및 PR Manual Verification을 실제 결과로 갱신한다.

## Native account/profile 개선 — 추가 실기기 gate

- [ ] 공개 설정을 포함한 같은 서명 installer에서 새 회원가입/로그인 → 로컬 기록 저장.
- [ ] 인터넷 차단 → 실제 Windows process 종료 → 재실행: 계정/기록 유지.
- [ ] Cloud 세션 재인증 필요/장애가 로컬 CRUD를 막지 않음.
- [ ] 명시적 logout은 기록/사진 보관, 같은 계정 재로그인 복원, B 접근/import 거부.
- [ ] v1 anonymous DB 업데이트: UUID/자료/설정 보관 및 optional 연결.
- [ ] Windows native 사진 선택 → private copy → 원본 삭제 → process 종료 → offline 재실행 보존.
- [ ] 선택 취소/손상/10 MB 초과 오류는 기존 사진 보존. 기존 IME/Back/WebView2 회귀.

새 개선의 Windows 실기기 결과는 PENDING입니다. Windows compile/NSIS 생성만으로 체크하지 않습니다.


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
