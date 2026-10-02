# Verification — Timora v0.1

2026-10-02 현재 코드 검사, 실제 Supabase 적용, Netlify production 배포와 사용자 로그인·저장 확인을 완료했습니다. 자동 검사와 수동 확인의 범위를 구분합니다.

| 검사 | 결과 / 근거 |
| --- | --- |
| Dependency install | 현재 환경 npm ci 성공; 기존 lockfile 유지 |
| TypeScript | 현재 환경 npm run typecheck 성공 |
| Domain/service | Node 24 테스트 18개 통과; --test-isolation=none으로 개별 결과 확인 |
| Production build | 로컬 및 Netlify Vite 원격 빌드 성공 |
| CI | [run 37027739790](https://github.com/kkt0830/timora/actions/runs/37027739790) 성공: 설치/타입/테스트/빌드/Chromium/Postgres |
| Hosted schema | 7개 테이블, RLS, FK, trigger, Inbox RPC 및 후속 인덱스 migration 적용 |
| Hosted RLS/CRUD | tests/rls.sql 실행 성공; 모든 fixture는 transaction rollback |
| Backend security | Advisor 보안 지적 없음; 누락 FK 인덱스 4건 수정 및 재검사 |
| Public API | Auth settings 200; email/signup/confirmation 활성; anon Task 접근 401 |
| Netlify | production ready; 실제 변수 목록과 bundle의 URL/활성 public key 일치 확인 |
| SPA / HTTPS | /, /tasks, /notes, /projects/:id HTTPS GET 200; React 진입 HTML과 nosniff header |
| 실제 계정 | 사용자 로그인·Task 저장·새로고침 유지 성공 확인; 서버 confirmed 계정 존재 확인 |
| lint | 기존 설정 없음; strict TypeScript 검사 사용 |
| Secrets | 커밋 대상에 실제 .env/키/DB 비밀번호/일회성 deploy credential 없음 |

## 검증 범위

18개 domain/service 테스트는 timezone별 date-only Task, Event day overlap/end-exclusive, 연도 경계 Calendar, URL·날짜 범위, 세션 복원·갱신·로그아웃·계정 전환 race, 실패 후 재시도, owner filter/Bearer, 0-row write, 401 retry와 pagination을 확인합니다.

CI Chromium 검사는 실제 React UI에 HTTP fixture를 연결해 Navigation, Project 상세, Entity CRUD, 완료/필터, Markdown 안전한 처리, Calendar 이동, Inbox→Note, 새로고침, 오류/재시도/로딩, 모바일 메뉴·폭, Appearance, 계정 전환, 이메일 확인 대기를 확인합니다. 1365px desktop/390px mobile review image를 Actions artifact에 남깁니다.

현재 cloud에서는 Chromium 렌더러가 page crash/closed로 종료되어 로컬 browser 검사는 실패했습니다. 옵션 변경으로 해결되지 않아 반복하지 않았습니다. 이 검사를 성공으로 기록하지 않으며 같은 Commit의 Actions Chromium 통과를 근거로 사용합니다. 배포 화면은 Netlify 생성 screenshot으로 별도 확인합니다.

Hosted SQL 검사는 실제 auth.uid()와 PostgreSQL RLS 엔진을 사용합니다. 다른 사용자 행 조회·수정·삭제 차단, 위조 owner/user_id 재할당 차단, 다른 사용자 Project FK 차단, Entity CRUD, Project 삭제 후 연결 해제/내용 유지, Inbox 원자적 변환·중복/실패, Settings ownership, anon table/RPC 차단을 검사합니다. 임시 UUID fixture 사용자와 데이터는 모두 rollback했습니다. Auth를 대체하는 CI 전용 db-bootstrap.sql은 Hosted DB에 실행하지 않았습니다.

## 수정한 문제

- 오래된 restore 응답이 새 로그인을 해제하는 race와 Today에 과거 완료 작업이 남는 경우를 수정하고 회귀 검사 추가.
- Markdown 타입, select label, hidden 미리보기 CSS, Inbox 변환 후 상태 보존, 목록 row limit, 테스트 서버 종료 문제 수정.
- Hosted Advisor 복합 FK index 지적: project_id/user_id 순서 인덱스 4개 추가, migration 및 CI 반영.
- Netlify 연결 준비 안내: build 전용 scope 등록 도구가 저장 실패를 성공으로 반환해 bundle 설정 누락. 전체 scope 등록 후 목록·bundle 값·사용자 로그인 재확인.

## 남은 운영 확인과 제한

- 두 실제 계정 JWT의 REST 격리는 별도로 실행하지 않았습니다. DB의 두 사용자 역할/claim 검사와 실제 사용자 로그인·저장은 통과했습니다.
- 실제 여러 탭의 refresh rotation, 자연 만료, Safari/Firefox, 대규모 데이터와 장기간 사용은 추가 검증 대상입니다.
- 기본 SMTP는 프로젝트 조직 팀원 이메일만 지원합니다. 다른 주소 가입에는 [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)를 설정합니다.
- Netlify GitHub 자동 배포 연결은 미설정이며 현재 source upload 배포입니다.
- 새 DB의 unused_index INFO는 트래픽이 없다는 의미이며 제거하지 않았습니다. [Advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- 오프라인 편집, 파일 업로드, 범용 Relations, GitHub Integration, Desktop/Mobile은 후속 버전 범위입니다.

연결 대상은 [deployment.md](deployment.md), 개발 절차는 [development.md](development.md)에 기록합니다.
