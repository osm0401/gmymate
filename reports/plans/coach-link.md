# 코치-회원 연결 및 트레이너 피드백 기능

## 목표

- 로그인한 회원이 코치의 초대를 명시적으로 수락해 연결하고, 연결된 코치가 회원이 선택해 공유한 완료 운동에 텍스트 피드백을 남길 수 있게 한다.
- 기능과 PR을 다음 순서로 분리한다.

| 순서 | 기능 | 백엔드 PR | 프론트엔드 PR | 선행 조건 |
|---|---|---|---|---|
| 0 | 세션·CSRF 보안 기반 | `be/session-security-baseline` | `fe/session-security-baseline` | 없음 |
| 1 | 코치-회원 연결 | `be/trainer-member-link-mvp` | `fe/trainer-member-link-mvp` | PR 0 |
| 2 | 운동별 트레이너 피드백 | `be/trainer-feedback-mvp` | `fe/trainer-feedback-mvp` | PR 1 |

- 저장소 역할 경계를 지킨다.
  - Codex: `api/**`
  - Claude: `src/**`, `*.html`, `docs/collab/**`
  - Gemini: `tests/**`, `scripts/**`, 리뷰 노트
- API·DB 용어는 `trainer`, 사용자 화면 문구는 “코치”로 통일한다.
- 고정 MVP 정책:
  - 코치 권한은 `user_data`나 회원가입 입력이 아닌 서버 관리 허용 목록으로 부여한다.
  - 코치 1명은 여러 회원을 맡을 수 있지만 회원은 활성 코치 1명만 연결할 수 있다.
  - 초대는 256비트 일회성 코드이며 24시간 후 만료된다.
  - 코드는 별도 채널로 복사·전달하고 URL에는 넣지 않는다.
  - 회원이 직접 선택한 완료 운동만 공유한다.
  - 피드백은 공유 운동당 코치 텍스트 1건, 1~1,000자이며 코치는 활성 연결 중에만 작성·수정할 수 있다.
  - 연결 해제 후 코치는 과거 공유 데이터와 피드백을 볼 수 없다. 회원은 과거 피드백을 보거나 공유 운동을 삭제할 수 있다.
- 비범위:
  - 이메일·SMS 초대, 트레이너 자격 자동 검증, 관리자 UI
  - 복수 코치, 그룹 코칭, 채팅·회원 답글, 첨부 이미지·영상
  - 푸시 알림, 운동 프로그램 처방·수정, 결제
  - 프로필·체중·인바디·회복·통증·부상·음악·진행 중 운동 공유
  - 기존 `user_data` 전체 동기화 구조 개편

## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)

