# 인바디 기록에 신체 둘레(허리/팔/허벅지) 측정 추가

## 목표

- 단일 PR `feat: 인바디 기록에 신체 둘레 측정 추가`로 기존 인바디 기록에 선택형 신체 둘레 3개를 추가한다.
- 브랜치는 최신 `main`에서 `fe/inbody-circumference-mvp`로 분기한다.
- 기존 저장·그래프·삭제·계정 동기화 흐름을 확장하며 별도 API나 데이터베이스 테이블은 만들지 않는다.

| 화면 항목 | 저장 키 | 형식 | 제약 |
|---|---|---|---|
| 허리둘레 | `waistCircumference` | `number \| null` | cm, 소수 첫째 자리, 선택 |
| 팔 둘레 | `armCircumference` | `number \| null` | 위팔 기준, cm, 소수 첫째 자리, 선택 |
| 허벅지 둘레 | `thighCircumference` | `number \| null` | cm, 소수 첫째 자리, 선택 |

- 입력값은 `1.0–300.0cm`만 허용한다. 이 범위는 오류 입력을 막기 위한 기술적 한계이며 의학적 정상 범위가 아니다.
- 팔과 허벅지는 좌우를 나누지 않고 단일 값으로 저장한다. 화면에 “매번 같은 쪽·같은 위치에서, 줄자가 피부를 누르지 않도록 측정” 안내를 표시한다.
- 기존 필드가 없는 기록은 새 필드를 `null`로 간주하며 데이터 마이그레이션이나 `schemaVersion`을 도입하지 않는다.
- 기존 날짜별 전체 교체, 정렬, 삭제 동작은 유지하되 기존 날짜를 선택하면 여섯 항목을 폼에 채워 의도하지 않은 값 손실을 방지한다.
- 비범위:

  - 좌우 팔·허벅지 분리
  - 인치 단위 전환
  - 사진, 목표, 알림, 추가 신체 부위
  - Apple Health·Health Connect·Samsung Health 연동
  - 기존 데이터 복사/붙여넣기 기능의 InBody 누락 수정
  - `api/**`, DB 스키마, 패키지 의존성 변경

## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)

