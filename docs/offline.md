# Offline — Timora v0.3 Account Persistence

## 계정과 Local Workspace

새 Native 설치는 공유 회원가입/로그인 화면으로 시작합니다. 첫 로그인/명시적 로그아웃 후
재로그인에는 인터넷이 필요합니다. 로그인 이후 저장된 Local Identity는 앱 강제 종료,
네트워크 장애, Cloud token 만료에도 유지됩니다. 시작 시 SQLite만 읽으며 Cloud 요청을
기다리지 않습니다. 기존 익명 schema v1은 기록/UUID를 보존한 LOCAL_ONLY로 migration됩니다.
Profile → 계정 연결을 선택할 때 기존 기록 연결을 확인하고, 나중에 선택하면 계속 로컬로 사용합니다.

| 표시 상태 | 의미 |
| --- | --- |
| LOCAL_ONLY | 기존 익명 Workspace, 계정 연결 전 |
| SIGNED_IN_ONLINE | 이 프로세스의 Cloud 인증 가능; 로컬에 저장, 전송 완료 여부는 별도 Sync 상태로 확인 |
| SIGNED_IN_OFFLINE | 연결한 계정과 Local Workspace 사용 가능, 인터넷 없음 |
| CLOUD_REAUTH_REQUIRED | Local Workspace 사용 가능, Cloud 기능은 다시 인증 필요 |

로그아웃은 사용자 확인 후 access_state만 signed_out으로 바꿉니다. DB/사진/설정/Cloud
기록을 지우지 않습니다. 로그아웃한 Workspace는 재실행 후 로그인 화면을 보여주며 native
CRUD/가져오기/프로필 IPC도 거부합니다. 같은 Cloud 계정으로만 다시 열 수 있고 계정 B의
연결/가져오기는 차단합니다. 익명 기록은 계정 연결 후 로그아웃을 제공합니다. 다중 Workspace는 없습니다.
이 잠금은 앱 수준의 접근 제한이며 DB 암호화/OS 사용자 잠금의 대체물이 아닙니다.

## Cloud 세션과 보안 선택

Native access token은 메모리에 두고 refresh credential은 Android Keystore/Windows Credential Manager에서 계정·서버별로 복원합니다. 비밀번호는 저장하지 않으며 SQLite/localStorage/log에 토큰을 기록하지 않습니다. 재시작 시 로컬 Workspace를 먼저 열고 보안 세션을 나중에 복원합니다. 온라인이면 토큰을 갱신해 Sync를 이어갑니다. Vault/Cloud 인증 실패는 로컬 사용자를 자동 로그아웃하지 않고 재인증을 안내합니다. 명시적 로그아웃은 로컬 잠금과 credential 제거 후 서버 logout을 best effort로 수행합니다. 자세한 rotation/동기화 계약은 [cloud-sync.md](cloud-sync.md)를 참고하세요.

Local DB/email/profile은 암호화되지 않습니다. Android app-private sandbox/backup 비활성화,
Windows OS 계정/디스크 보호에 의존하며 기기에 접근 가능한 사람은 앱을 열 수 있습니다.

## 프로필 사진

Native 시스템 선택기로 받은 PNG/JPEG/WebP만 지원합니다. 입력은 최대 10 MB,
디코딩 최대 8192×8192/128 MiB, 최종 이미지는 최대 256×256 PNG입니다. 앱 전용
profile/UUID.png로 복사하고 파일 쓰기 완료 후 local_identity.local_avatar를 갱신합니다.
원본 gallery/content URI를 DB에 남기지 않으므로 원본 삭제·재실행·오프라인에도 유지됩니다.
사진 선택/제거는 즉시 저장하고 닉네임은 프로필 저장 버튼으로 저장합니다. 오류/취소는 기존
사진을 보존합니다. 표시 우선순위는 로컬 사진 → Cloud HTTPS URL → 이니셜입니다.
로컬 사진을 Cloud로 업로드/동기화하지 않습니다. 외부 HTTPS 사진은 오프라인 보장을 하지 않습니다.

## Cloud → Local 최초 가져오기

1. 빈 Local Workspace에서 계정을 연결합니다. 기존 기록을 지우지 않습니다.
2. Settings → Cloud 가져오기. 연결한 계정으로 인증하고 counts를 확인합니다.
3. 확인하면 6개 Entity/settings를 하나의 transaction으로 가져옵니다.
4. UUID/관계/내용/date-only/RFC3339/시각을 보존하고 행 user_id만 local UUID로 매핑합니다.

다른 계정은 원격 Entity 조회 전 client에서 차단하고 native에서 다시 owner/binding을 검증합니다.
기존 로컬 기록/반복 import/잘못된 UUID·FK·시각·설정은 거부하고 전체 rollback합니다.
Cloud에는 읽기만 수행하며 독립적인 가져오기 세션은 finally logout/clear합니다.
가져오는 동안 Cloud 동시 편집은 일관된 snapshot을 보장하지 않습니다.

## Sync metadata와 제한

SQLite v3는 local/modified 기록과 기존 tombstone을 durable outbox로 seed합니다. online/focus/visibility와 로컬 저장이 CloudSyncService를 깨우고 foreground에서 30초마다 pull합니다. Project 삭제는 child 내용 보존/연결 해제이며 Inbox 이동은 transaction입니다. 앱 완전 종료 중에는 전송하지 않으며 다음 실행에서 이어갑니다. 동일한 Cloud 계정의 Windows/Android/Web이 기록을 주고받습니다.

Library는 URL/metadata만 저장합니다. 외부 PDF/Video/Web 본문을 캐시하지 않습니다.
Web은 기존 Supabase adapter이며 Web offline/PWA는 지원하지 않습니다. background draft는
메모리에 유지하지만 process kill 후에는 commit한 DB 기록만 복구하고 미저장 draft는 복구하지 않습니다.
migration 실패/손상/newer schema는 자동 초기화하지 않습니다. 앱 삭제/데이터 지우기는
보관한 로컬 기록을 잃게 하므로 로그인·서명·DB 오류의 일반 해결책으로 사용하지 않습니다.
백업/복원 UI와 다중 Workspace는 미지원입니다. 실제 검사 범위는 [verification](verification.md),
Android 실기기 검수는 [체크리스트](manual-acceptance-v03-android.md)에 기록합니다.
