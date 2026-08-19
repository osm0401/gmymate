# 세트 기록에 RPE/RIR(운동 자각도) 입력 추가

# 세트별 RPE/RIR 입력 MVP 작업 지시서

## 목표

- 사용자가 반복 기반 운동의 각 세트에 선택적으로 운동 자각도를 기록하게 한다.
- 단일 입력에서 RPE와 대응 RIR을 함께 보여주되, 데이터에는 `rpe` 숫자 하나만 저장한다.
- 작업은 단일 PR `fe/set-exertion-mvp`로 제한한다.
- 신규 백로그는 `FE-5 · [FE] · 세트별 RPE/RIR 입력`으로 등록한다.

### 범위

- 반복 단위 운동 세트에 `미입력` 또는 RPE 6~10(0.5 간격) 선택 제공
- 오늘 기록, 완료 이력, 새로고침, 계정 동기화, 백업 내보내기·가져오기에서 값 보존
- 기존 RPE 없는 기록과 하위 호환
- 모바일 레이아웃·접근성·개인정보 문구 반영

### 비범위

- `api/**`, DB 스키마, 신규 엔드포인트
- 평균 자각도 분석, 자동 중량 추천, 루틴 목표 RPE
- 세션 전체 RPE, 과거 기록 역채움
- 시간 기반 `plank`, `cycle` 입력
- RPE 표시 설정 토글
- `workout-log.js` 전면 리팩터링

## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)

