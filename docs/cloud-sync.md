# Native Cloud 동기화

2026-10-11 사용자 요청으로 기본 자동 Sync를 `version/v0.3`에 추가했습니다. 로컬 기록과 기존 앱을 보존하고 같은 Supabase 계정의 기기들을 연결합니다. 구현/자동 검사와 실제 기기 합격은 구분합니다. 최신 빌드 결과는 [verification.md](verification.md)에 기록합니다.

## 사용 흐름

1. 공개 Cloud 설정이 포함된 최신 설치 파일에서 원래 계정으로 로그인합니다. 이전 버전에서 업그레이드한 경우 Profile → Cloud 다시 인증을 한 번 진행하면 refresh credential을 보안 저장소에 보관합니다.
2. Task/Note/Project/Event/Library/Inbox 및 Workspace/프로필 텍스트 설정을 저장합니다. 인터넷 여부와 관계없이 SQLite에 먼저 기록합니다.
3. 앱이 열려 있으면 저장·온라인 복귀·화면 복귀 시 전송하고, 30초마다 다른 기기 변경을 확인합니다. 앱 완전 종료 중에는 worker가 실행되지 않으며 다음 실행에서 이어갑니다.
4. 다른 기기도 같은 계정에 연결합니다. 로컬 owner UUID는 달라도 Entity UUID와 Cloud owner를 매핑해 주고받습니다. 다른 계정은 기존 Workspace에 연결할 수 없습니다.
5. Header 아이콘 / Settings / Profile → Cloud 동기화에서 전송 대기, 마지막 확인, 오류와 충돌을 봅니다. `지금 동기화`로 재시도할 수 있습니다. 인증 만료는 로컬 사용을 잠그지 않습니다.

기본 동기화는 최초 Cloud 가져오기 없이도 pull합니다. 기존 최초 가져오기는 빈 DB에서만 가능한 별도 기능이며, 자동 Sync가 이미 기록을 가져왔다면 다시 사용할 필요가 없습니다. 로컬 기록을 삭제해서 import를 열지 마세요.

## 저장과 재전송

Frontend → LocalWorkspaceRepository → native Database transaction → business row + outbox.
CloudSyncService → Supabase Auth 서버 사용자 확인 → `sync_apply`/`sync_pull` → native ack/page transaction.

HTTP 전송을 로컬 저장과 묶지 않습니다. SQLite triggers가 변경과 operation UUID를 원자적으로 기록합니다. 응답을 받지 못하면 outbox를 보존합니다. 서버는 owner/operation ID/request hash별 receipt를 돌려주므로 같은 요청 재시도가 생성/수정을 중복 실행하지 않습니다. 뒤에 생긴 로컬 편집은 ack 시 새 revision을 기준으로 이어서 전송하며 이전 응답으로 덮어쓰지 않습니다. push를 pull보다 먼저 수행하여 ack 유실을 잘못된 충돌로 처리하지 않습니다.

Cloud trigger는 기존 Web CRUD, Project 삭제에 따른 연결 해제와 Inbox 변환도 feed에 남깁니다. owner별 clock row lock으로 revision이 commit 순서를 따릅니다. pull은 최신 row/tombstone 및 Project dependencies를 같은 SQL snapshot으로 반환합니다. revision/cursor는 문자열입니다. 한번에 최대 200건 전송/페이지와 50페이지를 처리하고, 남은 작업은 다음 foreground 주기에서 이어갑니다.

## 충돌

같은 항목을 여러 기기가 수정했거나 삭제와 편집이 겹치면 자동 덮어쓰지 않습니다. 로컬 내용/삭제 의도와 최신 원격 내용을 보존합니다. 화면에서 양쪽을 펼쳐 확인한 뒤 선택합니다.

- 이 기기 내용 유지: 확인한 원격 revision을 기준으로 새 작업을 전송합니다. 그동안 원격이 또 바뀌면 다시 충돌합니다.
- Cloud 내용 사용: 해당 항목의 대기 변경을 취소하고 원격 내용을 적용합니다. Cloud에서 삭제된 항목은 로컬에서도 삭제합니다.
- 삭제된 Project와 대기 중인 child 편집이 겹치면 Project 충돌을 먼저 확인합니다. Cloud 삭제를 선택하면 child 내용은 보존하고 Project 연결만 제거합니다.

