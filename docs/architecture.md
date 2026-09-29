# Architecture — 초기 경계

현재는 **단일 웹 프런트엔드**입니다. 향후 Desktop, Mobile, Backend가 나뉠 수 있도록 UI와 데이터 계약의 소유권을 구분합니다. 현재 저장소에 백엔드나 모바일 런타임이 존재한다는 뜻은 아닙니다.

```text
현재:
Browser → React Router / Screen → typed sample data

향후 후보:
Desktop Web / Windows shell ─┐
                             ├→ shared domain contracts → application services → repository interfaces → backend adapters
Android / Tablet UI ──────────┘                                             ├→ Supabase Auth / Database / Storage
                                                                            └→ GitHub adapter
```

## 경계별 책임

| 경계 | 현재 | 후속 방향 |
| --- | --- | --- |
| UI | `src/app/App.tsx`, `src/styles.css` | 기능별 화면/컴포넌트 분리, 로딩/오류 상태 |
| Domain | `src/domain/models.ts`의 UI 계약 | 앱 공통 객체 ID, 상태 전이, 관계 규칙 |
| Data | `src/data/sample.ts` | Repository 인터페이스 + 로컬 구현 + 서버 구현 |
| Backend | 없음 | 인증 검증, 사용자별 권한, 파일 저장, 연동 동기화 |
| Platform | 브라우저 | Windows shell, Android/Tablet 및 위젯 어댑터 |

## 확장 순서와 규칙

1. 화면에서 샘플 배열을 직접 import하는 부분을 Repository 호출로 치환합니다. Repository의 출력은 도메인 계약으로 고정합니다.
2. 인증 공급자를 결정할 때 세션 수명, 로그인/로그아웃, 서버의 사용자 검증 및 권한 경계를 설계합니다.
3. Supabase를 선택하면 인증, 데이터, Storage의 adapter를 둡니다. 브라우저에는 공개용 설정만 노출하고 비밀 키는 서버 측에만 둡니다. 공개 스키마 테이블에는 RLS와 실제 소유권 정책을 설계·검증합니다. 이 문서는 SQL이나 정책 구현을 포함하지 않습니다.
4. GitHub 연결은 별도 integration 계층에서 토큰과 권한을 다룹니다. 외부 데이터 ID는 내부 객체 ID와 구분합니다. 연동의 실패나 연결 해제가 핵심 작업 데이터를 지우지 않게 설계합니다.
5. 검색, 명령 팔레트, Quick Capture는 application service를 호출하는 여러 진입점이 됩니다.
6. Windows와 Android는 UI와 OS 기능을 각각 구현하되 안정된 도메인 계약과 API를 재사용합니다.
7. 동기화 전 삭제 표식, 버전, 변경 시각, 충돌 처리 방식과 offline queue를 결정합니다. 클라이언트 시간을 유일한 충돌 판단 근거로 삼지 않습니다.

## 현재 알려진 제약

- 샘플 데이터는 읽기 전용이고, 고정 날짜를 사용합니다.
- `App.tsx`는 초기 골격이어서 한 파일에 화면이 모여 있습니다. 실제 v0.1 개발 초기 작업은 feature 단위로 분리하는 것입니다.
- 인증, SQL 스키마, 저장소 버킷, 서버 API, 데스크톱 패키저, 모바일 프레임워크는 아직 선택하지 않았습니다. 구현 시 해당 기술의 최신 공식 문서를 확인합니다.
