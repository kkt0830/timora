# Changelog

## 0.3.1 — Issue #13 안정화 (2026-10-20)

- 명확한 SQL 데이터 거부를 durable outbox 실패 상태로 보관하고 독립된 전송/pull 계속 처리.
- 같은 entity/Project 의존성 보류, 실패 원문/현재 내용 비교 및 확인 후 최신 상태 재시도.
- RPC 데이터·권한 오류와 실제 인증 실패를 구분; network/5xx/응답 유실의 operation ID 유지.
- 공백 포함 URL 저장·재시도 정규화. 정상 URL 및 최초 import/원격 수신의 원문 보존.
- 새 기기의 미편집 settings를 Cloud baseline으로 초기화. 이전 기기의 설정/대기 변경 보존.
- 프로필 메뉴를 modal top-layer와 viewport bounds/scroll로 표시, 닫기 touch의 배경 실행 방지.
- 반복 가져오기 안내를 실제 자동 Sync 정책과 일치시킴.
- SQLite schema 4 additive migration, 앱/패키지 0.3.1, Android versionCode 3002.

운영 Supabase schema/RLS/RPC 변경 없음. Netlify production 재배포 없음.
실제 사용자 두 기기/세션 회전/IME 검수와 서명 연속성은 별도 gate입니다.
실제 APK 결과와 다운로드는 [verification](docs/verification.md)을 확인하세요.
