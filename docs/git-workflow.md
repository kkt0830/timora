# Git workflow

## v0.1

최초 실제 구현은 기존 Skeleton을 기반으로 main에 반영할 수 있습니다. 기능별 의미 있는 Commit을 유지합니다. 이번 작업에서는 work/v0.1-validation에서 CI를 확인한 뒤 검증된 Commit들을 main으로 fast-forward합니다. 이는 v0.1에 대한 검증용 브랜치이며 이후 버전 규칙을 대체하지 않습니다.

## v0.2 이후

main에서 직접 대규모 기능을 개발하지 않습니다.

```text
main
  → version/v0.x
  → 개발 (필요하면 feature/* 브랜치)
  → 테스트
  → Pull Request
  → 검토
  → main merge
```

예: `version/v0.2`에서 `feature/github-auth`, `feature/github-project`, `feature/github-issues`로 나눌 수 있습니다. 버전별 범위와 실제 검증 결과를 기록하며, 미완성 기능을 작동하는 UI로 표시하지 않습니다.

## Version PR 본문

저장소의 `.github/pull_request_template.md`를 사용합니다. PR만 읽어도 변화·구현 방식·검증·한계를 이해할 수 있도록 작성합니다.

- 개요: 버전 목적과 핵심 변화
- 추가된 기능 / 개선된 기능
- 구현 방식: 경계와 데이터 흐름
- 코드 변경: 주요 모듈·Architecture 변화
- Database 변경: Table/Column/Migration/RLS; 없으면 없음 명시
- UI/UX 변경: 화면과 사용자 흐름
- 버그 수정: 문제 → 원인 → 수정, 필요한 근거
- 테스트: 실행한 검사와 결과, 미실행 항목 구분
- 알려진 문제
- 다음 버전

예: Calendar 날짜가 하루 전으로 표시된 문제의 원인이 date를 UTC timestamp로 변환한 것이라면, date-only 필드를 보존하도록 바꾼 방식과 시간대별 검증을 함께 기록합니다. 본문을 단순히 “v0.2 완료”로 작성하지 않습니다.