충돌된 항목과 연결된 child 전송은 보류하지만 다른 항목은 계속 처리합니다. 덮어쓰기 선택 전에 원문을 확인하세요. 자동 병합/충돌 사본 복제/변경 이력 복원 UI는 구현하지 않았습니다.

## 인증과 보안

기기 로그인 자격과 Cloud 토큰 유효 여부를 분리합니다. SQLite에는 계정 ID/email/서버만 보관하고 비밀번호·access/refresh token은 넣지 않습니다. access token은 메모리이며 refresh credential은 Android Keystore AES/GCM 암호화 private preferences / Windows Credential Manager에 계정·서버를 묶어 보관합니다. Vault 쓰기는 직렬화하고 회전 후 최신 credential을 저장합니다. Vault 실패는 경고와 Cloud 재인증으로 처리하고 로컬 데이터를 유지합니다. 지원 대상 외 플랫폼에는 plaintext fallback을 제공하지 않습니다.

로그아웃은 로컬 lock과 credential 제거를 먼저 처리하고 원격 logout은 best effort입니다. epoch/abort로 오래된 인증·동기화 응답을 차단합니다. 앱 수준 lock은 DB 암호화의 대체물이 아닙니다. Android backup 비활성화와 OS 계정 보호는 기존 정책을 유지합니다.

Cloud business RLS와 복합 Project FK를 유지합니다. RPC는 auth.uid()를 강제한 SECURITY INVOKER이며 공개 키만 사용합니다. private capture trigger만 제한된 SECURITY DEFINER입니다. Feed/receipts는 본인만 볼 수 있고 feed를 직접 변경할 권한은 없습니다. receipts는 owner 범위 INSERT/SELECT이며 UPDATE/DELETE는 허용하지 않습니다.

## DB 준비와 검증

새 Cloud 프로젝트: `db/schema.sql` → 002 Project indexes → 003 Profile → `20261010030830_native_workspace_sync.sql`. 기존 Timora Cloud에는 마지막 additive migration만 적용합니다. SQLite에는 Cloud SQL을 적용하지 않습니다. metadata seed는 원본 UUID/본문/날짜/updated_at을 변경하지 않습니다. 2026-10-11 사용자 승인 후 운영 Timora에 `timora_native_workspace_sync` 적용 완료, 기존 12개 business 행 개수 유지 및 owner-bound pull/권한 확인.

자동 테스트는 `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features`, `tests/sync.sql` 및 `tests/sync-integration.mjs`입니다. 통합 테스트는 실제 두 SQLite 파일/Rust와 실제 PostgreSQL/RLS를 사용하며 Auth HTTP만 fixture입니다. CI database job이 migration/RLS/두 기기 전송을 재현합니다. 운영 프로젝트에 테스트 bootstrap/fixture를 실행하지 않습니다.

실기기 확인: 오프라인 Task 저장 → 온라인 복귀 → 대기 0 확인 → 같은 계정의 다른 기기/웹에서 UUID와 내용을 확인 → 수정/삭제 양방향 → 동시 수정 충돌 선택 → 앱 강제 종료/재실행 후 Cloud 재인증 없이 전송 → 명시적 로그아웃/같은 계정 복구. 두 번째 계정에는 기록이 나타나면 안 됩니다.

## 제한

사진 파일은 기기에 남고 Cloud로 업로드하지 않습니다. 외부 자료 본문 캐시, Web 오프라인 편집, OS background worker, 다중 Workspace, 백업/복원/암호화 UI, tombstone/receipt 자동 정리는 제외합니다. 기기가 오랫동안 꺼져 있으면 온라인 앱 실행이 필요합니다. 이번 소스의 Web 다른 기기 반영은 foreground 30초 주기입니다. 운영 Netlify는 아직 v0.2이므로 새 기록 확인에는 새로고침이 필요합니다. 테스트 APK의 서명이 이전 설치와 다르면 기존 앱 위에 설치되지 않습니다. 기존 기록이 있으면 앱 삭제/초기화를 하지 말고 같은 서명의 업데이트를 준비해야 합니다.
