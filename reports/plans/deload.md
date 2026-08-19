# 과훈련 감지 및 디로드(휴식주) 제안 기능

## 목표

- **단일 PR:** `feat: 훈련 부담 신호 및 디로드 제안`
- **권장 브랜치:** `fe/training-load-deload-mvp`
- 사용자의 최근 운동 기록과 회복 체크인을 분석해 다음 상태를 보여준다.
  - `stable`: 뚜렷한 부담 신호 없음
  - `monitor`: 훈련량 증가 또는 회복 저하 중 하나 감지
  - `consider-deload`: 두 신호가 동시에 감지되어 디로드 고려 제안
  - `insufficient-data`: 판단할 기록 부족
- 의료적 진단으로 오해될 수 있는 **“과훈련 감지” 대신 “훈련 부담 신호” 또는 “누적 피로 신호”**라는 표현을 사용한다.
- 기존 데이터만 활용한다.
  - `gmymateWorkoutHistory`
  - `gmymateRecoveryCheckins`
- 기존 `src/core/analytics.js`와 분석 화면을 확장한다. 새 API, 데이터베이스 테이블, 저장소 키, 외부 라이브러리는 추가하지 않는다.
- 현재 작업 트리에 섞여 있는 부상 인지 기능 변경과 분리해, 해당 작업이 정리된 깨끗한 `main` 기준 브랜치에서 시작한다.

### MVP 계산 계약

- 기준일을 포함한 최근 7일을 `recent`, 그 직전 28일을 7일 단위 4개 버킷으로 나눈 구간을 `baseline`으로 사용한다.
- 주 훈련량 지표는 완료된 세트 수(`set.done === true`)로 한정한다.
  - 체중 운동도 포함할 수 있도록 중량 볼륨은 주 지표로 사용하지 않는다.
  - 세션 수는 설명용 보조 정보로만 노출한다.
- 데이터 충분성:
  - 기준 28일에 완료 세션 8개 이상
  - 기준 세션이 4주 중 최소 3주에 분포
  - 기준 회복 체크인 7개 이상
  - 최근 회복 체크인 3개 이상
- 훈련량 증가 신호:
  - `최근 7일 완료 세트 수 >= 기준 주간 평균 + max(5세트, 기준 주간 표본 표준편차)`
- 회복 저하 신호:
  - 최근 회복 평균이 50 미만이거나
  - 최근 회복 평균이 75 미만이고, 기준 평균 대비 감소 폭이 `max(10점, 기준 표준편차)` 이상
- `5세트`, `10점`, 표준편차 조건은 의학적 기준이 아닌 초기 제품 휴리스틱이다. 구현 전 스포츠과학 검토자와 제품 담당자의 승인을 병합 조건으로 둔다.
- 계산 결과는 저장하지 않고 화면을 열거나 데이터 변경 이벤트가 발생할 때 다시 계산한다.

### 제외 범위

- 과훈련증후군 진단, 부상 확률 또는 “안전한 훈련량” 판정
- 운동 루틴 자동 변경, 완전 휴식 강제, 알림 발송
- RPE, 심박수, HRV, 웨어러블 연동
- 진행 중인 `gmymateWorkoutLogsV2` 반영
- AI/Gemini 분석 전송, 외부 분석 SDK 전송
- 새 PHP 엔드포인트, DB 스키마, Composer 또는 npm 패키지 추가

## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)

