# Verification — Timora v0.1

2026-10-01 기준. 전체 코드 검증: [GitHub Actions run 36846512622](https://github.com/kkt0830/timora/actions/runs/36846512622). 이 문서는 코드 검증과 실제 서비스 연결을 구분합니다.

| 검사 | 결과 / 환경 |
| --- | --- |
| Dependency install | GitHub Actions의 `npm ci` 성공; 기존 lockfile 유지 |
| TypeScript | GitHub Actions `npm run typecheck` 성공 |
| Unit/service tests | 로컬 Node 24 및 Actions 성공; 날짜/URL/Auth/갱신/로그아웃/저장소/페이지 조회 16개 |
| Production build | GitHub Actions `npm run build` 성공 |
| SQL bootstrap / RLS | 실제 PostgreSQL 16에서 schema 적용과 tests/rls.sql 성공 |
| Chromium UI | GitHub Actions 성공; 1365px Desktop 및 390px 모바일 흐름 확인 |
| lint | 기존 lint 설정 없음; strict TypeScript 검사 수행 |
| Secrets | 실제 .env/비밀 키/개인 키/GitHub token 값이 없는지 확인; .env.example은 빈 설정 |
| 실제 Supabase 연결 | 사용자 요청에 따라 PC 작업으로 보류 |
| 실제 Netlify 배포 | 사용자 요청에 따라 PC 작업으로 보류; build/publish/fallback 설정 제공 |

## 검사 내용

도메인/서비스 테스트는 UTC/Asia-Seoul/Los-Angeles Task 날짜, 자정을 넘는 Event와 end-exclusive 경계, 연도 경계 달력, URL protocol 검증, 잘못된 날짜/범위, 로그인·세션 복원·이메일 확인 대기, 토큰 갱신 동시 요청, 로그아웃 이후 늦은 갱신 차단, 오프라인 갱신 재시도, owner filter/Bearer 요청, 0-row 수정·삭제 오류, 401 재시도, 서버 응답 오류와 페이지별 조회를 확인합니다.

Postgres 검사는 다른 사용자 행 조회·수정·삭제 차단, 위조 owner INSERT 및 user_id 재할당 차단, 다른 사용자 프로젝트 FK 차단, Entity CRUD, Project 삭제 후 연결 해제/내용 유지, Inbox 변환·중복/실패 처리, Settings 소유권, anon 테이블/RPC 차단을 확인합니다. Auth의 uid 계약은 CI에서 최소 구현으로 대체하고 **RLS/제약/SQL 함수는 실제 DB 엔진에서 실행**합니다.

브라우저 검사는 실제 React 화면에 HTTP fixture를 연결합니다. Navigation, Project 상세, Entity 생성/수정/삭제, 작업 완료/필터, Markdown/HTML 텍스트 처리, 월 이동, Inbox→Note, 새로고침 세션/데이터 복원, 오류/재시도/로딩, Appearance, 모바일 메뉴/폭, 사용자 전환, 이메일 확인 대기 안내를 검사합니다. GitHub Actions artifact에 review image를 남깁니다.

## 수정하며 확인한 문제

- Markdown 코드 블록의 callback 내부 대입을 TypeScript가 좁히지 못함: 순회 구조를 바꿔 엄격한 타입 검사를 통과시킴.
- Select label에 option 텍스트가 합쳐짐: 명시적인 접근성 이름으로 폼 탐색을 안정화함.
- preview의 hidden label이 CSS display 규칙 때문에 나타날 수 있음: `[hidden]` 규칙을 명시함.
- Inbox 변환 후 전체 로딩 화면이 기존 입력/안내 상태를 제거함: 변환 후 백그라운드 재조회로 상태를 유지함.
- 기본 Data API 행 제한으로 큰 목록 누락 가능: 500개 단위 조회 및 테스트 추가.
- 브라우저 테스트의 npm wrapper 종료가 자식 서버를 남김: Vite를 직접 실행·종료하고 CI 제한 시간/동시 실행 취소 설정을 추가함.

## PC에서 남은 확인

실제 Supabase 이메일 발송/확인 링크, Site URL/Redirect 설정, Data API public 노출과 max rows, 두 실제 계정의 REST 접근 격리, 실제 session 만료/여러 탭 갱신, Netlify HTTPS 배포와 하위 경로 새로고침을 확인해야 합니다. 자세한 절차는 development.md에 있습니다.

운영 데이터로 장기간 사용, Web Locks 미지원 브라우저, Safari/Firefox, DST 지역의 반복 시각 입력, 큰 데이터 성능은 이번 Chromium/CI 검증만으로 보장하지 않습니다. 날짜 표시는 기기 timezone을 따르며 오프라인 충돌 해결·파일 업로드는 후속 범위입니다.
