# Issue #4 — 분석 → 검수 → 개발 Task

2026-10-05 KST. 적용한 스킬: `github-issue-triager v0.1`, `code-reviewer v0.1`,
`issue-to-task v0.1`. 사용자 범위 결정: **이번에는 버그·UI만 수정하고 새 기능은
Task로 정리**. GitHub Issue/label/댓글은 변경하지 않는다.

## Issue Triage

### Issue

- Number: #4
- Title: 10/4(v0.2에 대한 이슈)
- Repository / URL: https://github.com/kkt0830/timora/issues/4
- Sources checked: 본문 전체, labels(없음), comments(0개), 첨부(없음), 관련 코드,
  열린/닫힌 Issue 검색(저장소 Issue #1, #4).
- Limitations: 실제 작성자 기기의 IME, OS, 브라우저는 미제공.

### Classification / Priority

| 요청 | Primary Type | Secondary Type | Priority | Severity | Difficulty | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| 한국어 검색 조합 중복 | BUG | UX | P2 - Medium | Medium | S | 증상 Reported only; 원인 Likely |
| 로고 t 중앙 정렬 | BUG | UI | P3 - Low | Low | XS | Confirmed 코드 구조; 실화면 별도 검증 |
| Workspace 표시를 프로필 메뉴로 이동 | ENHANCEMENT | UI, UX | P2 - Medium | Not applicable | S | Confirmed 요구사항 |
| 노트 삭제 접근 개선 | ENHANCEMENT | UX | P2 - Medium | Not applicable | S | Confirmed 기존 삭제 구현 |
| 매일 루틴 | FEATURE | UX | P2 - Medium | Not applicable | M (provisional) | Confirmed 요청; 상세 계약 Needs verification |
| 날짜별 일기·보관 | FEATURE | UX | P2 - Medium | Not applicable | M (provisional) | Confirmed 요청; 상세 계약 Needs verification |
| 오늘의 한 문장 | FEATURE | UI | P3 - Low | Not applicable | S (provisional) | Confirmed 요청; 콘텐츠 정책 Needs verification |

- Urgency: 버그·UI Normal cycle, 새 기능 Backlog(이번 구현 제외).
- Priority Rationale: 검색은 특정 입력 환경 문제이며 Tasks/Notes 저장 실패나 데이터
  손실은 보고되지 않았다. P0/P1 장애로 과장하지 않는다. 위 표는 한 Issue의 요청
  분할이며 7개의 별도 GitHub Issue가 아니다.

### Summary / User Impact

한국어 검색 시 조합 단계 글자가 중복된다고 보고됐다. Workspace 표시와 로고 정렬을
개선하고, 노트 삭제를 찾기 쉽게 만드는 요구가 있다. 루틴·일기·오늘의 문장은 기존
기능의 장애가 아니라 새로운 기능 요청이다. 검색 입력 사용자가 영향을 받으며
다른 사용자의 데이터 접근이나 저장 데이터 손상 근거는 없다.

### Reproduction

- Status: 검색 Reported only; 로고 코드 경로 확인; 노트 삭제 구현 확인.
- Environment / Device / OS / Browser: Not provided.
- App version: 작성자 표현 v0.2; 세부 deploy ID Not provided.
- Steps: 검색 입력창에서 `안녕하세요` 입력(본문 제공).
- Expected: `안녕하세요` 한 번 표시.
- Actual: 조합 중 `ㅇ`, `아`, `안` 등이 겹쳐 나온다고 보고.
- Error message: Not provided. Frequency / Affected users: Not provided.
- Workaround: Not provided. Regression: Needs verification; 이전 버전/동일 IME 비교 없음.
- FEATURE Use cases: 매일 해야 할 일을 체크, 과거 일기를 다시 읽기, 하루를 시작할 문장.
- Existing overlap: Today/Tasks, Notes, Home. 기존 화면을 확장할 여지가 있으나
  구현 방식이나 새로운 DB 계약은 이번에 확정하지 않는다.
- Minimum scope: Task별 기본 성공 조건만 정의; 반복 규칙·알림·자동화는 요청 밖이다.

### Technical Context

- Likely related areas: `src/app/SearchPage.tsx`의 URL 기반 controlled input.
- Possible cause: IME 조합 중 매 입력마다 Router URL을 갱신하고 URL을 다시 value로
  주입. Confidence: Likely; 실제 OS IME 입력을 독립 재현하지 않았다.
- Confirmed related: `src/app/App.tsx`, `src/styles.css` 로고/Workspace;
  `src/app/rows.tsx` 노트 목록; `src/app/EntityEditor.tsx` 기존 확인·삭제.
- Evidence / Verification needed: F-001~F-003 및 아래 Task AC/검증 참조.

### Missing Information

검색 재현 브라우저·OS·IME 및 수정 후 실제 기기 확인.
새 기능의 날짜/보관/콘텐츠 기준은 T-003~T-005의 Open Questions에 보존.

### Duplicate Check

- Status: No duplicate found (조회한 Issue #1, #4 범위).
- Related Issues: #1의 검색 추가 요청은 이미 구현된 기능 요청이다. #4의 조합 버그와
  원인이 같다고 볼 근거는 없다. 부분적 검색 영역 연관성을 중복으로 처리하지 않는다.

### Code Review / Recommended Action

- Recommended: Yes — IME/Router, Grid 구조, 기존 삭제 경로 검수.
- Suggested code-reviewer request: #4와 SearchPage/App/styles/NoteList/EntityEditor를
  확인하고 IME 가설·기존 삭제 구현을 구분하라. 조합 중 navigation과 회귀 조건을 확인하라.
- Recommended Action: 버그·UI 최소 수정, 신규 기능은 독립 Task로 보관.
- Suggested Labels: Proposed `bug`, `enhancement`, `ui`, `ux`; 실제 label 목록은 미조회,
  등록·수정하지 않음.
- Suggested Branch: `fix/issue-4-v02`.
- Next Step: T-001/T-002 구현·회귀 검사 후 PR로 검토. 새 기능은 사용자 확정 후 착수.

## Code Review

### Summary

- Reviewed scope: main `6063a78`와 동일 tree `687902c`의 검색, Shell, 로고 CSS,
  NoteList → EntityEditor → provider → repository.remove, 브라우저 fixture.
- 로컬 시작: `93eeb2b`, clean; main은 PR #3 merge commit이며 내용 tree는 동일.
- Overall risk: 특정 입력 환경·UI 문제. 기존 삭제 API나 DB/RLS 변경 필요 없음.
- Critical: 0; High: 0; Medium: 1; Low: 2.
- Validation: 코드 경로 검수. 아래 Implementation/Verification은 수정 후 결과와 구분.
- Excluded: 실제 사용자 IME, 전체 저장소 보안 전수 검수, 운영 사용자 데이터 변경.

### [Medium] F-001 — IME 조합 중 URL이 입력 value의 원천

- Status: Likely (실제 OS 재현 미실행).
- Location: baseline `src/app/SearchPage.tsx:8`, `:10` — SearchPage.
- Problem: 조합 중에도 `onChange → setParams → params.get('q') → input.value`가 실행.
- Why it matters: 한국어 등 조합 입력 사용자의 검색 문자열이 불안정해질 수 있음.
- Evidence: draft state/조합 이벤트 구분이 없다. 보고된 자모 중복은 이 흐름과 부합하나
  코드만으로 모든 브라우저의 동일 증상을 확정하지 않는다. 일반 문자열 검색은 작동.
- Recommended action: 입력 draft와 URL query 분리, composition 종료 시 query 확정,
  일반 입력과 URL 복원은 유지.
- Testing: 조합 중 URL 불변, 종료 후 완성 문자열, 삭제/일반 입력/새로고침/뒤로 가기,
  실제 사용자 한국어 IME 확인.

### [Low] F-002 — 로고의 두 Grid 아이템

- Status: Confirmed (DOM/CSS 구조).
- Location: baseline `src/app/App.tsx:38`, `src/styles.css:218`, `:227`.
- Problem: `::before`의 t와 빈 span이 기본 Grid의 별도 행을 차지한다.
- Why it matters: 글자가 단일 중앙 셀에 놓이지 않는다. 기능·데이터 영향 없음.
- Evidence: grid/place-items center와 실제 자식 span. 중앙 정렬 취향 지적이 아니라
  불필요한 두 행의 직접적인 코드 근거.
- Recommended action: 단일 글자 노드로 만들고 line-height를 제한.
- Testing: 중앙 텍스트 box, Desktop/Mobile layout 및 실제 글꼴에 따른 시각 확인.

### [Low] F-003 — 노트 삭제 진입이 제목 클릭에 숨겨짐

- Status: Confirmed (UI 경로); 삭제 기능 미구현 주장은 반증됨.
- Location: baseline `src/app/rows.tsx:29` NoteList,
  `src/app/EntityEditor.tsx:45` remove / `:63` 삭제 버튼.
- Problem: 목록에 편집·삭제 안내가 없어 사용자가 기능을 발견하지 못함.
- Why it matters: 원치 않는 노트를 지우는 흐름을 찾기 어렵다.
- Evidence: 제목 → 편집 dialog → 삭제 → confirm → workspace.remove → owner filter
  DELETE 경로가 이미 존재. 기존 테스트도 노트 삭제를 다룸.
- Recommended action: 기존 dialog를 여는 `수정 / 삭제` 진입 표시; 중복 DELETE를 만들지 않음.
- Testing: 새 진입, confirm 취소/승인, 실패 시 입력 보존, 프로젝트/검색에서 노트 접근.

### Positive Findings / Recommended Priority

삭제 확인과 사용자 owner filter/zero-row error 처리, 공통 편집기를 재사용한다.
F-001 → Workspace 요구/F-003 → F-002 순으로 처리. Workspace 이동은 요구사항이며
기존 표시 자체를 버그로 분류하지 않는다.

### Review Verdict

**CHANGES RECOMMENDED** — 수정 전 기준. IME 가설은 실제 기기 확인이 남아 있어
Confirmed로 승격하거나 전체 앱 장애로 판정하지 않는다.

## Development Tasks

This issue should be split into multiple tasks. T-001/T-002만 이번 구현 범위다.
T-003~T-005는 **명세이며 구현·DB 반영·배포 완료가 아니다**.

### T-001 — 검색 IME 조합과 URL 상태 분리

- Source Issue: #4; Source Analysis / Finding IDs: 검색 triage, F-001.
- Task Type: BUG / UX. Priority: P2 - Medium. Severity: Medium. Difficulty: S.
- Risk: Medium(브라우저별 조합 이벤트 차이). Readiness: Ready for implementation;
  실제 OS 확인은 완료 검증에 필요.
- Objective: 조합 문자열을 입력창에서 보존하며 확정한 검색어만 URL·결과에 반영.
- Problem / Context: F-001 Likely 원인; 조합 중 매 navigation 경로는 Confirmed 코드 사실.
- Open Questions / Conflicts: OS/브라우저/IME Not provided; 새 검증 없이 동일 증상 해결을 단정하지 않음.
- Confirmed Target: `src/app/SearchPage.tsx`, `tests/browser.mjs`(입력 계약/브라우저 회귀).
- Likely Target: None. Possible Target: Router back/forward 동작.
- Needs verification: 실제 한국어 IME 입력.
- In Scope: draft, composition 종료 commit, 외부 URL 변경 동기화, 기존 query 유지.
- Out of Scope: 고급 검색, Command Palette, Tasks/Notes 입력기 재작성, DB.
- Functional Requirements: R-001 조합 중 입력 보존; R-002 종료 후 검색·URL 갱신;
  R-003 일반 입력/삭제/URL 복원/결과 열기 유지.
- Technical Requirements: R-004 React state/ref + 기존 Router 사용, dependency 추가 없음.
- Constraints: 최소 수정, `replace` 계약 유지, 다른 URL query 제거 금지.
- Acceptance Criteria:
  - AC-001: 조합 시작 후 `ㅇ → 아 → 안 → 안녕 → 안녕하세요`를 입력하면 각 draft는
    현재 문자열이며 query는 직전 확정값 유지(R-001).
  - AC-002: 조합 종료 후 URL q와 input은 `안녕하세요`이며 자모 중복 없음(R-002).
  - AC-003: 일반 문자열/빈 값 입력 시 결과·URL 동기화; 새로고침/URL 변경 시 해당 query
    복원, 결과 Object 열기 유지(R-003).
  - AC-004: 실제 재현 기기에서 같은 문장을 입력해 중복 없음 확인; 검증하지 못하면
    미검증으로 기록하고 실제 IME 검증 완료라고 보고하지 않음.
- Testing: synthetic composition Browser 검사 AC-001~003; 실제 OS IME AC-004는 수동.
- Regression Checks: 6개 Entity 검색, no-result, 결과 dialog, 공유 URL, back/forward.
- Dependencies: Blocked by None. Depends on 기존 Router/Workspace data.
- Risks / Mitigation: synthetic events는 OS IME와 다름. 실제 PC 확인 보존.
- Implementation Notes: draft와 query를 구분; 조합 중 URL을 수정하지 않음.
- Suggested Branch: `fix/issue-4-v02`.
- Suggested Commit Scope: `fix: preserve search IME composition`(검색+관련 browser assertions).
- Definition of Done: AC 검증, typecheck/단위/build/Browser 통과; 실제 IME 미확인 명시;
  관련 없는 변경 없음.
- Handoff instruction: 최소 수정 후 위 AC를 검증하라. IME 원인 Likely를 독립 재현 없이
  Confirmed로 바꾸지 말고 수동 확인 한계를 보고하라.

### T-002 — Workspace 표시 이동·로고 정렬·노트 삭제 진입

- Source Issue: #4; Source Analysis / Finding IDs: UI triage, F-002/F-003.
- Task Type: ENHANCEMENT / UI / UX, 로고 BUG. Priority: P2 - Medium(로고 P3).
- Severity: Low(로고/발견성). Difficulty: S. Risk: Low. Readiness: Ready.
- Objective: 불필요한 Workspace 표시를 줄이고 프로필 메뉴에서 설정에 접근하며
  노트 삭제 진입과 브랜드 중앙 정렬을 명확히 한다.
- Problem / Context: F-002/F-003 Confirmed; Workspace 이동은 Confirmed 사용자 요청.
- Open Questions / Conflicts: 삭제 기능은 이미 있음. 새 삭제 API 요구로 바꾸지 않음.
- Confirmed Target: `src/app/App.tsx`, `src/app/rows.tsx`, `src/styles.css`, `tests/browser.mjs`.
- Likely Target: None. Possible Target: 공유 NoteList가 쓰이는 Home/Project 화면.
- Needs verification: 실제 글꼴의 optical alignment.
- In Scope: 상단 Workspace 표시 제거, ⋯ 메뉴에 현재 이름 표시/기존 Settings 유지,
  단일 t, 명시적인 `수정 / 삭제` 버튼.
- Out of Scope: 다중 Workspace/새 전환 기능, 새 삭제 API, DB/RLS 변경, 디자인 전체 개편.
- Functional Requirements: R-005 header/sidebar 중복 Workspace 표시 제거;
  R-006 프로필 메뉴 이름과 설정 접근; R-007 기존 dialog/삭제 확인 재사용.
- Technical Requirements: R-008 단일 centered logo node; native button/접근 가능한 이름,
  기존 focus/Escape/drawer 유지.
- Constraints: 기존 Profile/Settings/Logout 메뉴 보존; destructive 동작에 confirm 유지.
- Acceptance Criteria:
  - AC-005: Home 및 다른 header에는 화면명만 표시; 가짜 Workspace selector 없음(R-005).
  - AC-006: ⋯ 메뉴에서 저장된 Workspace 이름을 읽고 Settings로 이동·편집 가능(R-006).
  - AC-007: 로고 단일 t node가 32px 셀 중앙에 위치(R-008).
  - AC-008: 노트 `수정 / 삭제` 버튼 → 기존 dialog. 확인 취소 시 노트 유지;
    승인 시 목록에서 제거, fixture reload 후에도 삭제 상태 유지(R-007).
- Testing: Browser desktop/mobile/menu/keyboards/note delete; typecheck/build.
- Regression Checks: 제목 클릭 편집, Notes/Home/Project NoteList, 기존 Markdown/CRUD,
  Mobile drawer Escape/focus, Profile/Settings/Logout.
- Dependencies: Blocked by None. Depends on 기존 EntityEditor/provider/repository.
- Risks / Mitigation: 공유 목록 영향 확인; 중복 삭제 경로를 만들지 않음.
- Implementation Notes: Workspace 이름은 메뉴 header, 관리 기능은 기존 Settings에 유지.
- Suggested Branch: `fix/issue-4-v02`.
- Suggested Commit Scope: `fix: simplify workspace navigation and expose note actions`.
- Definition of Done: AC-005~008와 관련 회귀 통과, DB·삭제 계약 그대로, 문서 일치.
- Handoff instruction: 요구한 UI만 수정하고 공통 삭제/설정 흐름을 재사용하라.

### T-003 — 매일 루틴 등록·날짜별 완료 기록 (미구현)

- Source Issue: #4 첫 번째 요청. Source Analysis / Finding IDs: FEATURE triage; 리뷰 Finding None.
- Task Type: FEATURE / UX. Priority: P2 - Medium. Difficulty: M (provisional).
- Risk: Medium(날짜/저장/사용자 격리). Readiness: Needs clarification; 이번 실행 제외.
- Objective: 사용자가 등록한 매일 루틴을 매일 확인·체크.
- Problem: 반복할 일을 수동 재등록해야 함. Context: Today/Tasks는 존재; 반복 계약 없음.
- Confirmed Target: None(변경 대상 미확정).
- Likely Target: `src/app/WorkspacePages.tsx` Today, `src/domain/dates.ts`,
  `src/services/contracts.ts`, `src/data/supabase-repository.ts`(확인된 확장 후보).
- Possible Target: 별도 루틴 화면, 새 migration(모두 Proposed).
- Needs verification / Open Questions: 루틴 표시 위치, 수정/삭제가 과거 기록에 미치는 영향,
  날짜 기준/시간대, 같은 날짜 중복 완료 정책.
- In Scope: 매일 등록 목록·해당 날짜 체크·새로고침 후 유지·본인 데이터.
- Out of Scope: 요일/월 반복, 알림, 연속 기록 점수, 자동 Task 생성, 주간 통계.
- Functional Requirements: R-009 매일 루틴 등록/목록; R-010 날짜별 완료 보존·다음 날짜 분리.
- Technical Requirements: R-011 기존 service/data 경계와 사용자 RLS, 재현 가능한 migration.
- Constraints: 데이터 계약 확정 전 구현 시작 금지; 기존 Task status를 매일 덮어쓰지 않음.
- Acceptance Criteria: AC-009 루틴 등록·새로고침 후 목록 유지;
  AC-010 D일 완료 후 D+1일에는 별도 미완료 상태이고 D일 기록 보존;
  AC-011 사용자 B가 A 루틴/기록을 읽거나 변경할 수 없음.
- Testing: 확정한 날짜 계약 unit, 저장/조회/RLS, Today 또는 승인된 화면 E2E.
- Regression Checks: 일반 Task 완료/Today date-only, Auth/logout, 기존 CRUD.
- Dependencies: Blocked by 날짜/삭제/표시 계약 확정. Depends on 기존 Auth/data layer.
- Risks: 시간대/자정/삭제 시 과거 기록 손실; 계약과 테스트로 명확히 함.
- Implementation Notes: 반복 Task 재생성 방식은 요구사항이 아니므로 강제하지 않음.
- Suggested Branch: Proposed `feature/issue-4-daily-routines`(버전 결정 후).
- Suggested Commit Scope: routine domain/data/migration/UI를 의미 단위로 분리.
- Definition of Done: 열린 계약 해결, AC-009~011, typecheck/build/관련 E2E/RLS, 문서.
- Handoff instruction: 먼저 Open Questions를 확정한 뒤 최소 매일 루틴만 구현하라.

### T-004 — 날짜별 일기 작성·보관 (미구현)

- Source Issue: #4 두 번째 요청. Source Analysis / Finding IDs: FEATURE triage; 리뷰 Finding None.
- Task Type: FEATURE / UX. Priority: P2 - Medium. Difficulty: M (provisional).
- Risk: Medium(개인 기록/저장 계약). Readiness: Needs clarification; 이번 실행 제외.
- Objective: 하루 일기를 저장하고 과거 날짜 기록을 다시 열기.
- Problem: 일반 Notes는 있지만 일기 날짜/보관 흐름은 없음.
- Context: Notes/Markdown/owner CRUD 재사용 가능; 재사용 방식은 미확정.
- Confirmed Target: None. Likely Target: `src/app/WorkspacePages.tsx`,
  `src/app/EntityEditor.tsx`, `src/domain/models.ts`, service/data 경계(확인된 후보).
- Possible Target: Notes 날짜 필드 또는 별도 diary table/migration(Proposed alternatives).
- Needs verification / Open Questions: 하루 한 편 제한 여부, 과거 날짜 작성/수정/삭제,
  날짜 기준, Notes와 같은 목록에 노출할지.
- In Scope: 날짜를 식별할 수 있는 일기 저장·과거 목록/조회·본인만 접근.
- Out of Scope: 감정 분석, AI, 첨부/그림판, 캘린더 통계, 공개 공유.
- Functional Requirements: R-012 날짜별 작성/저장; R-013 과거 기록 재조회.
- Technical Requirements: R-014 기존 데이터 보존/RLS와 migration, 안전한 Markdown 계약 유지.
- Constraints: 기존 노트를 날짜 근거 없이 자동으로 일기로 변환하지 않음.
- Acceptance Criteria: AC-012 날짜 D의 내용 저장→reload→동일 날짜/내용 복원;
  AC-013 다른 날짜에서 과거 D일 기록 조회; AC-014 B가 A 일기에 접근 불가.
- Testing: 승인한 날짜/중복 계약 unit, 저장 E2E, 사용자 격리 SQL/권한.
- Regression Checks: 일반 Notes 생성/편집/삭제·Project 연결·기존 Inbox→Note.
- Dependencies: Blocked by 날짜/보관/중복/삭제 계약. Depends on 기존 Auth/data layer.
- Risks: 기록 덮어쓰기/의도치 않은 노트 이동; 명시적 날짜와 저장 제약으로 검증.
- Implementation Notes: 먼저 Notes 재사용과 새 Entity를 비교; 파일/DB 설계를 강제하지 않음.
- Suggested Branch: Proposed `feature/issue-4-diary`(버전 결정 후).
- Suggested Commit Scope: diary schema/domain/UI/검증을 의미 단위로 분리.
- Definition of Done: 계약 확정, AC-012~014, Notes 회귀/typecheck/build/RLS, 문서.
- Handoff instruction: 일기 보관 성공 조건을 확인한 뒤 데이터 손실 없이 구현하라.

### T-005 — 오늘의 한 문장 (미구현)

- Source Issue: #4 세 번째 요청. Source Analysis / Finding IDs: FEATURE triage; 리뷰 Finding None.
- Task Type: FEATURE / UI. Priority: P3 - Low. Difficulty: S (provisional).
- Risk: Low(출처/갱신 계약 확정 시). Readiness: Needs clarification; 이번 실행 제외.
- Objective: 앱 시작 시 하루를 시작하는 문장을 표시.
- Problem: 현재 문장 영역 없음. Context: Home dashboard 존재, 개인별 설정 요구는 없음.
- Confirmed Target: None. Likely Target: `src/app/WorkspacePages.tsx` Home(확인된 후보).
- Possible Target: 정적 문장 domain 모듈(Proposed), 별도 콘텐츠 API(필요성 미확정).
- Needs verification / Open Questions: 표시 위치(Home 또는 시작 시), 날짜별 유지/교체,
  문장·출처 선정 기준. 노래 구절/명언 예시는 특정 API 도입 요구가 아님.
- In Scope: 승인한 문장·출처 표시, 승인한 하루 교체 기준.
- Out of Scope: AI 생성, 감정 추론, 외부 계정 연동, 알림, 저장·즐겨찾기.
- Functional Requirements: R-015 앱 진입 시 문장 접근; R-016 승인한 날짜/콘텐츠 기준.
- Technical Requirements: R-017 실패/빈 콘텐츠 시 기존 Home 데이터 사용을 막지 않음.
- Constraints: 문장 출처를 지어내지 않음; 새로운 유료 API를 가정하지 않음.
- Acceptance Criteria: AC-015 승인한 진입 화면에 문장과 출처(해당 시) 표시;
  AC-016 같은 날/다음 날 갱신이 승인한 규칙에 일치;
  AC-017 문장 데이터가 없거나 실패해도 Task/이벤트 dashboard 사용 가능.
- Testing: 승인한 날짜 선택 unit, 진입/빈 콘텐츠 UI 확인.
- Regression Checks: Home 로딩/오류/empty/task counts.
- Dependencies: Blocked by 콘텐츠·표시·갱신 계약. Depends on 승인된 문장 목록/출처.
- Risks: 잘못된 귀속/비결정적 날짜 변경; 검증된 목록과 날짜 테스트.
- Implementation Notes: 정적 목록이 충분하면 외부 API를 추가하지 않음(제안).
- Suggested Branch: Proposed `feature/issue-4-daily-line`(버전 결정 후).
- Suggested Commit Scope: daily-line domain/UI/검증.
- Definition of Done: Open Questions 해결, AC-015~017, 관련 검사와 문서.
- Handoff instruction: 계약과 문장 출처를 확정한 뒤 작은 독립 UI로 구현하라.

## Skill 연계 평가

| 항목 | 평가 | 근거 |
| --- | --- | --- |
| triage → review | PASS | 검색·로고·기존 삭제 경로와 미제공 환경 전달 |
| review → Task | PASS | F-001~003 ID/상태 유지; 기존 삭제 API를 다시 만들지 않음 |
| Confidence 보존 | PASS | IME 원인 Likely, 새 기능 계약 Needs verification 유지 |
| Priority/Severity/Difficulty | PASS | 혼합 Issue를 요청 단위로 구분, 장애 과장 없음 |
| 원래 목적/Scope | PASS | 사용자 범위 수정 반영; 새 기능은 미구현 명세 |
| Acceptance Criteria | PASS | 입력/URL/메뉴/삭제 확인과 날짜·권한 검사 연결 |
| Handoff | MINOR ISSUE | 신규 기능은 질문 확정 전 바로 구현할 수 없음; Readiness에 명시 |

Workflow Verdict: **READY WITH MINOR IMPROVEMENTS** — 버그·UI Task는 실행 가능,
신규 기능은 계약 확정이 필요하다. 스킬은 혼합 Issue와 기존 기능 발견성의 구분을 잘
지원했다. v0.2 후보: 한 Issue의 요청별 priority 집계와 실행 범위, 구현 결과와 원래
Finding 상태, OS IME와 synthetic 검증 수준을 별도 필드로 표현하면 더 명확하다.

## Implementation / Verification

최종 결과는 `docs/verification.md`의 Issue #4 항목 참조. 원본 Issue는 새 기능이
남아 있으므로 전체 완료로 close하지 않는다. 이 문서의 Task는 후속 스킬 입력이며
GitHub에 별도 Issue를 생성한 것은 아니다. Netlify 운영 배포와 PR 병합은 별개다.

- 구현: T-001/T-002의 코드·UI 반영. 별도 dependency/DB 변경 없음.
- 검증: 로컬 25개 단위·typecheck/build 통과; 코드 commit `2b42a40`의 Actions
  [37212723477](https://github.com/kkt0830/timora/actions/runs/37212723477) web/database 성공.
- 확인 수준: synthetic composition, URL/history와 CRUD/menu/responsive 회귀 통과.
  실제 OS 한국어 IME는 Needs verification이며 원본 증상의 해결을 독립 재현한 것은 아님.
- 남은 완료 조건: T-001 AC-004 실제 재현 기기 입력 확인. 후속 새 기능은 미착수.