- ECSS·ACSM 공동 합의문과 후속 체계적 문헌고찰은 과훈련증후군에 단일 진단 지표나 보편적인 검사 조합이 없으며, 다른 원인을 배제해야 하는 복합 진단이라고 설명한다. 따라서 본 기능은 진단이 아닌 **기록 기반 의사결정 보조 신호**로 제한한다. [ECSS·ACSM 합의문](https://pubmed.ncbi.nlm.nih.gov/23247672/), [2022년 체계적 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/35320774/), [2021년 범위 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/34496702/)

- 최신 다차원 모니터링 프레임워크는 훈련 부하, 선수 상태, 훈련 반응을 함께 보고 개인 기준선을 사용하되 결과를 독립적인 의사결정 기준으로 사용하지 말 것을 권고한다. 이에 따라 완료 세트 수와 회복 체크인을 함께 사용하고, 고정된 인구 기준 대신 사용자 자신의 최근 기준선과 비교한다. [2026년 다차원 모니터링 프레임워크](https://pubmed.ncbi.nlm.nih.gov/41824225/)

- 주관적 웰니스 지표는 일부 객관적 지표보다 훈련 스트레스 변화에 민감할 수 있지만, 단일 문항과 훈련 부하의 관계는 연구마다 변동성이 크다. 따라서 회복 체크인은 단독 경보가 아니라 훈련량 변화와 결합한 보조 신호로 사용한다. [주관적 지표 체계적 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/26423706/), [단일 문항 지표 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/32991706/)

- 급성·만성 훈련 부하 비율(ACWR)의 특정 구간을 안전 또는 부상 위험 기준으로 사용하는 방법에는 비율 자체와 인과 해석에 대한 중대한 방법론적 비판이 있다. 따라서 `0.8–1.3은 안전`, `1.5 이상은 위험` 같은 문구나 부상 확률을 사용하지 않는다. [ACWR 개념 비판](https://pubmed.ncbi.nlm.nih.gov/32502973/)

- 디로드 전문가 합의에서는 훈련 스트레스를 줄여 피로를 관리하고 회복을 촉진하는 것이 목적이며, 약 7일이 흔하지만 보편적인 감량 비율은 확인되지 않았다. 따라서 “약 7일간 세트·반복·빈도 중 하나를 줄이는 방안을 고려”하도록 제안하되, 특정 감량률이나 완전 휴식을 강제하지 않는다. [디로드 국제 델파이 합의](https://link.springer.com/article/10.1186/s40798-023-00633-0)

### 유사 서비스 벤치마킹

| 서비스 | 확인된 접근 | 본 PR에 반영할 점 |
|---|---|---|
| Apple Watch Training Load | 최근 7일 부하를 이전 28일과 비교해 범주형 상태 제공 | 7일 대 28일 비교와 이해하기 쉬운 상태 표현 |
| WHOOP Recovery/Strain | 수면과 여러 생체 신호를 개인 기준선과 비교하며 진단 도구가 아님을 명시 | 개인 기준선과 비진단 고지 채택. 센서 수준 정확도는 주장하지 않음 |
| Garmin Training Readiness | 수면, 회복 시간, 급성 부하, HRV, 스트레스 등 다중 신호 사용 | 단일 훈련량으로 확정 판정하지 않음 |
| TrainingPeaks TSB | 적합도와 피로의 균형을 보여주되 경기력 예측값으로 단정하지 않음 | 숫자는 근거와 표본 수를 함께 설명하고 결과를 예측으로 표현하지 않음 |

출처: [Apple Training Load](https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/26/watchos/26), [WHOOP Recovery](https://support.whoop.com/s/article/WHOOP-Recovery?language=en_US), [WHOOP Strain](https://support.whoop.com/s/article/WHOOP-Strain?language=en_US), [Garmin Training Readiness](https://www.garmin.com/en-XD/garmin-technology/running-science/physiological-measurements/training-readiness/), [TrainingPeaks TSB](https://help.trainingpeaks.com/hc/en-us/articles/204071764-Form-TSB)

### 라이브러리·보안·호환성

- 추가 라이브러리는 필요하지 않다. 저장소의 `package-lock.json`은 `@playwright/test` 1.62.1을 사용하며, 조사 시점 npm 최신 버전과 일치한다. [npm 버전 목록](https://www.npmjs.com/package/%40playwright/test?activeTab=versions), [Playwright 릴리스](https://github.com/microsoft/playwright/releases)
- Playwright 1.55.1 미만에 영향을 주는 CVE-2025-59288은 잠금 버전 1.62.1에 해당하지 않는다. 현재 `npm audit --audit-level=high` 결과도 취약점 0건이다. [NVD CVE-2025-59288](https://nvd.nist.gov/vuln/detail/CVE-2025-59288)
- 제안 경로는 브라우저 표준 API와 기존 `node:test`만 사용하므로 새 deprecated API가 없다. Node 테스트 커버리지 플래그는 여전히 실험적일 수 있으므로 커버리지 실패와 기능 테스트 실패를 구분한다. [Node 테스트 러너 문서](https://nodejs.org/download/release/v24.15.0/docs/api/test.html)
- PHP 변경은 없지만 운영 환경은 지원 중인 보안 패치 버전인지 별도로 확인한다. PHP 8.2의 보안 지원 종료는 2026년 12월 31일이다. [PHP 지원 버전](https://www.php.net/supported-versions.php), [PHP 8.5.9 릴리스](https://www.php.net/releases/8_5_9.php)

### 개인정보·규제 판단

- 수면, 피로, 통증·회복 상태는 건강정보로 해석될 수 있으므로 민감정보 처리 목적, 동의, 보유 기간, 철회 방법을 출시 전에 검토한다. [개인정보 보호법 제23조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029335401)
- 생활습관을 분석해 운동 관련 건강관리 정보를 제공하는 기능은 디지털의료·건강지원 제품 규율과 접점이 있을 수 있다. 이는 법적 분류 확정이 아닌 위험 기반 추론이므로 법무 또는 개인정보 담당자의 사전 검토를 병합 조건으로 둔다. [디지털의료제품법](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260124&lsId=014601&lsiSeq=259299&urlMode=lsInfoP), [식품의약품안전처 안내](https://www.mfds.go.kr/brd/m_99/view.do?itm_seq_1=0&itm_seq_2=0&multi_itm_seq=0&page=1&seq=49654)

## 세부 작업 체크리스트

### 1. 작업 착수와 승인

- [ ] Claude가 `docs/collab/backlog.md`에 `[FE] 훈련 부담 신호 및 디로드 제안` 항목을 등록한다.
- [ ] 현재 부상 인지 변경이 포함된 작업 트리를 사용하지 않고 깨끗한 `main`에서 `fe/training-load-deload-mvp`를 생성한다.
- [ ] 제품·스포츠과학 검토자가 계산 창, 최소 표본, `5세트`·`10점` 휴리스틱과 사용자 문구를 승인한다.
- [ ] 개인정보 담당자가 기존 동의 범위로 회복 데이터를 해당 분석에 사용할 수 있는지 확인한다.
- [ ] 별도 동의가 필요하다는 판단이면 기능 구현을 중단하고 개인정보·동의 변경을 선행 PR로 분리한다.

### 2. 테스트 우선 계약 확정

- [ ] Gemini가 구현 전에 `tests/analytics.test.mjs`에 실패하는 단위 테스트를 추가한다.
- [ ] 고정 기준일과 로컬 캘린더 날짜를 사용해 7일·28일 구간 경계를 명시한다.
- [ ] `stable`, `monitor`, `consider-deload`, `insufficient-data` 네 상태의 입력 fixture를 만든다.
- [ ] 임곗값과 정확히 같은 경우, 바로 아래인 경우, 표준편차가 0인 경우를 각각 테스트한다.
- [ ] 잘못된 날짜, 미래 날짜, 음수·무한대·NaN 값, 완료 세트가 없는 세션을 포함한 방어 테스트를 추가한다.
- [ ] 입력 배열과 중첩 객체가 변경되지 않는지 동결된 fixture로 검증한다.

### 3. 순수 계산 로직

- [ ] `src/core/analytics.js`에 DOM이나 네트워크 의존성이 없는 순수 계산 함수를 추가한다.
- [ ] 기존 날짜 검증과 회복 점수 계산을 재사용한다.
- [ ] 최근 7일과 직전 28일이 겹치지 않도록 로컬 날짜 기준으로 구간을 계산한다.
- [ ] 완료 세트 수를 집계하고, 세션 수는 설명용 메타데이터로만 반환한다.
- [ ] 기준 4개 주간 세트 합계의 평균과 표본 표준편차를 계산한다.
- [ ] 회복 체크인의 기준 평균·최근 평균·표준편차를 계산한다.
- [ ] 최소 표본 미달 시 추측값 대신 `insufficient-data`와 부족한 항목 코드를 반환한다.
- [ ] 반환값을 다음 의미의 불변 객체로 제한한다.
  - 상태 코드
  - 신호별 발동 여부
  - 최근 값과 기준 값
  - 단위와 유효 표본 수
  - 분석 기간
  - 데이터 부족 코드
- [ ] 진행 중인 `gmymateWorkoutLogsV2`는 완료 이력과 중복될 수 있으므로 읽지 않는다.
- [ ] 결과 객체를 Local Storage, 서버 동기화 데이터 또는 로그에 저장하지 않는다.

### 4. 화면과 문구

- [ ] `main.html`의 기존 분석 패널에 훈련 부담 카드 영역을 추가한다.
- [ ] `src/features/analytics.js`에서 계산 결과를 화면 문구로 매핑한다.
- [ ] `gmymateWorkoutHistory` 또는 `gmymateRecoveryCheckins` 변경 이벤트가 발생하면 다시 계산한다.
- [ ] 색상만으로 상태를 구분하지 않고 상태명, 설명, 최근 값, 개인 기준값, 유효 표본 수를 함께 표시한다.
- [ ] `insufficient-data`에서는 필요한 기록 수와 현재 확보한 기록 수를 표시한다.
- [ ] `consider-deload` 문구는 다음 의미를 유지한다.
  - “최근 기록에서 훈련량 증가와 회복 저하 신호가 함께 보여요.”
  - “약 7일간 세트 수·반복 수·운동 빈도 중 하나를 줄이는 방안을 고려해 보세요.”
- [ ] 모든 상태에 다음 안전 고지를 표시한다.
  - “이 안내는 의료 진단이 아니며 앱에 기록한 운동만 반영합니다.”
  - “통증, 심한 피로 또는 수행 저하가 지속되면 운동을 중단하고 의료전문가와 상담하세요.”
- [ ] “진단”, “부상 확률”, “안전함”, “과훈련 확정”, “반드시 휴식” 표현을 사용하지 않는다.
- [ ] 기존 스타일을 우선 재사용하고 꼭 필요한 경우에만 `src/styles/portfolio.css`를 최소 변경한다.

### 5. 개인정보와 보안

- [ ] `privacy.html`에 회복·운동 기록이 개인화된 훈련 부담 신호 계산에 사용된다는 목적을 반영한다.
- [ ] 분석이 브라우저 내부에서 수행되고 파생 결과는 서버·AI·외부 분석 서비스로 전송되지 않음을 확인한다.
- [ ] 기존 동기화 API 외에 새 요청이 발생하지 않는지 브라우저 네트워크 기록으로 검증한다.
- [ ] 계산 오류에 원본 건강정보나 전체 사용자 데이터를 콘솔에 출력하지 않는다.
- [ ] 가져온 기록을 신뢰하지 않고 계산 경계에서 타입·범위·날짜를 재검증한다.

### 6. 검증과 인계

- [ ] `npm test`
- [ ] 변경된 계산 로직의 문장·분기·함수 커버리지 각각 80% 이상 확인
- [ ] `npm run test:e2e`
- [ ] `.\scripts\check.ps1`
- [ ] `npm audit --audit-level=high`
- [ ] 데스크톱과 모바일에서 분석 카드의 줄바꿈, 키보드 탐색, 스크린리더 상태명을 확인한다.
- [ ] 오프라인 상태에서도 기존 로컬 기록으로 계산되고 화면이 깨지지 않는지 확인한다.
- [ ] PHP 변경은 없어야 한다. 운영 검증 절차상 PHP 검사가 필요하면 PHP CLI가 설치된 CI 또는 리뷰 환경에서 수행한다.
- [ ] 예상 PR 변경 파일을 `src/core/analytics.js`, `src/features/analytics.js`, `main.html`, `privacy.html`, 관련 테스트로 제한한다.
- [ ] `api/**`, `package.json`, `package-lock.json`, 저장소 스키마가 변경되면 범위 이탈로 간주한다.
- [ ] 완료 후 backlog 상태를 `REVIEW`로 바꾸고 `docs/collab/handoffs.md`에 Gemini 리뷰 요청을 남긴다.
- [ ] 코드 리뷰에서 CRITICAL/HIGH 문제와 의료·개인정보 문구 문제를 모두 해소한 뒤 병합한다.

## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로

1. 기준 28일 완료 세션이 7개인 입력은 `insufficient-data`를 반환한다.
2. 기준 세션이 8개 이상이어도 2개 주에만 몰려 있으면 `insufficient-data`를 반환한다.
3. 기준 회복 체크인이 6개이거나 최근 회복 체크인이 2개이면 부족한 항목 코드와 실제 개수를 반환한다.
4. 최근 세트 수가 `기준 평균 + max(5, 1SD)`와 정확히 같으면 훈련량 증가 신호가 발동한다.
5. 같은 값보다 1세트 적으면 해당 신호가 발동하지 않는다.
6. 최근 회복 평균이 50 미만이면 회복 저하 신호가 발동한다.
7. 최근 회복 평균이 50 이상 75 미만일 때 기준 대비 감소 폭이 `max(10, 1SD)`와 정확히 같으면 회복 저하 신호가 발동한다.
8. 두 신호가 모두 없으면 `stable`, 하나만 있으면 `monitor`, 모두 있으면 `consider-deload`가 반환된다.
9. 미래 기록, 잘못된 날짜, 유한하지 않은 수치, 완료 세트가 없는 세션은 계산에서 제외되며 결과에 `NaN` 또는 `Infinity`가 나타나지 않는다.
10. 체중 운동의 완료 세트는 중량이 0이어도 집계되며, 상태 판정이 `weight × reps` 볼륨에 의존하지 않는다.
11. 월말·연말·윤년·일광절약시간 전환 fixture에서 7일과 28일 구간이 중복되거나 하루 누락되지 않는다.
12. 계산 전후 입력 운동·회복 객체를 깊은 비교했을 때 변경이 없다.
13. 카드에 상태명, 최근 세트 수, 기준 주간 평균, 최근·기준 회복 평균, 표본 수가 표시된다.
14. 데이터가 부족하면 위험 상태를 추측하지 않고 추가로 필요한 기록을 안내한다.
15. 사용자 문구에 진단, 부상 확률, 안전 보장 또는 강제 운동 처방이 포함되지 않는다.
16. 두 저장 키가 변경되면 새로고침 없이 카드가 다시 계산된다.
17. 오프라인에서도 기존 로컬 데이터로 동일한 결과가 표시된다.
18. 분석 결과를 저장하는 새 Local Storage 키, API 요청, DB 필드 또는 외부 전송이 없다.
19. 개인정보 목적 고지와 비진단 안전 고지가 제품·개인정보 검토를 통과한다.
20. 전체 테스트와 E2E 테스트가 통과하고 변경 계산 로직의 문장·분기·함수 커버리지가 각각 80% 이상이다.
21. 기존 110개 테스트에 회귀가 없고 `npm audit --audit-level=high`에서 high 이상 취약점이 0건이다.
22. PR 하나에는 이 기능과 직접 관련된 변경만 포함되며 현재 진행 중인 부상 인지 변경과 커밋이 섞이지 않는다.

## 예상 리스크

- **의학적 오해:** 제품 신호를 과훈련 진단으로 받아들일 수 있다. 비진단 명칭, 안전 고지, 금지 문구 검수로 완화한다.
- **오탐·미탐:** 초기 임곗값은 임상적으로 검증된 기준이 아니다. 수치 근거와 표본 수를 공개하고 스포츠과학 승인을 병합 조건으로 둔다.
- **불완전한 부하 측정:** 완료 세트 수는 유산소 운동의 강도나 세트당 난이도를 충분히 표현하지 못한다. MVP 범위를 근력 운동 기록 기반으로 명시하고 RPE·웨어러블은 후속 PR로 분리한다.
- **주관적 회복 입력 편향:** 체크인 성향과 누락이 결과를 왜곡할 수 있다. 최소 표본을 요구하고 단독 확정 판정에 사용하지 않는다.
- **기록 누락 편향:** 앱 외 운동이 반영되지 않는다. 화면에 “앱에 기록한 운동만 반영”한다고 명시한다.
- **동기화 경합:** 전체 JSON의 last-write-wins 동기화로 기기 간 최신 기록이 덮일 수 있다. 파생 결과를 저장하지 않고 현재 동기화된 원본에서 재계산한다.
- **잘못된 가져오기 데이터:** 가져온 기록의 구조가 느슨할 수 있다. 순수 계산 함수의 입력 경계에서 재검증한다.
- **날짜 경계 오류:** 시간대·월말·연말에 기간이 어긋날 수 있다. 로컬 날짜 키를 사용하고 고정 시계 fixture로 검증한다.
- **민감정보 목적 확대:** 기존 회복 데이터를 새로운 분석 목적으로 쓰는 것이 별도 동의를 요구할 수 있다. 개인정보 검토 결과에 따라 선행 PR로 분리한다.
- **규제 분류 위험:** 운동 건강관리 안내가 디지털의료·건강지원 제품 규율과 접점이 생길 수 있다. 진단·치료·예방 효능을 주장하지 않고 출시 전 법무 검토를 받는다.
- **작업 트리 충돌:** 현재 다른 기능 변경과 섞이면 PR 검토와 롤백이 어려워진다. 깨끗한 기준 브랜치에서 작업하고 예상 파일 외 diff를 차단한다.
- **런타임 검증 공백:** 로컬에 PHP CLI가 없어 전체 서버 검사가 제한될 수 있다. PHP 변경을 금지하고 CI에서 운영 PHP 보안 버전과 lint 상태를 확인한다.

## 참고 링크

- [ECSS·ACSM 과훈련 합의문](https://pubmed.ncbi.nlm.nih.gov/23247672/)
- [과훈련 진단 지표 체계적 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/35320774/)
- [과훈련증후군 범위 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/34496702/)
- [2026년 다차원 선수 모니터링 프레임워크](https://pubmed.ncbi.nlm.nih.gov/41824225/)
- [주관적 웰니스 지표 체계적 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/26423706/)
- [단일 웰니스 문항 문헌고찰](https://pubmed.ncbi.nlm.nih.gov/32991706/)
- [ACWR 사용의 개념적 문제](https://pubmed.ncbi.nlm.nih.gov/32502973/)
- [디로드 국제 델파이 합의](https://link.springer.com/article/10.1186/s40798-023-00633-0)
- [Apple Watch Training Load](https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/26/watchos/26)
- [WHOOP Recovery](https://support.whoop.com/s/article/WHOOP-Recovery?language=en_US)
- [WHOOP Strain](https://support.whoop.com/s/article/WHOOP-Strain?language=en_US)
- [Garmin Training Readiness](https://www.garmin.com/en-XD/garmin-technology/running-science/physiological-measurements/training-readiness/)
- [TrainingPeaks Form/TSB](https://help.trainingpeaks.com/hc/en-us/articles/204071764-Form-TSB)
- [Playwright npm 버전](https://www.npmjs.com/package/%40playwright/test?activeTab=versions)
- [Playwright 릴리스](https://github.com/microsoft/playwright/releases)
- [CVE-2025-59288](https://nvd.nist.gov/vuln/detail/CVE-2025-59288)
- [Node.js 테스트 러너](https://nodejs.org/download/release/v24.15.0/docs/api/test.html)
- [PHP 지원 버전](https://www.php.net/supported-versions.php)
- [개인정보 보호법 제23조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029335401)
- [디지털의료제품법](https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20260124&lsId=014601&lsiSeq=259299&urlMode=lsInfoP)
- [식품의약품안전처 디지털의료제품 안내](https://www.mfds.go.kr/brd/m_99/view.do?itm_seq_1=0&itm_seq_2=0&multi_itm_seq=0&page=1&seq=49654)
