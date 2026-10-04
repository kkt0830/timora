# Requirements — Timora v0.2

기존 정식 v0.1 위에서 일상 사용 경험을 개선합니다. main에서 직접 개발하지 않고
version/v0.2 → 테스트 → PR → 검토 → merge를 사용합니다.

## 필수 범위

- DESIGN.md의 Timora 원칙, 단일 accent #0066cc, system font, readable density,
  hairline, 제한된 shadow, Light/Dark/System과 공통 controls.
- Home/Today/Inbox/Tasks/Notes/Calendar/Projects/Library/Settings의 기존 기능 보존.
- Profile 메뉴의 Profile/Settings/Logout, 모바일 focus/Escape/44px target.
- 가입 닉네임 및 Profile 편집. 기존 계정은 이메일/initials fallback.
- Avatar HTTPS URL 변경·제거·실패 fallback. Storage 업로드는 포함하지 않음.
- 모든 핵심 객체 기본 텍스트 검색과 결과 Object 직접 접근.
- 상시 Refresh 제거, 저장 응답 상태 반영, focus/online 재조회, Error Retry.
- 사용자별 settings profile 컬럼 migration, 기존 RLS/소유 데이터 유지.
- TypeScript/단위/Build/Browser/Postgres RLS·CRUD 회귀 검사 및 결과 문서화.

## 구현 결정

기존 WorkspaceRepository/AuthService를 유지하고 검색을 순수 domain 함수로 둡니다.
Avatar 업로드 대신 URL 방식으로 최소 profile image 기능을 제공합니다. DB에는
workspace_settings.display_name/avatar_url만 추가하고 새 owner 테이블은 만들지 않습니다.
닉네임은 중복 허용 표시명이며 권한/사용자 ID로 쓰지 않습니다.
단순 검색은 메모리의 현재 계정 데이터만 사용하고 고급 검색 엔진은 도입하지 않습니다.

## 제외

Project cover, Notes/Inbox 첨부·Drawing, GitHub Integration, Backlink/Graph,
SQLite 도입·Desktop 앱·Cloud Sync·Offline·Command Palette. 기존 v0.1의
Task date-only, Event UTC/local overlap, Inbox 원자적 이동 계약을 유지합니다.

## 배포

검토 후보와 production을 구분합니다. v0.2 migration은 PR 검토 후 웹 배포 전에
적용하고 실제 profile/로그인/저장 확인을 수행합니다. 개발마다 production 배포하지 않습니다.
