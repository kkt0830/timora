# Deployment — Timora

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

## v0.2 production — 2026-10-04

사용자의 운영 배포 요청에 따라 기존 `timora-sfj2`에 v0.2를 배포했습니다.

- Netlify deploy: `6ac1de671eb2529406185e33`, state ready.
- Source commit: `d71f30c4c35c7b6761df5728bdbfd41e3d602b60` (`version/v0.2`).
- Deploy URL: https://6ac1de671eb2529406185e33--timora-sfj2.netlify.app
- Production URL: https://timora-sfj2.netlify.app
- Supabase migration: `timora_v02_profile_identity` / `003_profile_identity.sql` 적용.
- 기존 데이터 개수 유지 및 Hosted core/Profile RLS transaction rollback 검사 성공.
- Production bundle의 v0.2 표기·Profile/Search·Supabase URL/public key 포함 확인.
- /profile, /search, /tasks, /notes, /calendar SPA 직접 접근 HTTPS 200 확인.

PR #2는 사용자 측에서 이미 merge된 상태였습니다. 배포 전 review 수정은
version branch의 후속 PR로 main에 반영할 수 있도록 남깁니다. GitHub 자동
배포 연결은 만들지 않았으며, 이후 commit만으로 production이 바뀌지 않습니다.
실제 계정의 Profile 저장·새로고침 smoke test는 사용자 확인이 남아 있습니다.

코드를 v0.1로 rollback해도 추가 column은 남겨둡니다. 이를 삭제하면 프로필
데이터가 사라지므로 column drop은 일반 rollback 절차에 포함하지 않습니다.
Storage bucket, 새 secret, 새 Auth provider/Redirect URL은 필요하지 않습니다.

## v0.3 개발 경계 — 2026-10-09

`version/v0.3`은 Desktop/Offline 검증 후보입니다. Netlify production/Supabase remote
schema/data/RLS를 이번에 변경하지 않았습니다. Web build 설정은 그대로이며 Desktop은
[desktop.yml](../.github/workflows/desktop.yml)의 Windows exe/NSIS artifact로 배포합니다.
installer에 WebView2 offline installer를 포함하며 build 다운로드는 온라인에서 수행합니다.
Windows 실제 offline CRUD/완전 종료/재실행/IME 합격은 manual-acceptance-v03.md에 기록합니다.
코드 commit·Actions artifact·검토 PR은 공식 production release와 구분합니다.

## Android artifacts

Android는 Netlify 배포 대상이 아닙니다. android.yml에서 ARM64 테스트 APK 및 emulator 검증을
수행하고 Actions artifact로 제공합니다. application ID app.timora.android, debug test signing.
Release APK/AAB와 keystore/Secrets 구조는 docs/android.md를 참고합니다. production signing,
Store 배포, 자동 업데이트는 미구현입니다. 실제 기기 gate 전에는 candidate로 표시합니다.
