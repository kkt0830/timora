# Issue #13 — v0.3.1

Source Issue: https://github.com/kkt0830/timora/issues/13
검수: https://github.com/kkt0830/timora/issues/13#issuecomment-6136867469

## 구현 범위

1. 실패 operation 하나가 후속 전송·pull을 막는 문제: 확정된 SQL 거부는 failed_at/last_error/attempts로 영속 보류. 동일 entity와 Project 의존성은 함께 보류하고 다른 항목은 진행합니다.
2. HTTP 400/403 일괄 재인증 안내: 요청 원천/Auth/SQLSTATE로 분류합니다. permission/schema 오류는 전송 오류이며 401/실제 Auth 실패만 재인증합니다.
3. fresh 기본값 충돌: 미편집 설정을 보내지 않고 pull로 baseline을 수립합니다. Cloud settings가 없으면 마지막 pull page 이후 초기값을 한 번 queue합니다.
4. 프로필 메뉴: native HTML dialog top-layer로 배경을 막고 viewport 높이에 맞춰 내부 scroll을 제공합니다. 바깥 click을 닫기 시점까지 소비합니다.
5. 반복 import 오류 문구를 자동 동기화/계정 인증 조건에 맞게 변경했습니다.

## 데이터 보존과 재시도

적용된 migration 001~003을 수정하지 않았습니다. 004_sync_recovery.sql은 SQLite에만 적용합니다. 기존 v3의 operation ID·payload·사용자 설정과 로컬 identity/사진은 보존합니다.

실패 항목의 원문과 현재 상태는 선택 전까지 보관합니다. **최신 내용으로 재시도** 확인 시 해당 entity의 이전 대기 operation을 현재 로컬 intent 하나로 대체하고 새 operation ID를 발급합니다. Library의 공백 URL은 이때 정규화합니다. Cloud와 진짜 충돌한 항목은 먼저 충돌 선택을 완료해야 합니다. 자동 폐기나 사용자 DB 초기화는 없습니다.

network/5xx로 서버 적용 여부가 불명확한 operation은 격리/ID 변경 없이 기존 receipt 재시도를 유지합니다. FK 거부는 우선 pull해 Project 삭제 충돌을 찾으며, 관련 충돌이 없으면 실패로 보관합니다. 관련 없는 다른 conflict가 있다고 FK를 무한 재시도하지 않습니다.

## 초기 설정의 보수적 판정

새 파일 또는 access_state=new인 미인증 설치만 기본값임을 확인할 수 있습니다. 기존 v3의 연결된/익명 로컬 설정은 사용자가 바꿨을 수 있어 자동으로 버리지 않습니다. 따라서 기존 설치에서 이미 생긴 settings conflict는 한 번 내용을 확인하고 Cloud/이 기기를 선택해야 할 수 있습니다. base_revision=NULL만으로 미편집이라고 단정하지 않습니다.

## 검증

Node 51, 실제 SQLite/Rust 20, 실제 두 SQLite/PostgreSQL/RLS, browser Web/Desktop/Android/Native-account 검사를 통과했습니다. 기존 거부 URL을 test DB에 seed해 독립 Note/pull 진행과 명시적 재시도·수렴을 확인했습니다. server commit 후 응답 유실의 멱등 재시도와 기존 Cloud settings를 가진 새 기기도 확인했습니다.

393×360에서 프로필 메뉴의 bounds와 393×852에서 첫 Home touch는 닫기만/두 번째 touch는 이동을 검사했습니다. Auth/IPC browser fixture는 실제 Android 세션/IME 검수를 대체하지 않습니다.

플랫폼 빌드 최종 source/Actions/artifact와 미검증 gate는 [verification](../verification.md)에 기록합니다.

## 범위 밖 / 남은 확인

- 사용자 원래 “가져오기 직후 중단”과 “겹친 두 handler”의 동일 환경 재현은 기기/정확한 오류 정보가 더 필요합니다. 위 확인한 결함을 모두 원래 현상의 확정 원인이라고 하지 않습니다.
- 고정 release 서명, 과거 다른 debug 서명 APK의 데이터 보존 업데이트, OS background worker, Cloud 사진 업로드, conflict 양쪽 사본/자동 병합, receipt/tombstone GC는 후속 설계입니다.
- 서명 불일치를 앱 삭제/데이터 초기화로 해결하지 않습니다. 운영 Supabase 변경·Netlify 배포·main merge는 이번 패치의 자동 실행 범위가 아닙니다.

## 모바일 실기기 확인 순서

1. 기존 기록이 있는 기기는 같은 서명의 업데이트만 사용합니다. 서명이 다르면 원본 앱을 보존하고 별도의 비어 있는 테스트 프로필/기기로 검사합니다.
2. 같은 Cloud 계정으로 연결한 두 기기에서 온라인 상태를 확인합니다. 한 기기를 오프라인으로 두고 Note와 Task를 저장한 뒤 앱을 종료/재실행해 내용이 남는지 확인합니다.
3. 네트워크를 켜고 Timora를 열어 둡니다. Cloud 동기화의 대기 수와 오류를 확인하고 다른 기기에서 같은 UUID/내용이 전달되는지 확인합니다. 앱이 완전히 종료된 동안 동기화하는 기능은 없습니다.
4. 기존 실패 항목이 있으면 원문·현재 내용을 확인한 뒤 최신 내용으로 재시도합니다. 해당 항목의 대기 변경을 대체하는 확인이 표시되고, 성공 시 실패 목록에서 사라지는지 확인합니다. 검사를 위해 개인 데이터에 의도적으로 오류를 넣을 필요는 없습니다.
5. Cloud 설정이 있는 새 테스트 설치에서 설정을 편집하지 않은 채 로그인했을 때 불필요한 settings 충돌이 없는지 확인합니다. 기존 v3에서 이미 생긴 충돌은 별도로 내용 확인 후 선택합니다.
6. 휴대폰 가로 화면/키보드 표시 후 프로필 메뉴의 모든 항목을 스크롤해 접근할 수 있는지 확인합니다. 메뉴 밖 Home을 처음 누르면 메뉴만 닫히고 다시 누르면 이동하는지 확인합니다.

실패 시 기기 모델/Android 버전/앱 버전, 수행한 단계, 동기화 화면의 오류 문구를 남깁니다. 비밀번호·토큰·확인 메일 링크는 포함하지 않습니다. 이 목록은 현재 PENDING이며 사용자 확인 전 완료로 바꾸지 않습니다.
