# Timora Roadmap

v0.1은 Core Workspace의 첫 정식 웹 버전입니다. 사용자의 v0.2 요청에 따라
기존 GitHub Integration 계획을 뒤로 옮기고 Design & Experience를 먼저 진행합니다.
출시 날짜는 확정하지 않습니다.

| 버전 | 방향 | 상태 / 판단 기준 |
| --- | --- | --- |
| Pre-v0.1 | Skeleton / 설계 | 기존 구조 보존 |
| v0.1 | Core Workspace | 실제 Supabase/Netlify, CRUD·로그인·저장 확인 완료 |
| v0.2 | Design & Experience | 디자인 시스템·프로필·Navigation·기본 Search; version/v0.2 검토 후보, production 미배포 |
| v0.3 | Desktop + Local DB Foundation | 제안: shell/SQLite adapter·로컬 저장 계약부터 검증 |
| v0.4 | GitHub Integration | 제안: 인증 토큰 서버 보관·Repository/Issue 연결 |
| v0.5 | Relations / Advanced Search | 제안: Backlinks·Object relations·Command Palette |
| v0.6 | Sync / Offline | 충돌·삭제·동기화 계약 |
| v0.7 | Backup / Security | 백업·복원·인증 보강 |
| v0.8 | Performance / UX | 큰 데이터·접근성·성능 |
| v0.9 | Mobile Preparation | API·터치·동기화 준비 |
| v1.0 | Android / Tablet + Multi-device | 동일 Workspace 데이터 |
| v1.1+ | Widgets / Notifications / Automation | 모바일 기반 위 확장 |

v0.3~v0.5는 사용자가 제안한 방향이며 다음 버전 착수 전 상세 범위를 확정합니다.
Notes/Inbox 첨부·Drawing, Project cover는 별도 Candidate입니다.

## 개발 흐름

main → version/v0.x → 개발·검증 → PR → 검토 → main merge.
필요한 feature branch만 사용하고 PR template의 구현·DB·테스트·한계를 기록합니다.
현재 v0.2에서는 GitHub Integration이나 Desktop App 자체를 구현하지 않습니다.
