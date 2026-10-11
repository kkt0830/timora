# Requirements — Timora v0.3

기존 v0.2 UI/서비스와 main에 병합된 Windows v0.3(PR #7)을 보존하며
이번 자동 동기화 개선은 version/v0.3에 새 PR 없이 직접 반영합니다. 각 플랫폼 실제 오프라인 재실행·IME
합격이 정식 완료 조건입니다. Windows 구현 이력을 삭제하지 않습니다.

이전 단계의 결정과 이번 추가 범위를 함께 기록합니다. 자동 Sync 제외와 메모리 인증
fallback은 아래 2026-10-11 추가 요청으로 대체했습니다.

## 기존 Local-first 필수 범위

- Tauri 2, Windows 11 우선, 재사용하는 React UI/디자인/9개 화면/Profile/Search.
- 실제 SQLite 파일, 앱 데이터 디렉터리, 안정된 로컬 UUID, versioned transaction migration.
- 새 Native 설치는 공유 회원가입/로그인으로 시작. 첫 로그인 후 Local Identity를 보존하고
  재실행/오프라인/Cloud 오류·만료에서 핵심 CRUD·검색·설정 사용 유지. 기존 익명 DB는 보존.
- 6개 Entity CRUD, Task 완료/priority/start/due/Project, Markdown, Calendar,
  Project 상세, Inbox 원자적 Task/Note 변환. Project 삭제는 연결만 해제합니다.
- 명시적 Cloud → Local 최초 가져오기: 로그인·미리보기·확인, 빈 로컬만 허용,
  원본 ID·관계·원문·시각 보존, 실패 전체 rollback, 반복/덮어쓰기 거부.
- Task 그룹·개수·접기·기간 필터·날짜 프리셋·기간 및 남은 일수.
- 기존 Web Auth/CRUD/RLS/Netlify build 보존. 승인한 additive sync schema만 추가하며 기존 기록 보존.
- SQLite 파일 재열기·검증 오류·FK·가져오기·날짜 경계 테스트, Web/browser/RLS 회귀,
  Windows 빌드 및 Wi-Fi 차단/완전 종료/재실행/한국어 IME 수동 검사.

## 구현 결정

- `WorkspaceRepository`를 Local/Supabase 두 adapter로 구현합니다. LocalAuth는
  SQLite identity를 반환하며 첫 로그인/재인증에 메모리 Supabase Auth를 사용합니다.
  Cloud user proof는 Native에서 다시 확인합니다. Web은 기존 인증 유지.
- plugin에 임의 SQL/파일/쉘 권한을 주지 않고 allowlist CRUD command를 사용합니다.
  HTTP(S) 외부 링크만 scoped opener로 기본 브라우저에 엽니다.
- Local schema v1에 `remote_updated_at`, `sync_state`, imported 행 삭제 tombstone을
  포함합니다. 이는 후속 Sync 준비 정보이며 전송 큐·자동 sync를 의미하지 않습니다.
- 로컬 행 user_id는 local UUID, Cloud owner 매핑은 local_identity에 보관합니다.
  Entity UUID/날짜/created_at/updated_at/content/project_id는 최초 가져오기에서 보존합니다.
- Task date-only / Event RFC3339 instant / Today day-overlap 규칙을 공유합니다.
  주는 월~일, 장기는 시작~마감 차이 90일 이상. 과거 완료 기록 그룹을 추가해
  완료 작업이 기한 지남·미래 할 일로 보이는 것을 방지합니다.
- DB 암호화는 제외합니다. OS credential vault를 통한 refresh 복원은 2026-10-11 요청에서
  추가하며 비밀번호/토큰을 SQLite/localStorage에 저장하지 않습니다.
- Desktop HashRouter, Web BrowserRouter. Custom titlebar 대신 native window를 유지합니다.

## 제외 및 release gate

Routine/Journal/Today Sentence,
GitHub Integration, Relations/Graph, 파일 첨부·업로드·Drawing, 다중 Workspace,
Web 오프라인 편집, DB encryption, updater/code signing, macOS/Linux packaging은 제외합니다.
손상·migration 실패 시 DB를 자동 삭제/복구하지 않습니다.

[Manual acceptance](docs/manual-acceptance-v03.md)의 A~E 및 Windows build가 합격해야
정식 v0.3 완료로 표시합니다. 미완료이면 검증 후보/Draft PR로 유지하고 한계를 공개합니다.
Issue #4를 전체 close하지 않으며 Issue #5와 관련된 실제 구현/검증 범위만 보고합니다.

## Android 확장 결정

- Tauri 2 Android / application ID app.timora.android / minimum API 24 / ARM64 테스트 APK.
- Shared React/domain/contracts/repository/Rust SQLite/migration/metadata. Android 전용 schema 없음.
- Native runtime 감지/capability 경계, shared HashRouter/HTTP(S) opener. Web Supabase adapter 보존.
- MainActivity에서 system Back과 system bars/cutout/IME resize. 기존 44px Drawer UI 유지.
- 미저장 Entity 폼 Back 확인. background/foreground draft는 유지, process kill draft 복구 미구현.
- app_data_dir sandbox에 DB 저장, INTERNET 외 broad storage permission 없음, DB 암호화 없음.
- Windows/Android DB는 독립적인 파일이며 같은 계정의 Cloud를 통해 동기화. 동일한 빈 DB 최초 import 정책.
- 재현 가능한 generated native 소스/Gradle wrapper commit, cache/.so/secrets/keystore 제외.
- APK는 debug test signing; Store/production signing/update/notifications/widgets/share sheet 제외.
- Android CI compile/APK/signature/emulator offline IPC/process termination; Windows exe/NSIS와 Web/RLS 회귀 유지.
- 실제 기기 A~H gate는 docs/manual-acceptance-v03-android.md. CI/fixture로 수동 PASS를 대신하지 않음.

## Native account/profile 개선

- 기존 singleton local_identity를 schema v2로 transaction migration, UUID/기록/소유권 보존.
- Identity와 Cloud 세션 분리; Local-only/온라인/오프라인/Cloud 재인증 상태.
- 명시적 Logout 후 local IPC 잠금, 데이터/사진 보존, 같은 계정 복구, 다른 계정 연결/import 거부.
- Native 시스템 사진 선택→타입/용량/디코딩 검증→private PNG 복사; 오프라인/원본 삭제 보존.
- 닉네임 offline 저장; Web HTTPS URL 프로필 회귀 보존. 사진 Cloud Storage 업로드 제외.
- 초기 account/profile 단계는 메모리 fallback을 선택했고 이후 자동 Sync에서 OS secure refresh 복원으로 확장.
- 사용자 보고 Tablet basic smoke만 확인. 새 계정 유지/사진/Phone/Windows 실제 gate는 별도 대기.

## 2026-10-11 자동 Cloud 동기화 추가 요청

위 메모리 fallback/Sync 제외는 이전 account/profile 단계의 결정입니다. 사용자가 Android 앱과 Cloud 가져오기 성공을 확인하고 오프라인 기록의 자동 전송과 기기 간 연결을 요청하여 다음을 v0.3에 추가합니다.

- SQLite v3 durable outbox와 기존 기록 migration, foreground 자동 push/pull, 삭제 전파와 요청 receipt 재전송.
- owner-bound Supabase RPC/RLS, commit-order revision/cursor 및 기존 Web CRUD capture.
- 충돌 시 로컬 내용 보존과 명시적인 이 기기/Cloud 선택.
- Android Keystore/Windows Credential Manager에 refresh credential만 보관. access token/비밀번호는 파일·SQLite/localStorage/log에 기록하지 않음.
- 앱 실행·화면 복귀·온라인 복귀·변경 저장·30초 foreground polling. 앱 종료 중 background worker, 사진 파일 업로드, Web 오프라인 편집, 백업 UI는 제외.
- 실제 두 SQLite 기기/서버 테스트, RLS/재전송/동시 편집/삭제 및 플랫폼 vault/로그아웃 회귀 검증. 실기기 검수는 별도이며 기존 데이터/사진을 지우지 않음.
