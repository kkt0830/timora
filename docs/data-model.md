# Data model — 개념 초안

`src/domain/models.ts`는 화면에서 사용할 **개념 모델**입니다. 실제 DB 테이블 또는 마이그레이션이 아닙니다.

## 객체

| 종류 | 공통 필드 외 주요 필드 | 지금의 화면 |
| --- | --- | --- |
| Task | status, priority, dueAt?, projectId? | Home, Today, Tasks |
| Note | excerpt, category | Notes |
| CalendarEvent | startsAt, endsAt, projectId? | Calendar, Home |
| Project | description, progress, color | Projects, Home |
| LibraryResource | resourceType, description | Library |
| InboxItem | content, capturedAt, processed | Inbox; 임시 기록으로 독립 처리 |

공통 `WorkspaceObject`는 `id`, `kind`, `title`, `createdAt`, `updatedAt`, 선택적인 `archivedAt`을 갖습니다. 현재 문자열 날짜와 ID는 예시이며 실제 서비스에서는 UTC 저장, 사용자 시간대 변환, ID 발급 방식 등을 확정해야 합니다.

## 관계 초안

`ObjectRelation`: `id`, `sourceId`, `targetId`, `kind` (`belongs_to` / `references` / `depends_on`). 방향은 중요합니다. 예를 들어 Task → Project의 `belongs_to`와 Note → Task의 `references`는 의미가 다릅니다. 샘플 `Task.projectId`는 단순 UI 표시를 위한 지름길이며, v0.3 관계 모델이 안정되면 정규화 전략을 결정합니다.

## 데이터 흐름 예시

Inbox에 생각 기록 → 유형 결정 → 새 Task/Note 생성 → 필요하면 Project에 연결 → Inbox 처리 완료. **현재 화면에서는 이 흐름이 실행되지 않습니다.** v0.1에서 변환의 원자성, 재시도, 중복 처리 규칙을 정의해야 합니다.

## 나중에 결정할 문제

- 개인 단일 공간부터 시작할지, 여러 Workspace 및 공유를 포함할지
- InboxItem을 별도 엔티티로 유지할지 공통 Object로 통합할지
- 프로젝트 진행률을 수동 입력할지 하위 작업에서 계산할지
- 관계의 삭제 정책, 순환 참조 허용 범위, 역방향 조회와 인덱스
- 첨부 파일 메타데이터와 실제 Storage 객체의 접근 권한
- GitHub 저장소·이슈 참조의 소유권 및 동기화 상태
- 동기화 버전, 충돌 처리, 복구와 백업 형식

실제 DB를 만들 때 사용자 소유권과 행 수준 접근 정책을 먼저 설계하고, 샘플 데이터가 운영 데이터로 유입되지 않도록 분리합니다.
