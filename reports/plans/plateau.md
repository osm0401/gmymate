# 종목별 정체기 자동 감지 및 루틴 변경 제안

## 목표

- 단일 PR `fe/exercise-plateau-suggestions-mvp`로 기존 운동 분석 화면에 **종목별 `기록상 정체 가능성`과 다음 루틴의 비파괴적 변경안**을 표시한다.
- “정체기”를 의학적·생리학적으로 확정하지 않는다. 완료 기록을 이용한 제품 휴리스틱임을 UI에 명시한다.
- 판정 정책은 다음 값으로 고정하고 한 상수 객체에서 관리한다.
  - 비교 가능한 기록: 종목별 최소 6회
  - 비교 창: 이전 3회와 최근 3회
  - 조회 범위: 최근 84일
  - 최신 기록 허용 나이: 기준일로부터 28일 이내
  - 의미 있는 향상: 최근 창 최고치가 이전 창 최고치보다 2% 이상 높음
  - 추정 1RM 대상: 중량이 있고 반복수가 1~12회인 완료 세트
- 중량 종목은 기존 앱과 같은 Epley 추정 1RM, 무중량 종목은 최고 수행량을 비교한다.
- 정체 신호가 있으면 자동 증량·디로딩 대신 다음 한 가지만 제안한다.
  - 중량 종목: 최근 중량을 유지하고 대표 세트에서 1회 추가 시도
  - 무중량 종목: 최근 최고 수행량보다 1단위 추가 시도
- 제안은 선택된 종목의 기존 분석 차트 아래에서만 보여준다. 저장된 루틴이나 기록은 수정하지 않는다.
- 담당:
  - 기획·FE: Claude — `docs/collab/**`, `src/**`
  - 테스트·리뷰: Gemini — `tests/**`, 리뷰 노트
  - BE: 변경 없음
- 변경 예상 파일:
  - `src/core/analytics.js`
  - `src/features/analytics.js`
  - `src/styles/portfolio.css`
  - `tests/analytics.test.mjs`
  - `tests/e2e/portfolio-flow.spec.mjs`
- 비범위:
  - `api/**`, DB 스키마, 동기화 계약 변경
  - 새 localStorage 키 또는 판정 결과 저장
  - AI·LLM·외부 분석 API
  - 저장된 `gmymateCustomRoutines` 자동 변경
  - 종목 자동 교체, 디로딩 처방, 푸시 알림
  - RPE/RIR·수면·회복도 기반 개인화
  - 새 npm·Composer 의존성

## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)

