# Roadmap

버전은 방향을 나타내며 출시 날짜나 기술 선택을 확정하지 않습니다. 각 단계의 사용자 경험과 데이터 경계를 검증한 뒤 다음 단계로 이동합니다.

| 버전 | 방향 | 완료 판단의 출발점 |
| --- | --- | --- |
| Pre-v0.1 | Skeleton / 설계 | 9개 화면, 샘플 데이터, 탐색, 문서, 빌드 |
| v0.1 | Core Workspace | Core CRUD, Inbox Task/Note 이동, Auth 서비스, SQL/RLS, 실제 데이터 화면, Netlify 설정 구현. 전용 Supabase 적용·Netlify production 배포 완료; 사용자 실제 로그인·저장·새로고침 확인 |
| v0.2 | GitHub Integration | 연결/해제, 선택적 저장소 및 이슈 연결, 오류/권한 상태 표현 |
| v0.3 | Relations | 객체 간 관계 생성·조회·해제 및 연결된 맥락 탐색 |
| v0.4 | Global Search / Command / Quick Capture | 키보드 중심 탐색, 전역 검색, 빠른 기록과 분류 |
| v0.5 | Windows 설치형 Desktop App | 기존 데스크톱 UI를 설치형 앱으로 패키징, 업데이트와 로컬 통합 검토 |
| v0.6 | Sync / Offline | 클라우드 동기화와 오프라인 수정, 충돌 해결 정책 구현 |
| v0.7 | Backup / Security | 백업·복원, 데이터 내보내기, 인증·접근 제어 검토 |
| v0.8 | Performance / UX | 큰 데이터셋, 탐색 속도, 접근성, 오류 처리 정비 |
| v0.9 | Mobile Preparation | 모바일 정보 구조·API·동기화 계약 및 터치 UI 준비 |
| v1.0 | Android / Tablet + Multi-device Sync | 모바일 앱과 태블릿 UI, 장치 간 데이터 동기화 |
| v1.1 | Widgets / Notifications / Mobile Quick Capture | Android 위젯, 알림, 빠른 기록 진입점 |

## 단계 간 의존성

- GitHub 데이터는 핵심 객체를 대체하지 않고 외부 참조로 연결합니다.
- 관계, 검색, 모바일 UI는 안정된 객체 ID와 저장 계약 위에 만듭니다.
- 오프라인 편집 이전에 충돌/삭제/동기화 메타데이터 규칙을 확정합니다.
- 위젯은 모바일 앱의 인증·동기화·권한 정책이 마련된 후 추가합니다.

각 버전의 상세 범위는 개발을 시작할 때 이 문서에서 구체화합니다. v0.1에 후속 기능을 앞당겨 넣지 않습니다.

## v0.1 구현 상태

완료된 코드: 기존 9개 화면/반응형 셸 유지, Auth 흐름, 사용자 소유 Entity 및 Settings, Tasks/Notes/Projects/Events/Library/Inbox CRUD, Task/Note 원자적 Inbox 이동, Dashboard/Today/Month Calendar, Project 상세, Netlify fallback, 자동 검증.

서비스 연결: 서울 리전 Timora 프로젝트에 SQL/RLS/migration 적용, 실제 DB 권한 검사 통과, Netlify production 배포 및 SPA 경로 응답 확인. 실제 로그인/저장 확인 결과와 운영 제한은 docs/verification.md에 기록한다.

v0.2는 GitHub Integration에 집중한다. 연결/해제, Repository 참조, 권한/실패 UI와 토큰의 서버 보관 경계를 먼저 설계하며 내부 Project UUID를 외부 ID로 대체하지 않는다.

## v0.2 이후 개발 규칙

`main → version/v0.x → 개발 → 테스트 → PR → 검토 → main merge`를 따른다. 필요하면 version 브랜치 내부에서 feature 브랜치를 사용한다. Version PR은 개요/추가·개선 기능/구현 방식/코드/Database/UI·UX/버그 원인·수정/테스트/알려진 문제/다음 버전을 포함한다. Database 변경이 없으면 없다고 명시한다. 상세는 docs/git-workflow.md와 PR template을 따른다.