- 현재 저장소는 `api/sync.php`가 계정당 `user_data.data_json` 전체를 last-write-wins로 저장한다. 관계·권한·피드백은 여러 사용자가 읽고 쓰는 서버 소유 데이터이므로 이 JSON에 넣으면 회원이 권한을 위조하거나 동시 저장으로 덮어쓸 수 있다. 따라서 D-B의 최소 예외로 정규화 테이블을 사용하되 운동 원본 저장 방식은 유지한다.
- 완료 운동은 `gmymateWorkoutHistory`에 최근 80건만 저장되고 ID도 클라이언트가 `session-${Date.now()}` 형태로 생성한다. 피드백이 이 ID만 참조하면 기록 삭제·가져오기 후 고아 데이터가 되므로, 회원이 공유할 때 서버가 허용 필드만 추출한 불변 스냅샷을 별도 저장한다.
- TrueCoach는 코치가 회원을 초대하고 운동 댓글을 읽고 답할 수 있으며, Everfit과 Trainerize도 완료 운동 문맥에 댓글을 연결한다. 따라서 “명시적 초대 → 운동 문맥 피드백” 흐름을 채택한다. 이메일·미디어·댓글 스레드는 현재 저장소에 관련 인프라가 없어 제외한다. [TrueCoach 회원 초대](https://help.truecoach.co/en/articles/2403903-adding-a-new-client), [TrueCoach 코치·회원 앱](https://help.truecoach.co/en/articles/8421397-truecoach-app-for-coaches-clients), [Everfit 완료 운동 댓글](https://help.everfit.io/en/articles/4346734-comments-for-completed-workouts), [Trainerize 운동 댓글](https://help.trainerize.com/hc/en-us/articles/360027798711-How-to-Use-Client-Comments-in-Workouts)
- 사용자명 검색 초대는 기존 가입 API의 계정 존재 여부 노출을 확대한다. 코치가 보안 난수 초대 코드를 만들고 회원이 직접 입력·수락하는 방식이 계정 열거와 오발송을 줄인다. PHP의 `random_bytes()`는 암호학적으로 안전한 난수 생성에 적합하므로 Composer 패키지는 필요 없다. [PHP `random_bytes`](https://www.php.net/random-bytes)
- 세션 쿠키는 자동 전송되므로 인증만으로 CSRF가 방지되지 않는다. PHP 문서와 OWASP는 상태 기반 앱에 세션 바인딩 토큰을 권고한다. 현재 `session.php`에는 CSRF 검증과 `session.use_strict_mode`가 없으므로 보안 기반 PR을 먼저 병합한다. [PHP 세션 보안](https://www.php.net/manual/en/features.session.security.management.php), [OWASP CSRF 방지](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- 연결·공유·피드백 ID를 요청자가 바꿀 수 있으므로 IDOR가 주된 위협이다. 복잡한 ID만으로 해결하지 않고 모든 조회·변경 SQL을 현재 세션 사용자와 활성 연결 조건으로 제한한다. [OWASP IDOR 방지](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- 코치에게 운동 데이터를 열람시키는 행위는 개인정보의 제3자 제공에 해당할 가능성이 높다. 건강정보는 민감정보이므로 수신자·목적·항목·보유기간·거부권을 알리는 별도 동의와 법무 검토가 필요하다. 본 MVP는 명시적인 건강정보 필드를 제외하지만 운동 스냅샷의 최종 법적 분류는 배포 전에 확인한다. [개인정보 보호법 제17조](https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1029335219), [개인정보 보호법 제23조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027416043)
- 2026-08-19 기준:
  - PHP 최신 안정판은 8.5.9, 유지되는 이전 안정판은 8.4.24다. 기능 코드는 8.5 전용 API를 쓰지 않되 배포는 지원 중인 최신 패치 버전에서 검증한다. [PHP 다운로드](https://www.php.net/downloads.php), [PHP 지원 버전](https://www.php.net/supported-versions.php)
  - MySQL 최신 8.4 LTS는 8.4.11이며 MySQL 8.0은 2026년 4월 EOL에 도달했다. 운영 DB가 8.0이면 기능 배포 전에 8.4 LTS 전환 계획을 확정한다. [MySQL 8.4.11](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-11.html), [MySQL 8.0 EOL](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)
  - MySQL의 `ON DUPLICATE KEY UPDATE ... VALUES(column)`는 deprecated다. 저장소 기존 코드에는 남아 있지만 신규 SQL에는 사용하지 않는다. [MySQL `VALUES()` deprecation](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
  - `@playwright/test` 최신판과 현재 lockfile은 모두 1.62.1이다. Playwright `<1.55.1`에 영향을 준 CVE-2025-59288 대상이 아니며 현재 `npm audit` 결과도 취약점 0건이므로 의존성을 변경하지 않는다. [npm `@playwright/test`](https://www.npmjs.com/package/%40playwright/test), [GitHub Advisory CVE-2025-59288](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- 현재 `npm test` 기준 110개 테스트가 통과한다. 다만 로컬에는 PHP CLI와 MySQL 클라이언트가 없으므로 PHP/MySQL 권한·동시성 검증은 전용 통합 환경에서 수행해야 한다.

## 세부 작업 체크리스트

### 기획·아키텍처 선행 작업

- [ ] Claude가 `decisions.md`에 새 ADR을 추가한다.
  - 관계·동의·공유 스냅샷·피드백은 서버 소유 정규화 테이블에 저장한다.
  - 원본 운동 기록은 기존 `user_data`에 유지한다.
  - 코치에게 `data_json` 원문을 반환하지 않는다.
  - 플랫 PHP 엔드포인트 구조를 유지하고 폐기된 `repositories/services` 계획을 되살리지 않는다.
- [ ] `backlog.md`에 보안 기반, 연결, 피드백의 `[BE]`, `[FE]`, `[REVIEW]` 항목을 각각 등록한다.
- [ ] 법무·개인정보 책임자가 연결 동의 문구와 공유 항목·보유기간을 승인한다.
- [ ] 운영 담당자가 코치 권한 부여·회수 절차와 최초 허용 계정을 확정한다.
- [ ] 운영 PHP·MySQL 정확한 버전, HTTPS, `Secure` 쿠키, HSTS 적용 여부를 기록한다.
- [ ] 각 기능에서 Gemini가 RED 테스트를 먼저 작성하고 Codex/Claude가 테스트를 변경하지 않은 채 구현한다.

### PR 0 · 세션·CSRF 보안 기반

- [ ] `session.use_strict_mode=1`을 세션 시작 전에 적용한다.
- [ ] 세션당 `random_bytes(32)` 기반 CSRF 토큰을 만들고 `hash_equals()`로 검증한다.
- [ ] 토큰은 URL·쿠키·localStorage에 넣지 않고 메모리에만 유지한다.
- [ ] 로그인·회원가입 성공과 세션 ID 재생성 시 토큰도 회전한다.
- [ ] 인증 전 로그인 화면도 토큰을 받을 수 있는 읽기 전용 JSON 엔드포인트를 둔다.
- [ ] 모든 unsafe 요청에 `X-CSRF-Token`과 정확한 `Origin` 검증을 적용한다.
- [ ] `logout.php`를 POST 전용으로 변경한다.
- [ ] OAuth 콜백 같은 외부 복귀 GET은 CSRF 토큰 대상에서 제외하되 기존 `state` 검증을 유지한다.
- [ ] 운영 쿠키에서 `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, host-only 속성을 확인한다.
- [ ] 공유 파일 rate limiter가 파일 열기·잠금에 실패하면 무제한 허용하지 않고 논리 상태 503을 반환하게 한다.
- [ ] 로그에 세션 ID, CSRF 토큰, 비밀번호, 요청 본문이 남지 않게 한다.
- [ ] FE는 공통 fetch 경로에서 unsafe 요청에 토큰을 자동 추가한다.
- [ ] BE 검증 강제는 FE 토큰 전송 PR이 병합된 후 활성화한다.

### PR 1 · 코치-회원 연결

- [ ] `api/schema.sql`에 다음 서버 소유 테이블을 추가한다.
  - `trainer_accounts`: 운영자가 관리하는 코치 허용 계정과 권한 회수 시각
  - `trainer_member_invites`: 코치, SHA-256 토큰 해시, 생성·만료·사용·취소 시각
  - `trainer_member_connections`: 코치, 회원, `active|disconnected`, 동의문 버전·동의·철회 시각
- [ ] 모든 사용자 FK는 기존 `users.id`와 동일한 `BIGINT`를 사용하고 계정 삭제 시 고아 행이 남지 않게 한다.
- [ ] nullable generated column과 UNIQUE 인덱스 등 DB 제약으로 회원당 활성 코치 1명 불변식을 보장한다.
- [ ] 재연결은 종료 행을 되살리지 않고 새 초대와 새 연결 행을 생성한다.
- [ ] 초대 코드는 256비트 base64url 문자열로 생성하고 원문은 생성 응답에서 한 번만 반환한다.
- [ ] 새 초대를 만들면 같은 코치의 미사용 초대를 취소한다.
- [ ] 초대 코드는 DB·로그·오류 메시지에 평문으로 저장하지 않는다.
- [ ] 회원은 로그인 후 코드를 붙여넣어 코치 사용자명과 만료 시각을 미리 확인한다.
- [ ] 수락 화면에 제공받는 코치, 목적, 공유 항목, 보유기간, 거부권·불이익을 표시한다.
- [ ] 수락 트랜잭션에서 초대 행을 `FOR UPDATE`로 잠그고 만료·취소·재사용·자기 연결·기존 활성 연결을 다시 검증한다.
- [ ] 요청 본문의 `trainerId`, `memberId`, `role`을 권한 근거로 사용하지 않는다.
- [ ] `sync.php`에 저장된 가짜 역할·연결 값은 권한에 영향을 주지 않는다.
- [ ] 양 당사자만 현재 연결을 조회하고 연결을 해제할 수 있게 한다.
- [ ] 연결 해제는 행을 `disconnected`로 전환하고 코치의 새 공유 데이터 접근을 즉시 차단한다.
- [ ] 생성·미리보기·수락·해제에 사용자 ID와 IP 기반 rate limit을 둔다.

제안 API 계약:

| 리소스 | 메서드 | 동작 |
|---|---|---|
| `api/trainer-invites.php` | GET | 헤더로 받은 초대 코드의 코치·만료 정보 미리보기 |
|  | POST | 허용된 코치가 새 초대 생성 |
|  | PATCH | 회원이 동의 정보와 함께 초대 수락 |
|  | DELETE | 코치가 미사용 초대 취소 |
| `api/trainer-connections.php` | GET | 현재 사용자가 당사자인 연결 조회 |
|  | DELETE | 활성 연결 해제 |

- [ ] 호스팅 제약상 실제 HTTP 상태는 기존처럼 200을 유지하고 응답 본문 `{ ok, status, data|error }`의 논리 상태를 계약으로 사용한다.
- [ ] 권한 없는 실존 객체와 존재하지 않는 객체는 동일한 논리 404로 응답한다.

### PR 2 · 회원 선택 운동 공유와 트레이너 피드백

- [ ] `trainer_shared_workouts`를 추가한다.
  - 연결 ID
  - 원본 세션 ID
  - 서버가 만든 허용 필드 전용 JSON 스냅샷
  - 공유 시각
  - `(connection_id, source_session_id)` 유일 제약
- [ ] `trainer_feedback`을 추가한다.
  - 공유 운동 ID
  - 1~1,000자 평문 본문
  - 생성·수정 시각
  - 공유 운동당 피드백 1건 유일 제약
- [ ] 피드백 길이를 애플리케이션과 DB `CHECK` 제약에서 모두 검증한다.
- [ ] 회원은 세션 ID만 전송한다. 클라이언트가 전송한 임의 운동 스냅샷을 저장하지 않는다.
- [ ] 서버는 현재 회원의 `user_data.gmymateWorkoutHistory`에서 세션을 찾고 다음 항목만 새 객체로 투영한다.
  - 세션 ID, 제목, 날짜, 완료 시각, 운동 시간
  - 운동명
  - 완료한 세트의 중량과 횟수
- [ ] 프로필, 체중, 목표, 인바디, 회복, 통증, 부상, 설정, 음악, 자유 입력 운동 메모, 진행 중 세트는 제외한다.
- [ ] 운동 20개, 운동당 완료 세트 20개, 직렬화 스냅샷 32KiB를 상한으로 두고 초과 데이터는 잘라 저장하지 말고 논리 422로 거부한다.
- [ ] 응답에 원본 운동 데이터의 마지막 서버 동기화 시각을 포함한다.
- [ ] 스냅샷은 공유 후 불변이다. 원본 기록 변경을 반영하려면 회원이 공유를 삭제하고 다시 공유한다.
- [ ] 코치의 공유 목록은 기본 20건, 최대 50건으로 제한하고 불투명 커서를 사용한다.
- [ ] 코치는 활성 연결에 속한 공유 운동만 조회할 수 있다.
- [ ] 피드백 생성·수정 시 연결 행을 `FOR UPDATE`로 잠가 연결 해제와의 경합을 차단한다.
- [ ] 동일 공유 운동에 다시 저장하면 새 행을 추가하지 않고 기존 한 건을 갱신한다. deprecated `VALUES()` 문법은 사용하지 않는다.
- [ ] 회원은 자신의 피드백을 읽을 수 있지만 코치 본문을 수정할 수 없다.
- [ ] 회원이 공유 운동을 삭제하면 연결된 피드백도 FK cascade로 삭제한다.
- [ ] 연결 해제 후 회원은 기존 피드백을 계속 볼 수 있지만 코치는 해당 연결 주기의 스냅샷·피드백을 조회하거나 수정할 수 없다.
- [ ] 같은 코치와 재연결해도 이전 연결 ID의 공유 데이터는 자동 복원하지 않는다.
- [ ] 피드백은 `textContent`로 렌더링하며 HTML 해석, 자동 링크, 마크다운을 지원하지 않는다.
- [ ] 알림과 오프라인 피드백 작성은 포함하지 않는다.

제안 API 계약:

| 리소스 | 메서드 | 동작 |
|---|---|---|
| `api/trainer-shared-workouts.php` | GET | 권한 범위 내 공유 운동 목록·상세 조회 |
|  | POST | 회원이 동기화된 완료 운동 한 건 공유 |
|  | DELETE | 회원이 공유 운동과 관련 피드백 삭제 |
| `api/trainer-feedback.php` | GET | 회원 또는 활성 코치가 피드백 조회 |
|  | PUT | 활성 코치가 공유 운동의 피드백 생성·교체 |

### 테스트·검증·인계

- [ ] `tests/backend-contract.test.mjs`의 “`user_id` 열이 정확히 3개” 검사를 제거하고 모든 `*_user_id`가 `BIGINT`인지 검사하도록 일반화한다.
- [ ] PHP 순수 검증·스냅샷 투영 로직에는 프레임워크 없는 최소 단위 테스트를 둔다.
- [ ] 권한·트랜잭션 테스트는 정규식 계약 테스트로 대체하지 않고 실제 PHP와 MySQL 8.4/InnoDB를 사용한다.
- [ ] 코치 2명, 회원 2명, 무관한 일반 계정 1명으로 IDOR 행렬을 검사한다.
- [ ] Playwright는 서로 독립된 브라우저 컨텍스트로 코치와 회원을 로그인시킨다.
- [ ] PHP 관련 신규 코드의 lines/branches/functions 커버리지를 각각 80% 이상 측정한다. 측정 환경이 없으면 완료로 처리하지 않는다.
- [ ] 다음 검증을 모두 통과시킨다.
  - `.\scripts\check.ps1`
  - `npm test`
  - `npm run test:e2e`
  - `npm audit --audit-level=high`
  - 전체 `api/**/*.php`의 `php -l`
  - MySQL 8.4 기반 API 통합·동시성 테스트
- [ ] Codex는 각 BE 작업을 `REVIEW`로 바꾸고 `handoffs.md`에 API 요청·응답 예시와 Claude/Gemini 검토 요청을 남긴다.
- [ ] Gemini가 보안 로그 샘플, DB 고아 행, FK·UNIQUE·CHECK 집행 여부까지 확인한 후에만 병합한다.

## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로

### 세션·보안 기반

- [ ] CSRF 토큰 누락·오류 또는 허용되지 않은 Origin의 unsafe 요청은 `{ ok:false, status:403 }`이며 DB가 변경되지 않는다.
- [ ] 로그아웃은 GET으로 실행되지 않으며 POST와 유효한 CSRF 토큰이 필요하다.
- [ ] 로그인·회원가입 후 세션 ID와 CSRF 토큰이 모두 이전 값과 다르다.
- [ ] 운영 세션 쿠키에 `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`가 존재한다.
- [ ] rate-limit 저장소 열기·잠금 실패를 재현하면 논리 상태 503이고 요청이 실행되지 않는다.
- [ ] 오류 응답에 SQL, 스택 트레이스, 파일 경로, 세션 ID가 포함되지 않는다.

### 코치-회원 연결

- [ ] `trainer_accounts`에서 활성화되지 않은 계정은 초대를 생성할 수 없다.
- [ ] `sync.php`에 `{ "role":"trainer" }`를 저장해도 초대를 생성할 수 없다.
- [ ] 생성된 초대 코드는 최소 256비트 난수이며 DB에는 원문과 다른 고정 길이 해시만 존재한다.
- [ ] 새 초대 생성 후 이전 미사용 코드는 실패하고 새 코드만 미리보기·수락할 수 있다.
- [ ] 만료·취소·변조·사용 완료 코드는 모두 동일한 논리 404와 일반 오류 문구를 반환한다.
- [ ] 코치 본인이 자신의 초대를 수락할 수 없다.
- [ ] 회원의 명시적 동의 전에는 연결과 데이터 공유가 생성되지 않는다.
- [ ] 동일 초대를 병렬로 두 번 수락하면 정확히 한 요청만 성공하고 연결은 한 건이다.
- [ ] 회원이 서로 다른 코치 초대 두 개를 병렬 수락해도 활성 연결은 정확히 한 건이다.
- [ ] 연결 ID를 다른 사용자 값으로 바꾼 조회·해제 요청은 모두 논리 404이고 상태가 변하지 않는다.
- [ ] 어느 당사자든 연결을 해제한 직후 이전 코치 세션의 신규 데이터 접근이 거부된다.
- [ ] 재연결은 새 연결 ID와 새 동의 시각을 생성한다.
- [ ] 회원 또는 코치 계정 삭제 후 초대·연결 고아 행이 0건이다.
- [ ] DB와 애플리케이션 로그에 초대 원문, 사용자명, 동의 화면 입력이 남지 않는다.

### 운동 공유·피드백

- [ ] 공유하지 않은 운동은 코치 응답에 나타나지 않는다.
- [ ] 회원이 전송한 임의 스냅샷 객체는 무시되고 서버 `user_data`에 실제 존재하는 완료 세션만 공유된다.
- [ ] 코치 응답에는 원본 `data_json`이나 `gmymateProfile`, `gmymateInBodyLogs`, `gmymateRecoveryCheckins`, `painAreas`, `injuryAreas`가 포함되지 않는다.
- [ ] 허용 스냅샷은 세션 정보·운동명·완료 세트 중량·횟수 외의 키를 포함하지 않는다.
- [ ] 연결되지 않은 코치와 무관한 회원이 연결·공유 운동·피드백 ID를 바꿔도 한 건도 조회·수정하지 못한다.
- [ ] 피드백의 공백 제거 후 길이가 0이면 논리 400, 정확히 1,000자는 성공, 1,001자는 논리 400이다.
- [ ] 배열·객체·잘못된 UTF-8 피드백 입력은 거부된다.
- [ ] `<img src=x onerror=alert(1)>` 형태의 문자열은 DOM 요소로 생성되거나 실행되지 않고 평문으로만 표시된다.
- [ ] 동일 공유 운동에 피드백을 두 번 저장해도 DB 행은 한 건이며 본문과 `updated_at`만 갱신된다.
- [ ] 연결 해제와 피드백 저장을 병렬 실행해도 해제 커밋 이후 생성·수정된 피드백은 0건이다.
- [ ] 연결 해제 후 회원은 과거 피드백을 읽을 수 있지만 이전 코치는 읽거나 수정할 수 없다.
- [ ] 같은 코치와 재연결해도 이전 연결 주기의 공유 데이터가 코치에게 노출되지 않는다.
- [ ] 회원이 공유 운동을 삭제하면 관련 스냅샷과 피드백 행이 모두 삭제된다.
- [ ] 어느 한쪽 계정 삭제 후 공유 운동·피드백 고아 행이 0건이다.
- [ ] 코치 목록 응답은 최대 50건을 넘지 않으며 커서가 다른 연결의 데이터를 노출하지 않는다.
- [ ] 초대·피드백·운동 데이터가 로그, URL, 외부 분석·광고 요청에 포함되지 않는다.

### 전체 품질

- [ ] 기존 110개 테스트와 신규 테스트가 모두 통과한다.
- [ ] 신규 PHP 핵심 로직의 lines/branches/functions 커버리지가 각각 80% 이상이다.
- [ ] 실제 MySQL 8.4/InnoDB 환경에서 FK, UNIQUE, CHECK가 `ENFORCED` 상태다.
- [ ] 코치 초대 → 회원 수락 → 운동 선택 공유 → 코치 피드백 → 회원 확인 → 연결 해제의 E2E 흐름이 통과한다.
- [ ] 기존 운동 기록·동기화·로그인·계정 삭제·음악 기능의 회귀 테스트가 통과한다.
- [ ] `package.json`과 lockfile에 신규 런타임 의존성이 추가되지 않는다.

## 예상 리스크

- 새 정규화 테이블은 D-B의 예외다. ADR 승인 없이 구현하면 저장소 규약 위반이다.
- 운영 DB가 여전히 MySQL 8.0이면 이미 EOL 상태다. 8.4 LTS 전환 검증 없이는 출시하지 않는다.
- 현재 로컬 환경에는 PHP/MySQL이 없어 정적 테스트만 통과하고 실제 트랜잭션 문제가 남을 수 있다. 운영과 같은 통합 환경이 필수다.
- `jsonResponse()`가 실제 HTTP 상태를 항상 200으로 보내므로 WAF·프록시·모니터링이 401·403·429를 직접 구분하지 못한다. 이번 기능은 본문 상태 계약을 유지하되 HTTP 상태 정상화는 호스팅 이전 또는 별도 PR로 다룬다.
- 운동 기록은 오프라인 우선·last-write-wins이므로 회원이 동기화하지 않은 최신 운동은 공유할 수 없다. UI에 마지막 동기화 시각을 표시한다.
- 클라이언트 생성 세션 ID는 DB FK 대상이 아니다. 서버가 공유 시점에 원본을 검증하고 불변 스냅샷을 만드는 것으로 한정한다.
- 코치가 작성한 자유 텍스트에 부적절하거나 의료적 오해를 부르는 내용이 포함될 수 있다. 회원의 공유 삭제·연결 해제 경로와 “의료 진단이 아님” 안내를 제공하고 신고·관리 기능은 별도 PR로 다룬다.
- 서버 관리 코치 허용 목록은 소규모 MVP에만 적합하다. 셀프서비스 자격 심사나 조직 관리가 필요해질 때 별도 권한 관리 기능으로 교체한다.
- 회원당 코치 1명 제약은 팀 코칭을 지원하지 않는다. 복수 코치 요구가 확정되면 스키마·동의·접근 제어를 별도 기능으로 설계한다.
- 공유 파일 기반 rate limiter는 단일 공유 호스트에만 적합하다. 서버가 여러 대가 되면 Redis 등 원자적 공유 저장소로 교체한다.
- 24시간 초대 코드는 외부 채널에서 유출될 수 있다. 짧은 만료, 일회성 사용, 새 코드 생성 시 회전, 회원 수락 화면의 코치 확인으로 완화한다.
- 연결 해제 후 피드백을 회원에게 보존하는 정책은 법무 승인 대상이다. 승인되지 않으면 연결 해제 시 공유 스냅샷과 피드백을 함께 삭제하는 정책으로 변경한다.

## 참고 링크

- [TrueCoach — Adding a New Client](https://help.truecoach.co/en/articles/2403903-adding-a-new-client)
- [TrueCoach — App for Coaches & Clients](https://help.truecoach.co/en/articles/8421397-truecoach-app-for-coaches-clients)
- [Everfit — Add a Client](https://help.everfit.io/en/articles/2836186-add-a-client)
- [Everfit — Comments for Completed Workouts](https://help.everfit.io/en/articles/4346734-comments-for-completed-workouts)
- [Trainerize — Client Workout Comments](https://help.trainerize.com/hc/en-us/articles/360027798711-How-to-Use-Client-Comments-in-Workouts)
- [PHP — Supported Versions](https://www.php.net/supported-versions.php)
- [PHP — Downloads](https://www.php.net/downloads.php)
- [PHP — `random_bytes`](https://www.php.net/random-bytes)
- [PHP — Session Security](https://www.php.net/manual/en/features.session.security.management.php)
- [MySQL — 8.4.11 Release Notes](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-11.html)
- [MySQL — 8.0 EOL](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/)
- [MySQL — `VALUES()` Deprecation](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)
- [npm — `@playwright/test`](https://www.npmjs.com/package/%40playwright/test)
- [GitHub Advisory — CVE-2025-59288](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- [OWASP — IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [OWASP — CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [국가법령정보센터 — 개인정보 보호법 제17조](https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1029335219)
- [국가법령정보센터 — 개인정보 보호법 제23조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027416043)
