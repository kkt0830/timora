# Verification — Timora v0.2 Release Candidate

2026-10-04: v0.1 기능을 유지한 Design & Experience 변경을 검증합니다.
아래 v0.1 production 실적은 이전 버전의 기록이며 v0.2 배포 성공을 의미하지 않습니다.

| 검사 | v0.2 결과 |
| --- | --- |
| 의존성 설치 | npm ci 성공; 추가 런타임 라이브러리 없음 |
| TypeScript | npm run typecheck 성공 |
| Domain/service | Node 22.18/24에서 각각 25개 통과: 검색/프로필/계정 전환 guard/URL 정규화 |
| Production build | npm run build 성공 |
| PostgreSQL 16 | bootstrap → schema → 002 → 003 → 기존 RLS → Profile RLS 모두 성공 |
| Browser | Actions [37178620347](https://github.com/kkt0830/timora/actions/runs/37178620347) 통과; CRUD/프로필/검색/모바일/입력 보존 검사 성공 |
| lint | 기존 설정 없음 |
| 운영 적용 | v0.2 Profile migration/Netlify ready; URL·bundle·Hosted RLS 확인 |

## v0.2 추가 검증 범위

- 검색: NFKC/대소문자/복수 검색어, 내용·URL·Project context, 빈 결과, 다른 계정 dataset.
- 프로필: 닉네임 길이/공백, HTTPS URL 및 unsafe scheme/userinfo 차단, URL 제거, owner 유지.
- 인증: 이전 계정의 진행 중 refresh 및 대기 중 Web Lock이 새 계정을 변경하지 않음.
- DB: 기존 7개 테이블 CRUD/RLS, 다른 사용자 Profile 조회·수정·위조 owner 차단, URL 제약.
- 브라우저 fixture: 기존 CRUD/Settings/Auth/Error/Loading/Markdown, Profile 메뉴와 Escape,
  nickname/사진 URL 저장·새로고침·제거·실패 fallback, Search에서 Note 열기,
  다른 계정 UUID로 편집기 열기 차단, 1365px Desktop / 834px Tablet / 390px Mobile. 추가로 320px Calendar touch target/문서 폭과
  background refresh 실패 시 Note draft 보존을 검사합니다.

실제 Supabase 가입 메일, 여러 실제 기기의 동시 편집, Safari/Firefox, 자연 만료 및
대규모 데이터는 별도 운영 확인 대상입니다. RLS/Browser fixture 통과는 이 검사를
대체하지 않습니다. 로컬 Chromium의 페이지 응답 중단은 성공으로 기록하지 않으며,
위 Actions 실행에서 실제 UI의 브라우저 검사를 통과한 결과를 사용합니다.
로컬 DB와 fixture만 사용했고 기존 production 사용자 데이터는
변경하지 않았습니다. 배포 전 절차는 [deployment.md](deployment.md)에 기록합니다.

---

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

## v0.2 production rollout — 2026-10-04

배포 전 CodeRabbit 지적 중 avatar URL 정규화/encoded length, 링크 radius,
Drawer scrim hover/active 및 문서 표시를 수정했습니다. 추가 회귀를 포함한
CI 37178620347의 web/database가 통과했습니다. Hosted SQL core/Profile
검사도 성공했고 fixture는 rollback했습니다. Anonymous Profile REST는
401, Auth settings는 200이며 실제 bundle에 연결 설정이 포함돼 있습니다.

Supabase security advisor에는 leaked password protection disabled 경고가
1건 있습니다. 프로필 migration의 RLS 누락 경고는 없으며, 해당 Auth 보호
설정은 이번 배포에서 변경하지 않았습니다. 실제 사용자 Profile 저장·
새로고침, 실제 여러 탭 및 Safari/Firefox 확인은 추가 검증 대상입니다.
