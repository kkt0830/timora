# Development / PC setup

Timora 전용 Supabase 프로젝트와 Netlify production 사이트를 연결했습니다. 새 환경을 재현할 때 아래 절차를 사용합니다. 현재 연결 대상은 [deployment.md](deployment.md)에 기록합니다. Git CLI 없이 ZIP으로 내려받아도 실행할 수 있습니다.

## 로컬 실행

1. Node 22.18 이상(권장 24)을 설치하고 검토 중인 v0.2는 `version/v0.2`를 받고, 운영 버전은 `main`을 받습니다.
2. `npm ci`로 lockfile 기준 의존성을 설치합니다.
3. 새 Supabase 프로젝트의 SQL Editor에서 `db/schema.sql`을 한 번 실행합니다. 트랜잭션 전체가 실패하면 원인을 수정한 뒤 전체를 다시 실행합니다. 이미 성공한 bootstrap은 재실행하지 않습니다. 새 DB에서는 이어서 `db/migrations/*.sql`을 파일명 순서대로 한 번씩 적용합니다. 운영 Timora DB에는 bootstrap과 002까지 적용되어 있습니다. v0.2의 003은 운영 반영 전 별도로 적용해야 합니다.
4. `.env.example`을 `.env`로 복사하고 URL/publishable key를 설정합니다. Windows PowerShell에서는 `Copy-Item .env.example .env`를 사용할 수 있습니다.
5. Supabase의 Data API가 public 스키마를 노출하는지 확인합니다. max rows는 최소 500으로 유지합니다. SQL에서 authenticated 테이블 권한과 RLS를 모두 설정합니다.
6. Auth Email provider, Site URL `http://localhost:5173`, Redirect URLs의 개발 주소를 확인합니다. 기본 SMTP는 프로젝트 조직의 팀원 이메일로만 발송합니다. 팀원 외 주소로 가입하거나 운영하려면 Custom SMTP를 설정합니다. 발송 제한은 Supabase Auth의 Rate Limits에서 확인합니다.
7. `npm run dev`로 시작합니다. `.env`를 변경하면 개발 서버를 다시 시작합니다.

설정이 없거나 secret/service_role 키를 넣으면 로그인 요청 대신 안내 화면을 표시합니다. 연결 실패에는 15초 timeout과 오류/재시도를 제공합니다. 가입 직후 세션이 없으면 확인 이메일 안내를 표시합니다. 링크의 인증 hash는 처리 직후 URL에서 제거합니다.

## 검증 명령

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

별도 lint 도구는 없습니다. Node 내장 테스트 runner로 domain/service 테스트를 실행합니다. 브라우저 검사를 로컬에서 실행하려면 일회성 테스트 도구를 설치합니다(런타임 의존성이 아니며 lockfile은 변경하지 않습니다).

```bash
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
npm run test:browser
```

`tests/browser.mjs`가 별도 Vite 서버를 4173 포트에서 실행하고 HTTP fixture로 UI를 검사합니다. 실제 프로젝트에 테스트 내용을 쓰지 않습니다. 해당 포트의 다른 서버는 먼저 종료합니다.

Postgres RLS 테스트는 GitHub Actions의 격리된 Postgres 16에서 실행합니다. `tests/db-bootstrap.sql`은 Supabase Auth 계약을 최소한으로 재현하는 **CI 전용** 파일입니다. 실제 Supabase 프로젝트에 실행하지 않습니다. 기존 DB 변경은 별도 검토된 SQL migration으로 추가합니다.

## 실제 Supabase 연결 후 확인

- 계정 A/B를 각각 만들고 이메일 확인 및 로그인/로그아웃/새로고침을 확인합니다.
- A에서 6가지 Entity와 Settings를 생성/수정/삭제합니다. B에서는 A의 UUID를 직접 REST 조회/수정해도 접근할 수 없어야 합니다.
- B 소유 Project ID를 A의 Task/Note/Event/Library에 넣으면 FK 위반이어야 합니다.
- Inbox Task/Note 이동 후 원문 보존, 원본 제거, 반복 요청 중복 방지를 확인합니다.
- Project 삭제 뒤 연결된 내용은 남고 project_id만 NULL이어야 합니다.
- device timezone(예: Asia/Seoul)에서 date-only Task와 자정을 넘는 Event가 올바른 날짜에 나타나는지 확인합니다.
- 새 계정의 빈 화면, 연결 차단/복구, 작은 화면 메뉴·편집기·Calendar를 확인합니다.
- 토큰 만료 후 갱신 및 두 탭의 로그아웃 전파를 확인합니다.

## Netlify

Repository를 연결할 때 root를 base로 사용합니다. Build Command는 `npm run build`, Publish Directory는 `dist`, Node는 24입니다. 설정은 `netlify.toml`에 포함되어 있습니다.

Netlify Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 등록합니다. 빌드 변수이므로 변경 후 redeploy합니다. Supabase Auth Site URL/Redirect URLs를 실제 배포 주소로 갱신하고 이메일 확인 링크가 이 사이트로 돌아오는지 확인합니다. `/tasks`, `/notes`, `/projects/:id` 직접 접근과 새로고침을 검사합니다.

Preview 배포가 필요하면 그 주소도 Redirect URLs에 명시합니다. 파일 업로드/Storage/functions/GitHub secret 설정은 v0.2에서도 필요하지 않습니다.

## 알려진 제한

기기 timezone을 사용하고 별도 timezone 설정은 없습니다. 로컬 저장된 세션을 활용하지만 데이터의 오프라인 편집을 지원하지 않습니다. 다른 기기에서 같은 객체를 동시에 저장하면 마지막 저장이 우선입니다. 모든 테이블을 페이지별로 읽은 뒤 메모리에 모으므로 큰 데이터의 최적화는 후속 버전입니다. Notes 미리보기는 기본 Markdown 부분집합입니다.


## 현재 서비스

https://timora-sfj2.netlify.app 에 v0.1 production을 배포했습니다. Supabase Auth Site URL/Redirect URLs는 PC에서 등록 완료한 상태입니다. 실제 로그인·Task 저장·새로고침 유지가 사용자 확인을 통과했습니다. 검증 범위와 이메일 발송 제한은 verification.md에 기록합니다. GitHub 자동 배포가 필요하면 Netlify Project configuration의 Repository에서 `kkt0830/timora`, main을 연결합니다. 소스 업로드 방식의 현재 배포는 GitHub 자동 배포 연결을 만들지 않습니다.
