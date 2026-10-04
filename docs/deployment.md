# Deployment — Timora v0.1

2026-10-02 production 배포 및 전용 Supabase 연결을 완료했습니다.

| 항목 | 설정 |
| --- | --- |
| Web app | https://timora-sfj2.netlify.app |
| Netlify project | timora-sfj2 / kkt0830 team |
| Supabase project | Timora / kkt0830's Org / 서울 ap-northeast-2 |
| Project ref | jywwqcmkijswuyzrkmze |
| GitHub repository | kkt0830/timora / main |
| Build / publish | npm run build / dist / Node 24 |

Supabase에는 core bootstrap과 project FK index migration을 적용했습니다. 현재 프로젝트에서 bootstrap을 재실행하지 않습니다. 새 프로젝트에는 `db/schema.sql`, 이어서 `db/migrations/*.sql`을 파일명 순서대로 한 번씩 적용합니다.

Netlify에 VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 전체 scope/context로 등록했습니다. Free 플랜에서 build 전용 scope 등록은 저장되지 않았고 도구가 성공 문구만 반환하는 문제가 있었습니다. 전체 scope로 다시 등록해 실제 변수 목록과 배포된 JavaScript의 설정을 확인했습니다. 두 변수는 브라우저 공개 설정이며 secret/service_role 키는 사용하지 않습니다. 값은 저장소에 기록하지 않습니다.

Auth Site URL은 production 주소, Redirect URLs는 production 주소와 http://localhost:5173 입니다(사용자가 Dashboard 등록 완료 확인). Email provider와 이메일 확인은 활성 상태입니다. 기본 SMTP는 프로젝트 조직 팀원 주소만 지원하므로 다른 이메일의 가입은 Custom SMTP를 먼저 설정합니다.

현재 배포는 소스 ZIP 업로드를 통한 Netlify 원격 빌드입니다. GitHub 자동 배포 연결은 없습니다. 자동 배포가 필요하면 Netlify의 Project configuration → Build & deploy → Repository에서 kkt0830/timora와 main을 연결하고 기존 변수/build/publish 설정을 유지합니다. 이는 향후 앱 내 GitHub Integration과 별개인 운영 설정입니다.

업로드 명령의 일회성 proxy credential, .env, .netlify 상태, 테스트 결과와 dist는 커밋하지 않습니다. 이후 코드 배포 시 환경 변수 목록과 실제 bundle 설정을 확인한 뒤 로그인/저장/새로고침을 확인합니다.

## v0.2 Release Candidate — 2026-10-04

`version/v0.2` 변경은 PR 검토 대상으로 준비합니다. 위 production은 v0.1이며
v0.2 코드나 003 migration을 운영에 적용하지 않았습니다. commit/PR 작성은
production 배포와 별개입니다. 검토 후 다음 순서로 반영합니다.

1. 기존 DB backup/restore 정책 확인 후 SQL Editor에서
   `db/migrations/003_profile_identity.sql` 전체를 한 번 실행합니다.
   기존 Entity/소유권 정책은 유지되며 두 Profile 필드만 추가됩니다.
2. 승인된 PR을 main에 merge합니다.
3. 기존 Netlify 환경 변수를 유지한 채 `npm run build` / `dist`로 release 배포합니다.
   매 commit마다 production을 배포하지 않습니다.
4. 기존 계정 로그인, Profile nickname/사진 저장·새로고침, Search 결과 이동,
   Settings/Logout, 모바일 메뉴 및 기존 CRUD를 확인합니다.

코드를 v0.1로 rollback해도 추가 column은 남겨둡니다. 이를 삭제하면 프로필
데이터가 사라지므로 column drop은 일반 rollback 절차에 포함하지 않습니다.
Storage bucket, 새 secret, 새 Auth provider/Redirect URL은 필요하지 않습니다.
