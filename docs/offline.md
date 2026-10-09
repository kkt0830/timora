# Offline — Timora v0.3

## 지원 범위

Windows/Android 핵심 Workspace는 SQLite working store입니다. 네트워크나 Supabase 로그인/토큰이
없어도 local identity와 저장된 데이터를 열고 CRUD·완료·날짜/Project 필터·검색·설정을
사용합니다. UI는 native transaction 완료 뒤 갱신되며 실패한 입력은 편집기에 남습니다.

Library는 URL과 metadata만 저장합니다. 외부 웹사이트/PDF/Video의 본문·파일·avatar를
오프라인에 캐시하지 않습니다. Web은 기존 Supabase adapter이며 Web 자체의 오프라인 편집
또는 PWA cache를 구현하지 않았습니다. 브라우저 새로고침과 Native 앱 재시작은 다른 검사입니다.

## Local 저장과 identity

로컬 데이터는 app_data_dir/timora.db에 있습니다. local_identity UUID는 DB 파일을
닫았다 열어도 유지되고 Cloud 사용자 UUID와 분리됩니다. 하나의 로컬 Workspace를
OS 계정의 앱 데이터 디렉터리에서 사용합니다. SQLite에는 Cloud RLS가 적용되지 않습니다.
DB는 암호화되지 않으며 OS 계정/디스크 권한에 의존합니다. 파일에 접근 가능한 다른 프로그램은
내용을 읽을 수 있습니다. OS credential vault/custom crypto를 추가하지 않았습니다.

## Cloud → Local 최초 가져오기

1. **로컬에 core Entity를 만들기 전** Settings → Cloud 가져오기 / DB 위치로 이동합니다.
2. Timora Supabase URL/Publishable key와 확인된 Cloud 계정 이메일/비밀번호를 입력합니다.
   URL/key는 공개 설정이며 service_role/Secret key를 사용하지 않습니다.
3. 로그인 후 미리보기에서 6개 Entity 개수를 확인합니다. 아직 로컬 쓰기는 없습니다.
4. 가져오기 확인을 누르면 빈 로컬 DB에만 하나의 transaction으로 적용합니다.
5. 완료 뒤 로컬 편집만 수행합니다. Cloud/Web에는 자동 반영되지 않습니다.

Cloud 세션은 별도의 메모리 Storage에서만 유지하고 finally에서 logout/clear합니다.
입력한 비밀번호/인증 토큰을 SQLite/localStorage/log에 저장하지 않습니다. 가입·메일 확인은
Web에서 수행합니다. core Entity가 이미 있으면 덮어쓰지 않고 중단합니다. 기록을 모두
삭제한 뒤 가져오기를 다시 실행해 중복시키는 것도 imported_at으로 막습니다.

원본 Entity UUID, 관계, Markdown/설명/URL, date-only 및 RFC3339 시각,
created_at/updated_at과 profile/settings를 보존합니다. 로컬 행 user_id는 local UUID로
매핑하고 Cloud UUID를 local_identity.cloud_user_id에 보관합니다. 이 ID 변화는
Cloud 로그인에 의존하지 않는 독립적 로컬 소유권을 위한 결정입니다.

Cloud 조회는 RLS와 user_id filter, 500행 pagination을 재사용합니다. native importer는
다른 Cloud owner/잘못된 UUID·날짜/FK/중복/invalid settings를 거부하고 전체 rollback합니다.
Cloud 동시 편집 중 일관된 snapshot을 보장하지 않으므로 가져오는 동안 다른 기기에서
편집하지 않는 것을 권장합니다. 재조회/로그인 실패 후에는 Local Workspace를 그대로 사용합니다.

## Sync metadata와 삭제

| 값 | 의미 |
| --- | --- |
| sync_state=local | 이 로컬 DB에서 생성한 행 |
| sync_state=imported | Cloud에서 가져온 뒤 아직 로컬에서 수정하지 않은 행 |
| sync_state=modified | 가져온 행을 로컬에서 수정했거나 Project 연결을 해제한 행 |
| remote_updated_at | 최초 가져온 Cloud updated_at; 이후 로컬 편집에서 보존 |
| tombstones | imported 행 삭제의 table/UUID/원격 시각/삭제 시각 |

로컬에서만 생성한 행 삭제는 물리 삭제합니다. imported 행 삭제는 transaction 안에
원격 기준 시각을 가진 tombstone을 남긴 뒤 물리 삭제합니다. Project 삭제는 하위 내용을
보존하고 project_id=NULL 및 modified 상태를 갱신합니다. imported Inbox 이동도 원본 삭제
tombstone을 남깁니다. settings에는 현재 별도 sync metadata/outbox가 없습니다.

이는 **실제 동기화 기능이 아닙니다**. network online 이벤트도 Local repository 재조회일
뿐이며 Cloud pull/push를 실행하지 않습니다. sync outbox/retry/backoff/conflict resolution/
다중 기기 merge는 v0.4에서 설계합니다. 별도 서버 revision, Clock skew, 삭제 부활 방지,
owner 매핑과 settings 충돌을 확정한 뒤 지원해야 합니다.

## 보존 및 오류

migration/손상/newer-version 오류는 자동 reset하지 않습니다. 앱 완전 종료 후 DB/WAL/SHM
보관, 오류 기록, 버전/경로 확인 순서로 진단합니다. 데이터 초기화를 일반 해결책으로 사용하지
않습니다. 백업/복원 UI, DB encryption, 다중 Workspace와 연속 Cloud 가져오기는 미지원입니다.
자동 검사와 Windows 수동 합격은 [verification](verification.md)에 구분합니다.

## 명시적인 개인 자료 제거

개별 자료는 기존 CRUD 삭제/확인으로 제거합니다. 전체 로컬 자료를 정말 제거하려면 앱을
완전히 종료하고 필요한 백업을 별도로 보관한 뒤, Settings에 표시된 앱 데이터 디렉터리의
DB/WAL/SHM 파일을 명시적으로 제거할 수 있습니다. 이 경우 local identity와 import 기록도
사라지고 다음 시작은 새 Workspace가 됩니다. Cloud 자료는 삭제되지 않습니다.
이것은 사용자가 선택하는 삭제 절차이며 오류 복구/일반 테스트를 위해 자동 실행하지 않습니다.
앱은 workspace 내용·비밀번호·토큰을 log에 출력하지 않으며 native SQL 오류만 UI로 반환합니다.

## Android 및 기기별 독립성

Android는 app-private files의 같은 SQLite schema와 로컬 identity를 사용합니다.
Windows DB를 Android에 직접 연결하거나 공용 파일을 동시 사용하지 않습니다. 각 Device의
DB는 독립적이며 online 상태여도 기기 간 데이터가 자동 전송되지 않습니다.
Cloud import는 초기 한 번이며 자동 Sync/Backup이 아닙니다. Android OS 자동 backup도 끕니다.

Background/foreground는 기존 draft 메모리를 유지하며 Local repository를 재조회합니다.
process kill 후 복구하는 것은 commit된 DB 기록입니다. 미저장 draft 자동 복구는 없습니다.
Android permission/Signing/Back/IME 및 실제 기기 gate는 android.md와 manual-acceptance-v03-android.md를 참고합니다.
