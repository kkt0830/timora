# 자동 Cloud 동기화 개발 체크포인트

저장일: 2026-10-10. 사용자 요청으로 개발을 중단하고 `version/v0.3`에 저장한 **WIP / 미배포** 상태입니다. 자동 동기화가 완성된 설치 버전은 아닙니다.

## 현재 사용 중인 버전

- 개발 시작 기준: `3671b2904fc4e621cab0651183008014d9f719bd`.
- 확인한 main: `77cd813c2f8701ac1a2ddb11f011aa93c51b6a2c`. 이 체크포인트는 main에 반영하지 않습니다.
- 기존 검증된 앱 소스: `e0152c6b54b168dd341b9a4b828bc28577bfca54`.
- [Android 테스트 APK](https://github.com/kkt0830/timora/actions/runs/37960236652/artifacts/11630279456), [Windows 설치 파일](https://github.com/kkt0830/timora/actions/runs/37960236583/artifacts/11630293980).
- 사용자는 Android 앱 실행과 Cloud에서 가져오기가 잘 작동한다고 보고했습니다. 기기 모델·OS와 상세 테스트 범위는 제공되지 않았습니다. 사진 파일 영속성 등 다른 항목까지 통과한 것으로 확대하지 않습니다.
- 운영 Web은 https://timora-sfj2.netlify.app 의 기존 v0.2입니다. 이번 작업으로 Netlify 재배포, 새 APK 배포, 운영 Supabase DDL 적용을 하지 않았습니다.

## 요청과 설계 방향

Native에서 오프라인으로 저장한 내용을 온라인 복귀 시 같은 계정의 Supabase로 자동 전송하고, 다른 기기의 변경도 가져옵니다. SQLite를 먼저 저장하며 전송 실패로 로컬 기록을 잃지 않도록 합니다.

- 로컬 변경과 durable outbox를 같은 SQLite 트랜잭션으로 기록합니다.
- 요청 ID/서버 receipt로 응답 유실 후 재전송을 처리합니다.
- 서버 revision/cursor와 삭제 tombstone으로 변경을 가져옵니다.
- 계정과 프로젝트 URL에 묶인 OS 보안 저장소에 refresh credential만 보관합니다.
- 충돌은 양쪽 내용을 보존하고 사용자가 로컬/Cloud 중 선택하도록 합니다.
- 앱 실행·온라인 복귀·포커스 복귀·로컬 변경 및 foreground polling을 동기화 계기로 사용합니다.
- 앱 완전 종료 중 OS background worker, 사진 파일 업로드, Web 오프라인 편집은 이번 범위에 포함하지 않습니다.

## 작성한 코드 — 모두 추가 검증 필요

| 영역 | 파일 | 작성 상태 |
| --- | --- | --- |
| SQLite migration | `src-tauri/migrations/003_durable_sync.sql`, `src-tauri/src/lib.rs` | schema v3, outbox/metadata/conflicts, 기존 기록 seed, import 시 queue 억제 |
| Native sync | `src-tauri/src/sync.rs`, `src-tauri/src/runtime.rs` | 상태/다음 작업/ack/pull page/충돌 선택 IPC와 계정 검증 |
| Cloud migration | `db/migrations/20261010030830_native_workspace_sync.sql` | revision feed, triggers, receipts, owner RLS, invoker RPC 초안. **실행하지 않음** |
| Secure credential | `src-tauri/src/session_vault.rs`, `src-tauri/gen/android/app/src/main/java/app/timora/android/SessionVaultPlugin.kt` | Android Keystore 암호화와 Windows Credential Manager 초안. 플랫폼 빌드 미검증 |
| Native Auth | `src/data/local-repository.ts`, `src/data/supabase-auth.ts` | credential 복구/회전 저장, 로그인·로그아웃 epoch 방어 |
| Service | `src/services/cloud-sync.ts`, `src/services/backend.ts`, `src/services/contracts.ts` | foreground single-flight push/pull, 실제 Cloud 사용자 확인, retry/status |
| React | `src/app/providers.tsx`, `src/app/SyncPage.tsx` | 재연결·polling·상태 context와 충돌 화면 초안. **라우트/Navigation/CSS 연결 미완료** |
| Dependencies/test | `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tests/account_profile.rs` | Windows keyring 추가, 기존 schema 버전 assertion 수정 |

Service/provider에 WIP 동기화 코드가 연결되어 있으므로 이 브랜치를 바로 설치·배포하지 마세요. Cloud migration이 없는 현재 운영 환경에서 RPC가 동작하는 상태가 아닙니다. SQLite v3 migration 이후에는 기존 v2 앱으로 되돌릴 수 있다고 가정하지 않습니다. 사용 중인 앱을 제거하거나 데이터를 초기화하지 않습니다.

## 실제 검사 결과

- 최신 `npm run typecheck`: 성공.
- `git diff --check`: 성공.
- 변경 초기의 `cargo test --locked --no-default-features`: core 컴파일 성공, account_profile 테스트 중 기존 schema 기대값 2와 실제 3 차이로 1건 실패. 기대값을 3으로 수정했으나 **수정 후 재실행하지 않았습니다**. 전체 Rust 테스트 통과로 표기하지 않습니다.
- 신규 동기화 테스트, SQL 실행/RLS 검증, production build, Windows/Android 빌드, 에뮬레이터·실기기 동기화 검증은 아직 수행하지 않았습니다.
- 이전 버전의 CI/실기기 확인을 이번 WIP의 검증 결과로 사용하지 않습니다.

## 다음에 진행할 순서

1. 이 문서와 README, 현재 Git 차이를 확인하고 `version/v0.3`에서 이어갑니다. main에 직접 개발하거나 새 PR을 만들지 않습니다.
2. SQLite migration, transactional outbox, 기존 import, ack 유실/재전송, 계정 차단, 충돌과 Project/child 의존성 테스트를 추가합니다. 기존 Rust 테스트를 다시 실행하고 formatting을 확인합니다.
3. 별도 로컬 PostgreSQL에서 Cloud SQL의 syntax/권한/RLS, optimistic conflict, receipt 재전송, 삭제 전파, Web CRUD triggers, commit 순서 및 FK 의존성을 검증합니다. **이미 없는 행의 delete가 불필요한 conflict가 되는지** 확인합니다. 운영 데이터로 실험하지 않습니다.
4. Cargo.lock의 새 keyring 외에 따라 바뀐 `cc`/`syn` 버전을 검토하고 불필요한 업데이트를 줄입니다.
5. Android plugin 등록/Keystore와 Windows vault를 실제 빌드하고 로그인·재실행·오프라인·토큰 회전·명시적 로그아웃을 검증합니다. 비밀번호나 refresh token을 로그/문서/저장소에 기록하지 않습니다.
6. SyncPage를 라우트/Navigation에 연결하고 상태 표시·좁은 화면·오류/재로그인·충돌 선택 UI를 완성합니다. 기존 Profile/Settings의 설명도 구현과 맞춥니다.
7. TS service/provider의 logout/abort/StrictMode/부분 성공/통신 오류 회귀 테스트와 production build를 수행합니다.
8. 검증을 통과한 migration만 기존 기록 보존을 확인하여 운영 Supabase에 적용하고 security/performance advisors를 확인합니다. 현재 준비된 SQL은 적용 이력이 없습니다.
9. 두 계정 간 격리와 두 기기 간 생성/수정/삭제, airplane mode 후 reconnect, 앱 재실행, 동시 편집 충돌을 확인합니다. 기존 데이터·사진을 보존하고 APK 서명 차이 때문에 재설치를 요구하지 않습니다.
10. README/architecture/data-model/verification을 실제 완료 상태로 업데이트하고 필요한 설치 산출물을 만듭니다. 미완료 상태를 정식 릴리스로 표시하지 않습니다.

## 환경 재구성 참고

현재 workspace의 Node/Rust/Android 도구와 `/tmp` 파일은 다음 세션에도 존재한다고 가정하지 않습니다. Repository의 package lock, Cargo.lock 및 GitHub Actions 설정을 기준으로 준비합니다. 공개 Supabase 설정은 기존 GitHub Actions Repository variables에 등록되어 있으며 비밀 키를 소스에 추가하지 않습니다.

이번 세션의 보조 도구: `/tmp/timora-supabase-cli/supabase` (2.79.0), `/tmp/timora-postgres-tools`의 embedded-postgres 17.9.0-beta.17. SQL filename 생성에 CLI를 사용했으나 테스트 DB는 아직 시작하지 않았습니다. 최신 CLI는 읽기 전용 home의 `.supabase` 접근 문제로 실행되지 않았습니다. HOME 변경 대신 workspace에 설치한 도구를 사용했습니다. 임시 파일은 checkpoint에 포함하지 않습니다.

## 재개 요청 예시

> `kkt0830/timora`의 `version/v0.3`에서 `docs/cloud-sync-checkpoint.md`를 먼저 읽고 자동 Cloud 동기화 개발을 이어서 진행해줘. 현재 Android 앱과 데이터를 보존하고, 체크포인트를 완료된 기능으로 간주하지 마. 새로운 PR 없이 기존 버전 브랜치에서 구현과 검증을 마쳐줘.
