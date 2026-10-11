# Timora Roadmap

v0.1 Core Workspace → v0.2 Design & Experience를 보존합니다. 사용자의 v0.3 요청에
따라 Windows/Android Local-first/Offline을 먼저 구현했습니다. 2026-10-11 사용자 요청으로 기본 자동 동기화를 v0.3에 추가하며 실기기 검증을 진행합니다.
출시 날짜는 확정하지 않습니다.

| 버전 | 방향 | 상태 / 판단 기준 |
| --- | --- | --- |
| Pre-v0.1 | Skeleton / 설계 | 기존 구조 보존 |
| v0.1 | Core Workspace | 실제 Supabase/Netlify, 로그인·저장 확인 완료 |
| v0.2 | Design & Experience | production 배포; Issue #4 버그/UI PR #6 main 병합 |
| v0.3 | Local-first Application Foundation | Windows + Android / SQLite / 최초 Cloud import / Task 그룹 / 계정 유지·로컬 사진·기본 자동 Sync/충돌 선택; 실제 기기 합격 대기 |
| v0.4 | Cloud Sync & Conflict Resolution | 기본 Sync 검증 이후 대규모 데이터·고급 충돌·백그라운드/오프라인 개선 범위 확정 |
| v0.5 | GitHub Integration | 안전한 인증·Repository/Issue 연결 |
| v0.6 | Object Relations | Backlinks·연결형 지식 구조 |
| v0.7 | Backup / Security | 검증된 백업·복원·로컬 데이터 보호 |
| v0.8 | Performance / UX | 큰 데이터·접근성·고급 검색 개선 |
| v0.9 | Mobile Maturity | Android/Tablet UX·성능·배포 안정화 |
| v1.0 | Stable Mobile / Multi-device Release | 성숙한 Android/Tablet 경험과 안정된 동일 Workspace 데이터 |
| v1.1+ | Widgets / Notifications / Automation | 모바일 기반 확장 |

Issue #5는 v0.3의 Task 날짜 그룹·범위·프리셋으로 구현합니다. 자동 검증과 실제 Desktop
수동 합격을 구분하며 미검증 상태에서 공식 완료로 표시하지 않습니다.
Issue #4의 한국어 검색·로고·Workspace 표시·노트 삭제 진입은 이미 반영한 코드를 유지합니다.
루틴·날짜별 일기·오늘의 문장은 [후속 Task](docs/issues/issue-4-workflow.md)이며
v0.3에 추가하지 않습니다. Notes/Inbox 첨부·Drawing·Project cover 및 Command Palette의
구체적인 버전 배정은 아직 확정하지 않았습니다.

## 개발 흐름

main → version/v0.x → 개발·검증 → PR → 검토 → main merge.
필요하면 버전 내부 Feature Branch를 사용합니다. PR에는 구현·DB·UI·테스트·수동 확인·
알려진 문제·다음 버전을 기록합니다. Windows v0.3 PR #7은 main에 병합됐습니다. Android 확장은 feature/v0.3-android → PR → 검토 → main 흐름입니다. 이번 계정/사진 개선은 사용자 요청으로 PR 없이 version/v0.3에 직접 커밋합니다.
main merge와 Netlify production 재배포는 이번 수정에서 실행하지 않습니다. 기본 Sync를 앞당긴 이유는 사용자의 오프라인 기록 자동 전송/다중기기 요청입니다.

Android 최초 구현 시점을 v1.0에서 v0.3으로 앞당긴 것은 사용자 요청에 따른 조정입니다.
기존 Desktop & Offline Foundation의 Windows 구현/검증 이력은 docs/desktop.md와 verification.md에 보존합니다.