- 현재 저장 흐름은 `main.html` → `src/features/inbody.js` → `gmymateInBodyLogs` → `src/core/sync.js` → `api/sync.php` → 계정별 JSON blob이다. 해당 키가 이미 동기화 대상이므로 객체 필드 확장만으로 로컬·서버 왕복이 가능하다. 저장소의 D-B 규칙에 따라 새 API와 테이블을 추가하지 않는다.
- Hevy는 허리·팔·허벅지를 날짜별로 기록하고 각 항목의 그래프와 0.1cm 단위 입력을 제공한다. Strong도 허리, 좌우 팔, 좌우 허벅지와 기록 이력을 지원한다. 두 서비스의 핵심 공통점인 “선택형 입력과 항목별 추이”만 채택하고 좌우 분리는 별도 기능으로 남긴다. [Hevy Body Measurements](https://www.hevyapp.com/features/track-body-measurements/), [Strong Measurements](https://help.strongapp.io/article/238-add-measurements)
- CDC 인체측정 매뉴얼은 측정 위치·측정 쪽·자세·줄자 압력을 일관되게 유지하고 0.1cm 단위로 기록하는 절차를 사용한다. WHO도 허리둘레 측정 위치와 자세의 표준화를 강조한다. 따라서 복잡한 측정 튜토리얼 대신 동일 조건 반복을 안내하는 짧은 도움말을 둔다. [CDC Anthropometry Procedures Manual](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/manuals/2020-Anthropometry-Procedures-Manual-508.pdf), [WHO Waist Circumference Guidance](https://iris.who.int/bitstream/handle/10665/44583/9789241501491_eng.pdf?sequence=1)
- HTML 숫자 입력은 `min`, `max`, `step`과 유효성 검사를 기본 제공하며 기본 `step`은 1이다. 따라서 `type="number"`, `inputmode="decimal"`, `step="0.1"`, `min="1"`, `max="300"`을 명시하고 코어 정규화 함수에서도 같은 규칙을 재검증한다. [WHATWG Number Input](https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number))
- 외부 건강 플랫폼 간 신체 둘레 지원은 일관되지 않다. Apple HealthKit은 허리둘레 타입을 제공하지만, Android Health Connect에서는 초기 `WaistCircumferenceRecord`와 `HipCircumferenceRecord`가 제거됐고 현재 Record 목록에도 신체 둘레가 없다. Google Fit API는 2026년 말까지만 지원되며 Samsung Health SDK for Android는 2025년 7월 31일 폐기됐다. 따라서 이번 PR은 안정적인 수동 입력과 기존 JSON 동기화에만 집중한다. [Apple HealthKit Waist Circumference](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/waistcircumference), [Health Connect 변경 기록](https://developer.android.com/jetpack/androidx/releases/health-connect), [Health Connect Record 목록](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/Record), [Google Fit 마이그레이션](https://developer.android.com/health-and-fitness/health-connect/migration/fit), [Samsung Health 릴리스 노트](https://developer.samsung.com/health/android/release-note.html)
- 2026-08-19 기준 저장소의 잠금 버전 `@playwright/test 1.62.1`은 npm 최신 버전과 일치하고, 로컬 `npm audit` 결과는 취약점 0건이다. 새 런타임 라이브러리가 필요하지 않으므로 패키지 변경은 금지한다. Playwright 1.62에는 modifier/middle-click 관련 회귀 보고가 있으나 이번 동일 페이지 폼 시나리오에는 해당하지 않는다. [npm Playwright 버전](https://www.npmjs.com/package/%40playwright/test?activeTab=versions), [Playwright 이슈 #42142](https://github.com/microsoft/playwright/issues/42142)
- 기존 `api/sync.php`가 사용하는 MySQL `VALUES()` 구문은 MySQL 8.0.20부터 deprecated다. 이번 기능은 PHP 변경이 필요 없으므로 관련 수정은 별도 유지보수 PR로 등록하고 기능 PR에 섞지 않는다. [MySQL 8.0.20 릴리스 노트](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-20.html)
- 개인정보보호법 제23조는 건강정보를 민감정보로 취급한다. 신체 둘레가 이 서비스에서 해당 건강정보에 포함되는지, 기존 인바디 고지만으로 충분한지는 법무 판단이 필요하다. 기존 통증·부상 동의를 그대로 재사용해서는 안 된다. [개인정보보호법 제23조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000634115)

## 세부 작업 체크리스트

- [ ] 다음 가용 ID로 `[FE] 인바디 신체 둘레 측정` 백로그를 만들고 `TODO → DOING`으로 전환한다.
- [ ] 법무/PM이 기존 인바디 개인정보 고지로 처리 가능한지 서면 확인한다.
- [ ] 별도 민감정보 동의가 필요하다는 결론이면 본 PR을 중단하고 동의·철회·삭제 수명주기를 선행 PR로 분리한다.
- [ ] `service-worker.js` 수정 담당자가 역할표에 없으므로 구현 전에 `handoffs.md`에서 해당 파일의 일회성 소유자를 지정한다.

- [ ] Gemini가 구현 전에 RED 테스트를 작성한다.

  - [ ] `tests/inbody.test.mjs`: 빈 값→`null`, 정상 소수, 경계값, 비유한 값, 범위 초과, 불변성 및 `{ok, reason}` 결과 검증
  - [ ] UI 계약 테스트: 입력 이름, 연결된 label, 단위, `min/max/step`, 선택 항목 여부 검증
  - [ ] `tests/demo-data.test.mjs`: 데모 둘레값이 유한한 허용 범위 숫자인지 검증
  - [ ] `tests/sync.test.mjs`: 세 필드가 push/pull 과정에서 손실 없이 왕복하는지 검증
  - [ ] Playwright E2E: 입력→저장→이력/차트→재로드→수정→삭제 흐름 검증

- [ ] Claude가 `src/core/inbody.js`에 DOM·스토리지를 사용하지 않는 최소 정규화 함수를 작성한다.

  - [ ] 빈 문자열은 `null`로 변환한다.
  - [ ] 유효값은 소수 첫째 자리 숫자로 반환한다.
  - [ ] 유효하지 않은 값은 `{ok:false, reason, field}` 형태로 반환한다.
  - [ ] 입력 객체나 기존 기록을 직접 변경하지 않는다.

- [ ] `main.html`의 기존 인바디 폼에 허리·팔·허벅지 입력과 측정 안내를 추가한다.
- [ ] `src/features/inbody.js`에서 세 필드를 저장하고, 오류 사유를 사용자 메시지로 변환한다.
- [ ] 기존 날짜 선택 시 해당 날짜의 여섯 지표를 폼에 채운다.
- [ ] 기존 `METRICS` 기반 렌더링을 확장해 총 6개의 추이 카드를 표시한다.
- [ ] 값이 없는 항목은 이력 문구와 차트 포인트에서 제외한다.
- [ ] 숫자로 해석할 수 없는 레거시 값도 차트 계산에서 제외해 `NaN` 좌표가 생성되지 않게 한다.
- [ ] `src/core/demo.js`의 기존 샘플 기록에 현실적인 둘레값을 추가한다.
- [ ] `privacy.html`에 수집 항목, 사용 목적, 계정 동기화, 보관·삭제 방식을 반영한다.
- [ ] 새 코어 모듈을 `service-worker.js` 앱 셸에 추가하고 캐시 버전 및 서비스워커 등록 캐시 버스터를 갱신한다.
- [ ] 모바일 검증에서 실제 overflow가 발생할 때만 기존 스타일 규칙을 최소 수정한다.
- [ ] `api/**`, `api/schema.sql`, `package.json`, `package-lock.json`에 diff가 없는지 확인한다.
- [ ] MySQL deprecated 구문과 기존 InBody 내보내기 누락은 별도 백로그에 기록한다.
- [ ] 다음 검증을 실행한다.

  - [ ] `npm test`
  - [ ] `node --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/inbody.test.mjs`
  - [ ] `npm run test:e2e`
  - [ ] `powershell -ExecutionPolicy Bypass -File scripts/check.ps1`
  - [ ] `npm audit --audit-level=high`

- [ ] 구현 완료 후 백로그를 `REVIEW`로 바꾸고 `handoffs.md`를 통해 Gemini에게 리뷰를 요청한다.
- [ ] CRITICAL/HIGH 리뷰 지적과 테스트 실패를 모두 해소한 뒤에만 병합한다.

## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로

- [ ] 세 둘레 입력을 비워도 기존 날짜·몸무게 기록을 정상 저장할 수 있다.
- [ ] `84.2`, `32.5`, `55.8`을 저장하면 해당 날짜 레코드에 각각 숫자형으로 저장된다.
- [ ] 빈 둘레값은 `null`이며 `""`, `NaN` 또는 문자열 숫자로 저장되지 않는다.
- [ ] `0`, 음수, `300` 초과, 비숫자 및 0.1cm 단위에 맞지 않는 값은 저장되지 않고 해당 입력에 오류가 표시된다.
- [ ] 같은 날짜를 선택하면 기존 여섯 값이 채워지고, 수정 저장 후 날짜별 레코드는 정확히 하나다.
- [ ] 저장 직후 허리·팔·허벅지 이력이 `cm` 단위로 표시되고 기존 3개 지표를 포함해 총 6개 추이 카드가 렌더링된다.
- [ ] 선택값이 없는 항목은 이력에서 생략되고 차트에는 빈 상태가 표시된다.
- [ ] 새 필드가 없는 기존 기록을 불러와도 예외, `undefined`, `NaN` SVG 좌표 또는 데이터 재작성 없이 기존 지표가 표시된다.
- [ ] 새로고침 및 서버 push/pull 후 세 필드의 값과 `null` 상태가 그대로 유지된다.
- [ ] 삭제하면 해당 날짜의 기존 지표와 둘레값이 모두 제거되고 이력과 차트가 즉시 갱신된다.
- [ ] Pixel 5 크기에서 폼·이력·6개 차트에 가로 스크롤이 없고 모든 입력을 연결된 label로 찾을 수 있다.
- [ ] 첫 온라인 로드 이후 오프라인 재실행에서도 새 코어 모듈과 인바디 화면이 정상 로드된다.
- [ ] 개인정보 처리 문구가 갱신되고 법무/PM 병합 승인이 기록돼 있다.
- [ ] `api/**`, DB 스키마 및 패키지 잠금 파일의 변경이 없다.
- [ ] 전체 단위·통합·E2E 테스트와 audit가 통과하고 새 순수 로직의 lines/branches/functions 커버리지가 각각 80% 이상이다.

## 예상 리스크

| 리스크 | 대응 |
|---|---|
| 신체 둘레의 민감정보 해당 여부 | 법무/PM 확인을 병합 차단 조건으로 둔다. 별도 동의가 필요하면 선행 PR로 분리한다. |
| 팔·허벅지 측정 쪽이나 위치가 달라져 추이가 왜곡됨 | “같은 쪽·같은 위치·같은 조건” 안내를 표시한다. 좌우 분리는 후속 요구가 있을 때만 추가한다. |
| 같은 날짜 전체 교체로 기존 값이 사라짐 | 날짜 선택 시 기존 여섯 값을 모두 폼에 채우고 E2E로 보존 여부를 검증한다. |
| 레거시·변조 데이터로 차트에 `NaN` 발생 | 유한한 숫자만 차트 포인트에 포함하고 기존 필드 부재는 `null`로 처리한다. |
| PWA 캐시에 새 모듈이 누락됨 | 앱 셸과 캐시 버전을 갱신하고 오프라인 테스트를 실행한다. |
| 다기기 동시 편집 시 마지막 저장이 이전 변경을 덮음 | 기존 JSON blob의 last-write-wins 제약을 유지하고 실시간 병합은 별도 기능으로 남긴다. |
| 장기 누적으로 128KiB 동기화 제한에 접근 | 대표적인 장기 이력 fixture로 동기화 테스트를 추가하고, 제한 변경은 별도 BE 과제로 분리한다. |
| 관련 없는 deprecated API 수정으로 PR이 커짐 | MySQL `VALUES()` 교체는 별도 유지보수 PR로 분리한다. |
| 최신 테스트 도구의 알려진 클릭 회귀 | 해당 조합을 사용하지 않는 폼 중심 E2E로 작성하고 Playwright 업그레이드는 이번 PR에서 수행하지 않는다. |

## 참고 링크

- [Hevy — Track Body Measurements](https://www.hevyapp.com/features/track-body-measurements/)
- [Strong — Add Measurements](https://help.strongapp.io/article/238-add-measurements)
- [CDC — Anthropometry Procedures Manual](https://wwwn.cdc.gov/nchs/data/nhanes/public/2019/manuals/2020-Anthropometry-Procedures-Manual-508.pdf)
- [WHO — Waist Circumference and Waist–Hip Ratio](https://iris.who.int/bitstream/handle/10665/44583/9789241501491_eng.pdf?sequence=1)
- [WHATWG — Number Input](https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number))
- [Apple HealthKit — Waist Circumference](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/waistcircumference)
- [Android Health Connect — Release Notes](https://developer.android.com/jetpack/androidx/releases/health-connect)
- [Android Health Connect — Record Types](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/Record)
- [Google Fit → Health Connect Migration](https://developer.android.com/health-and-fitness/health-connect/migration/fit)
- [Samsung Health SDK — Release Notes](https://developer.samsung.com/health/android/release-note.html)
- [npm — @playwright/test Versions](https://www.npmjs.com/package/%40playwright/test?activeTab=versions)
- [Playwright — Issue #42142](https://github.com/microsoft/playwright/issues/42142)
- [MySQL 8.0.20 Release Notes](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-20.html)
- [개인정보보호법 제23조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=1000634115)