- Hevy는 반복 기반 운동의 세트마다 선택적인 RPE를 기록하며, 허용 범위를 6~10으로 제한하고 미입력을 허용한다. 따라서 필수 입력이나 1~10 자유 입력 대신 제한된 선택값을 사용한다. [Hevy 공식 도움말](https://help.hevyapp.com/hc/en-us/articles/35687721776663-How-to-Use-RPE-Rate-of-Perceived-Exertion)
- Strong도 세트별 RPE 6~10을 사용하고 RIR과 대응시킨다. 두 값을 따로 저장하면 불일치할 수 있으므로 `rpe`만 저장하고 RIR은 표시 시 파생한다. [Strong 공식 도움말](https://help.strongapp.io/article/230-about-rpe)
- RIR 추정은 특히 가벼운 부하에서 오차가 커질 수 있다는 연구가 있다. 이번 PR에서는 사용자의 주관적 기록으로만 취급하고 자동 추천·의학적 판단에 사용하지 않는다. [PubMed 연구](https://pubmed.ncbi.nlm.nih.gov/33337690/)
- 고정된 아홉 개 값에는 자유 숫자 입력보다 네이티브 `<select>`가 적합하다. 숫자 입력은 실수로 값이 증감되거나 브라우저별로 잘못된 문자를 허용할 수 있다는 접근성 주의사항이 있다. [MDN `input type="number"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)
- 현재 저장소에는 런타임 UI 라이브러리가 없으며 새 의존성이 필요하지 않다. `@playwright/test`의 최신 안정판은 2026-08-19 확인 기준 1.62.1이고 `package-lock.json`도 동일 버전을 사용한다. [npm 패키지 정보](https://www.npmjs.com/package/%40playwright/test)
- Playwright `<1.55.1`에는 브라우저 설치 시 인증서 검증을 우회하던 고위험 취약점이 있었지만 1.55.1에서 수정됐다. 현재 잠금 버전 1.62.1은 해당 범위에 포함되지 않으며 계획 시점 `npm audit` 결과도 취약점 0건이다. [GitHub Advisory CVE-2025-59288](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- Playwright의 `page.type()`·`locator.type()` 등은 deprecated 상태다. 신규 E2E는 `fill()`·`selectOption()`과 역할 기반 locator만 사용한다. [Playwright 릴리스 노트](https://playwright.dev/docs/release-notes)
- 현재 `gmymateWorkoutLogsV2`와 `gmymateWorkoutHistory`는 `api/sync.php`가 JSON 전체로 동기화한다. 중첩 세트에 필드를 추가해도 API·테이블 변경은 필요 없다.

### 확정 데이터 계약

| 저장 `rpe` | UI에 표시할 RIR |
|---:|:---|
| 6 | 4+ |
| 6.5 | 3–4 |
| 7 | 3 |
| 7.5 | 2–3 |
| 8 | 2 |
| 8.5 | 1–2 |
| 9 | 1 |
| 9.5 | 0–1 |
| 10 | 0 |

- UI 예시: `RPE 8 · RIR 2`
- 미입력 시 `rpe` 속성을 저장하지 않는다.
- `rir` 속성이나 표시 문자열은 저장하지 않는다.
- 허용 목록 밖의 값은 유효한 기록으로 취급하지 않는다.

## 세부 작업 체크리스트

### 준비 및 RED

- [ ] `[FE/Claude]` `docs/collab/backlog.md`에 FE-5를 `TODO`로 등록하고 `fe/set-exertion-mvp` 브랜치를 만든다.
- [ ] `[REVIEW/Gemini]` 같은 기능 브랜치에 구현보다 먼저 실패하는 테스트를 작성한다.
- [ ] `tests/workout-effort.test.mjs`에 빈 값, 전체 허용값, 문자열 숫자 정규화, NaN·객체·범위 초과·0.5 외 간격 거부를 작성한다.
- [ ] `tests/sync.test.mjs`에 중첩 세트의 `rpe`가 POST→GET 왕복되는 계약을 추가한다.
- [ ] `tests/e2e/portfolio-flow.spec.mjs`에 선택→새로고침→완료 이력 저장 흐름과 320px 레이아웃 검사를 추가한다.
- [ ] RED 실행 결과를 핸드오프 또는 리뷰 노트에 기록한다.

### 최소 구현

- [ ] `[FE/Claude]` 새 라이브러리와 새 core 모듈을 만들지 않는다.
- [ ] 이미 PWA 캐시 대상인 `src/core/storage.js`에 RPE/RIR 대응표와 순수 정규화 함수를 추가한다.
- [ ] 정규화 결과는 `{ ok: true, value }` 또는 `{ ok: false, reason: "invalid-rpe" }` 형태로 반환한다.
- [ ] `src/features/workout-log.js`의 반복 기반 세트 행에 네이티브 `<select>`와 고유한 접근성 이름을 추가한다.
- [ ] 선택 변경 시 해당 운동·세트만 `map`/spread로 새 객체를 만들어 저장한다.
- [ ] 유효값은 숫자로 저장하고 미입력 선택 시 기존 `rpe`를 제거한다.
- [ ] 세트 완료 여부를 바꾸거나 해제해도 입력한 RPE는 유지한다.
- [ ] 세트 추가 시 무게·횟수 복사 동작은 유지하되 RPE는 복사하지 않는다.
- [ ] 새 운동, 루틴 시작, 운동 교체, 구형 로그 마이그레이션에서 RPE를 빈 상태로 시작한다.
- [ ] RPE 변경이 완료 상태, 휴식 타이머, PR 판정, 볼륨 계산을 호출하거나 변경하지 않게 한다.
- [ ] `src/styles/workout-log.css`에 세 번째 입력 행을 추가하고 44px 이상의 터치 영역을 확보한다.
- [ ] `privacy.html`의 서버 저장 운동 기록 목록에 운동 자각도(RPE/RIR)를 추가한다.

### 동기화 및 호환성

- [ ] `gmymateWorkoutLogsV2`와 `gmymateWorkoutHistory` 내부 필드만 확장한다.
- [ ] `SYNCED_KEYS`, `api/sync.php`, `api/schema.sql`은 수정하지 않는다.
- [ ] 기존 기록에 `rpe`가 없거나 잘못된 값이 있어도 빈 선택으로 렌더링한다.
- [ ] 기존 내보내기·가져오기 흐름이 유효한 `rpe`를 별도 변경 없이 보존하는지 검증한다.
- [ ] RPE와 RIR을 중복 저장하지 않아 128KiB 동기화 요청 한도 증가를 최소화한다.
- [ ] `package.json`, `package-lock.json`, `service-worker.js`는 변경하지 않는다.

### 검증 및 핸드오프

- [ ] `npm test`
- [ ] `npm run test:e2e`
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/check.ps1`
- [ ] `npm audit --audit-level=high`
- [ ] 변경된 순수 로직의 lines/branches/functions 커버리지가 각각 80% 이상인지 확인한다.
- [ ] `[FE/Claude]` 완료 후 FE-5를 `REVIEW`로 바꾸고 `handoffs.md`에 Gemini 리뷰 요청을 남긴다.
- [ ] `[REVIEW/Gemini]` 역할 경계, 모바일 UI, 레거시 호환성, 보안 검사 결과를 리뷰 노트에 기록한다.

## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로

- [ ] 반복 기반 세트마다 `미입력`과 표에 정의된 아홉 개 RPE/RIR 쌍만 선택할 수 있다.
- [ ] `plank`와 `cycle` 세트에는 해당 입력이 표시되지 않는다.
- [ ] `RPE 8 · RIR 2` 선택 시 세트 객체에는 숫자 `rpe: 8`만 저장된다.
- [ ] 미입력으로 되돌리면 해당 세트에 `rpe`와 `rir`가 모두 존재하지 않는다.
- [ ] RPE 미입력 상태에서도 세트를 완료하고 운동을 저장할 수 있다.
- [ ] 새로고침 후 선택값이 유지되고, 운동 완료 후 같은 값이 `gmymateWorkoutHistory[*].workouts[*].sets[*]`에 보존된다.
- [ ] 로그인 계정의 동기화 모의 테스트에서 `rpe`가 손실이나 문자열 변환 없이 왕복한다.
- [ ] 기존 RPE 없는 기록은 오류 없이 빈 값으로 열리며 완료 세트·볼륨·PR 결과가 변경되지 않는다.
- [ ] 세트 추가 시 직전 무게·횟수는 복사되지만 RPE는 미입력이다.
- [ ] 허용 목록 밖의 값은 저장·선택되지 않고 `invalid-rpe`로 처리된다.
- [ ] 각 입력의 접근성 이름에 세트 번호와 `RPE/RIR`가 포함된다.
- [ ] 320px 및 390px 뷰포트에서 가로 스크롤, 컨트롤 겹침, 완료 버튼 가림이 없다.
- [ ] 신규 E2E는 deprecated `type()` 계열 API를 사용하지 않는다.
- [ ] 전체 테스트와 검사 명령이 성공하고 고위험 이상 npm 취약점이 0건이다.
- [ ] PR diff에 `api/**`, DB 스키마, 신규 의존성, 분석·추천 기능 변경이 없다.

## 예상 리스크

- RPE/RIR은 주관적 추정이므로 실제 수행 여력과 다를 수 있다. 자동 처방에는 사용하지 않는다.
- 모바일 세트 행이 길어질 수 있다. 자유 입력이나 별도 모달 대신 한 줄 네이티브 선택으로 제한한다.
- 동기화는 last-write-wins이므로 여러 기기에서 동시에 수정하면 마지막 저장이 이전 RPE를 덮을 수 있다. 이번 PR에서는 동기화 구조를 바꾸지 않는다.
- 전체 JSON 요청 한도는 128KiB다. RIR 문자열을 중복 저장하지 않고 숫자 하나만 추가한다.
- `workout-log.js`는 이미 큰 파일이다. 이번 기능과 무관한 분리는 단일 PR 원칙에 따라 별도 기술부채 작업으로 남긴다.
- RPE는 서버에 동기화되는 운동 기록이므로 개인정보 안내 누락 시 고지 내용과 실제 저장 데이터가 달라진다.

## 참고 링크

- [Hevy — How to Use RPE](https://help.hevyapp.com/hc/en-us/articles/35687721776663-How-to-Use-RPE-Rate-of-Perceived-Exertion)
- [Strong — About RPE](https://help.strongapp.io/article/230-about-rpe)
- [PubMed — Estimating Repetitions in Reserve](https://pubmed.ncbi.nlm.nih.gov/33337690/)
- [MDN — `<input type="number">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)
- [npm — `@playwright/test`](https://www.npmjs.com/package/%40playwright/test)
- [Playwright 공식 릴리스 노트](https://playwright.dev/docs/release-notes)
- [GitHub Advisory — CVE-2025-59288](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- [npm 공식 보안 감사 안내](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/)