- 저장소는 완료 세션을 `gmymateWorkoutHistory`에 최대 80개 보관하고, `src/core/analytics.js`가 이미 완료 세트만 정규화해 종목별 진행 데이터를 만든다. `src/features/analytics.js`도 같은 데이터를 표시하므로 새 서버 API 없이 기존 흐름을 확장하는 것이 가장 작고 오프라인·샘플 모드도 유지한다.
- `api/sync.php`는 계정별 JSON 블롭을 last-write-wins로 저장한다. 정체 신호는 원본 기록에서 매번 계산 가능한 파생 데이터이므로 저장하면 동기화 충돌과 페이로드만 늘어난다. 판정 결과는 저장하지 않는다.
- 2026 ACSM Position Stand는 점진적 저항운동을 지지하지만, 복잡한 주기화나 실패지점 훈련이 일관된 추가 효과를 보인다고 결론 내리지 않았다. 보편적인 “몇 회 연속이면 정체” 기준도 제시하지 않는다. 따라서 6회·2%·84일 기준은 과학적 진단 기준이 아닌 보수적인 제품 휴리스틱으로 표시한다. [ACSM 2026 Position Stand](https://pubmed.ncbi.nlm.nih.gov/41843416/)
- ACSM의 기존 진행 지침은 목표 반복수보다 1~2회를 더 수행할 수 있을 때 부하를 2~10% 올리는 방식을 제시한다. 현재 데이터에는 목표 반복수와 RIR이 없으므로 자동 증량을 계산하지 않고 “같은 중량에서 1회 추가”까지만 제안한다. [ACSM Progression Models](https://pubmed.ncbi.nlm.nih.gov/19204579/)
- 훈련된 성인을 대상으로 한 연구에서는 중량 증가와 반복수 증가 모두 점진적 과부하 전략으로 사용할 수 있었다. 작은 중량 단위를 계산하거나 새 설정을 만들지 않아도 되는 반복수 우선 제안을 택한다. [Load vs. repetition progression 연구](https://pubmed.ncbi.nlm.nih.gov/36199287/)
- 추정 1RM 식의 정확도는 운동과 반복수에 따라 달라지며 최근 교차검증 연구는 4~10회 범위를 권고했다. 기존 앱은 Epley 식을 이미 사용하므로 이를 재사용하되, 과도한 고반복 왜곡을 줄이기 위해 12회를 상한으로 두고 결과를 “추정치”로만 표현한다. [1RM 식 교차검증 연구](https://pubmed.ncbi.nlm.nih.gov/39495260/)
- Fitbod는 과거 수행뿐 아니라 목표, 장비, 회복도, RIR과 사용자 피드백까지 사용해 세트·반복·중량을 조정한다. 현재 저장소에는 그 입력이 충분하지 않으므로 같은 수준의 개인화나 종목 자동 교체를 흉내 내지 않는다. [Fitbod 추천 생성 방식](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- Hevy Trainer는 AI가 아닌 결정론적 알고리즘으로 수행 기록에 따라 증량 시점과 크기를 제안한다. MVP도 외부 AI 없이 입력과 판정 근거가 재현되는 규칙을 사용한다. [Hevy Trainer](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program)
- Strong은 종목별 이력·차트·예상 기록을 중심으로 진행 상황을 보여준다. 이번 PR도 사용자가 선택한 종목의 기존 분석 화면에 근거와 제안을 함께 배치한다. [Strong Exercise Detail](https://help.strongapp.io/article/237-about-exercise-detail)
- Alpha Progression은 과거 수행을 이용한 중량·반복수 목표와 double progression을 제공한다. 이번 MVP는 이 중 가장 작은 부분인 “반복수 우선 제안”만 채택한다. [Alpha Progression](https://alphaprogression.com/en/glossary/progression)
- 2026-08-19 기준 `@playwright/test` 최신 안정판은 `1.62.1`이며 현재 lockfile도 `1.62.1`이다. Playwright `<1.55.1`에 영향을 준 CVE-2025-59288의 대상이 아니므로 의존성을 변경하지 않는다. [npm @playwright/test](https://www.npmjs.com/package/%40playwright/test), [GHSA-7mvr-c777-76hp](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- Playwright의 `page.type()`·`locator.type()` 등은 deprecated지만 현재 E2E는 `locator.fill()`과 역할 기반 locator를 사용한다. 신규 테스트도 같은 API를 사용한다. [Playwright release notes](https://playwright.dev/docs/release-notes)
- 최신 Playwright는 Node.js 20 이상을 요구한다. 구현·CI 환경에서 `node --version`을 먼저 확인한다.
- PHP 8.5.9와 Composer 2.10.2도 확인했지만 저장소에 Composer manifest가 없고 이번 계산은 표준 JavaScript의 정렬·최댓값·산술만으로 충분하다. PHP·Composer·통계 패키지는 추가하지 않는다. [PHP downloads](https://www.php.net/downloads.php), [Composer downloads](https://getcomposer.org/download/)

## 세부 작업 체크리스트

### 작업 착수·TDD

- [ ] Claude가 `backlog.md`에 `[FE] 종목별 정체 가능성 감지 및 루틴 변경 제안 MVP`를 등록하고 `DOING`으로 전환한다.
- [ ] 현재 복구 브랜치가 아니라 승인된 `main`에서 `fe/exercise-plateau-suggestions-mvp`를 생성한다.
- [ ] 6회·2%·84일·28일 정책과 사용자 문구를 제품 책임자 또는 운동 전문가에게 확인받는다.
- [ ] Gemini가 구현 전에 아래 단위·E2E 사례를 RED 테스트로 작성한다.
- [ ] 최종 PR에는 테스트 커밋과 구현 커밋을 함께 포함한다.

### 판정 순수 로직

- [ ] `src/core/analytics.js`에 판정 정책을 하나의 불변 상수로 정의한다.
- [ ] 기존 날짜 정규화와 완료 세트 처리 흐름을 재사용한다. 별도 분석 파일이나 클래스는 만들지 않는다.
- [ ] 다음 데이터만 비교 대상으로 인정한다.
  - 유효한 `dateKey` 또는 `finishedAt`
  - 비어 있지 않은 문자열 `exerciseId`
  - `done === true`
  - 유한한 비음수 `weight`
  - 유한한 양수 `reps`
  - `type`이 없거나 `normal`인 세트
- [ ] 미래 날짜, 드롭세트, 미완료 세트, `NaN`, 음수, 손상된 객체는 조용히 제외한다.
- [ ] 동일 종목의 같은 날짜 기록은 가장 높은 비교 점수 하나만 남겨 같은 날 중복 운동이 여러 세션으로 계산되지 않게 한다.
- [ ] 최신 유효 기록이 중량 종목이면 중량 모드, 중량이 0이면 수행량 모드로 정하고 동일 모드 기록끼리만 비교한다.
- [ ] 중량 모드는 완료 세트 중 반복수 1~12회의 Epley 추정 1RM 최고값을 세션 점수로 사용한다.
- [ ] 수행량 모드는 완료 세트의 최고 `reps` 값을 세션 점수로 사용한다.
- [ ] 종목별 최신 6회가 모두 최근 84일 안에 있고 최신 기록이 28일 이내일 때만 판정한다.
- [ ] 시간순 첫 3회의 최고값을 `previousBest`, 뒤 3회의 최고값을 `recentBest`로 계산한다.
- [ ] `recentBest < previousBest × 1.02`이면 `no-meaningful-progress` 신호를 반환하고, 정확히 2% 이상이면 반환하지 않는다.
- [ ] 결과에는 `exerciseId`, 표시명, 비교 방식, 두 최고값, 변화율, 최신 날짜, 비교 세션 수만 포함한다. 전체 세션·노트·프로필은 포함하지 않는다.
- [ ] 결과는 최신 날짜 내림차순, 동률이면 `exerciseId` 오름차순으로 고정한다.
- [ ] 입력 배열과 내부 객체를 수정하지 않고 반환값을 깊게 동결한다.
- [ ] `summarizeWorkoutHistory()` 결과에 파생 `plateauSignals`를 포함하되 기존 `exerciseProgress` 계약은 바꾸지 않는다.
- [ ] 계산은 최대 80세션을 한 번 순회하는 O(n)으로 유지한다. 캐시와 저장 키는 만들지 않는다.

### 분석 화면·제안

- [ ] `src/features/analytics.js`가 선택된 종목과 일치하는 신호만 표시하도록 한다.
- [ ] 신호 카드에는 다음 정보를 텍스트로 표시한다.
  - `기록상 정체 가능성`
  - `최근 6회 기록 기준`
  - 이전 창과 최근 창의 비교값 및 변화율
  - 판정이 참고용 기록 분석이라는 설명
- [ ] 중량 종목에는 `다음 루틴에서는 최근 중량을 유지하고 한 세트에 1회 더 시도해 보세요.`를 표시한다.
- [ ] 무중량 종목에는 `다음 루틴에서는 최근 최고 수행량보다 1단위 더 시도해 보세요.`를 표시한다.
- [ ] `통증·부상 또는 회복 저하가 있으면 제안을 적용하지 말고 강도를 낮추거나 전문가와 상담하세요.`라는 안전 문구를 함께 둔다.
- [ ] 카드가 루틴이나 현재 운동 기록을 자동 수정하는 버튼을 제공하지 않도록 한다.
- [ ] 기존 `gmymate:data-changed`의 `gmymateWorkoutHistory` 이벤트로 기록 변경 직후 다시 판정한다.
- [ ] 종목 선택을 바꾸면 해당 종목의 카드만 즉시 갱신한다.
- [ ] `role="status"` 또는 동등한 시맨틱을 사용하고 색상만으로 상태를 전달하지 않는다.
- [ ] 운동명 등 저장 데이터는 `textContent` 또는 기존 `escapeHtml()`을 거친다.
- [ ] `src/styles/portfolio.css`에 기존 분석 카드와 어울리는 최소 스타일만 추가한다. 새 CSS 파일은 만들지 않는다.

### 테스트·검증·인계

- [ ] `tests/analytics.test.mjs`에 최소 세션, 임계값 경계, 날짜 범위, 중량·무중량 분기, 중복 날짜, 혼합 모드, 손상 데이터, 불변성, 정렬 테스트를 추가한다.
- [ ] E2E는 샘플 데이터 파일을 바꾸지 않고 테스트 안에서 synthetic history를 localStorage에 넣는다.
- [ ] E2E에서 정체 카드 표시 후 최근 기록을 2% 이상 향상시키고 이벤트를 발생시켜 카드가 사라지는지 검증한다.
- [ ] 악성 운동명이 HTML로 실행되지 않고 텍스트로 표시되는지 검증한다.
- [ ] E2E는 deprecated `type()` 대신 `fill()`과 역할 기반 locator를 사용한다.
- [ ] 다음 명령을 모두 통과시킨다.
  - `.\scripts\check.ps1`
  - `node --test --test-isolation=none --experimental-test-coverage --test-coverage-include=src/core/analytics.js --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/analytics.test.mjs`
  - `npm run test:e2e`
  - `npm audit --audit-level=high`
- [ ] `git diff --check`를 통과시키고 `api/**`, `package.json`, `package-lock.json`이 변경되지 않았는지 확인한다.
- [ ] 완료 후 백로그를 `REVIEW`로 바꾸고 `handoffs.md`에 Gemini 리뷰 요청을 남긴다.

## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로

- [ ] 비교 가능한 기록이 5회 이하인 종목은 신호를 반환하지 않는다.
- [ ] 최근 6회가 84일 범위를 벗어나거나 최신 기록이 29일 이상 오래됐으면 신호를 반환하지 않는다.
- [ ] 최신 기록이 정확히 28일 전이면 판정 대상에 포함된다.
- [ ] 이전 창 최고값이 `100`, 최근 창 최고값이 `101.99`이면 신호를 반환한다.
- [ ] 이전 창 최고값이 `100`, 최근 창 최고값이 정확히 `102` 이상이면 신호를 반환하지 않는다.
- [ ] 중량 종목은 Epley 추정 1RM으로, 중량 0 종목은 최고 수행량으로 독립 판정된다.
- [ ] 중량과 무중량 기록이 섞이면 최신 기록과 다른 모드의 기록은 6회 표본에 포함되지 않는다.
- [ ] 동일 날짜에 같은 종목 기록이 여러 개 있어도 비교 세션은 한 번만 증가한다.
- [ ] `done:false`, 드롭세트, 반복수 13회 이상인 중량 세트, 잘못된 날짜·숫자는 판정에 영향을 주지 않는다.
- [ ] 입력 history가 동결돼 있어도 오류 없이 동작하고 호출 전후 값이 동일하다.
- [ ] history 입력 순서를 섞어도 판정 결과와 정렬 순서가 같다.
- [ ] 선택한 종목에 신호가 있을 때만 `기록상 정체 가능성` 카드가 표시된다.
- [ ] 종목 선택을 변경하면 다른 종목의 신호가 남지 않는다.
- [ ] 기록이 2% 이상 향상되도록 갱신되면 새로고침 없이 카드가 제거된다.
- [ ] 카드에는 최근 6회, 변화율, 다음 루틴의 1회 추가 제안, 안전 문구가 모두 표시된다.
- [ ] UI 어디에도 확정적 진단, 치료 효과, 자동 증량 또는 “이 운동은 안전하다”는 표현이 없다.
- [ ] 카드의 정보가 localStorage·동기화 JSON·외부 API에 새로 저장 또는 전송되지 않는다.
- [ ] 저장된 사용자 루틴, 운동 기록, 동기화 시각은 판정 전후 동일하다.
- [ ] `api/**`, DB 스키마, 동기화 키, npm·Composer 의존성이 변경되지 않는다.
- [ ] Node.js 20 이상에서 단위·E2E 테스트가 통과한다.
- [ ] 관련 순수 로직의 lines/branches/functions 커버리지가 각각 80% 이상이다.
- [ ] 모바일 Chromium에서 카드가 화면을 가리지 않고 키보드·접근성 트리에서 읽힌다.

## 예상 리스크

- 6회·2% 기준은 검증된 보편적 정체기 정의가 아니다. 사용자별 훈련 빈도와 숙련도에 따라 오탐·미탐이 발생할 수 있다.
- 기록은 자세, 가동범위, 장비, RPE/RIR을 담지 않으므로 동일한 숫자가 동일한 수행 품질을 의미하지 않는다.
- Epley 추정치는 고반복과 운동 종류에 따라 오차가 커질 수 있다. 12회 상한으로 제한하지만 정확한 1RM으로 표현하면 안 된다.
- 중량 0의 `reps`는 운동에 따라 횟수·초·분을 뜻한다. MVP에서는 공통 “수행량”으로만 표시하고 단위별 처방은 후속 작업으로 남긴다.
- 전체 운동 세션이 80개로 잘리므로 자주 하지 않는 종목은 필요한 6회가 남지 않을 수 있다.
- whole-blob last-write-wins 동기화 때문에 다른 기기의 최신 기록이 아직 내려오지 않았다면 오래된 데이터로 판정할 수 있다.
- 최근 84일·최신 28일 제한은 저빈도 종목의 판정을 억제한다. 운영 데이터에서 표본 부족이 확인될 때만 정책을 조정한다.
- 저장 루틴은 `exerciseIds`만 가지므로 세트·중량·반복수 제안을 원클릭으로 적용할 데이터 계약이 없다. 자동 적용은 별도 PR과 ADR이 필요하다.
- Playwright 1.62.1은 Node.js 20 이상을 요구한다. CI가 구버전이면 기능 문제가 아니라 실행 환경 문제로 테스트가 실패할 수 있다.

## 참고 링크

- [ACSM 2026 — Resistance Training Prescription](https://pubmed.ncbi.nlm.nih.gov/41843416/)
- [ACSM — Progression Models in Resistance Training](https://pubmed.ncbi.nlm.nih.gov/19204579/)
- [Progressive overload: load 증가와 반복수 증가 비교](https://pubmed.ncbi.nlm.nih.gov/36199287/)
- [추정 1RM 식 교차검증](https://pubmed.ncbi.nlm.nih.gov/39495260/)
- [Fitbod — How Fitbod Creates Your Workout](https://help.fitbod.me/hc/en-us/articles/360004429814-How-Fitbod-Creates-Your-Workout)
- [Hevy — Hevy Trainer](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program)
- [Strong — Exercise Detail](https://help.strongapp.io/article/237-about-exercise-detail)
- [Alpha Progression — Progression](https://alphaprogression.com/en/glossary/progression)
- [npm — @playwright/test](https://www.npmjs.com/package/%40playwright/test)
- [GitHub Advisory — CVE-2025-59288](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- [Playwright release notes](https://playwright.dev/docs/release-notes)
- [Node.js test coverage thresholds](https://nodejs.org/api/cli.html)
- [PHP downloads](https://www.php.net/downloads.php)
- [Composer downloads](https://getcomposer.org/download/)
