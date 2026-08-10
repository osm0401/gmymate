# 아키텍처 결정 기록 (ADR 경량판)

> 세 에이전트가 서로 모순되지 않도록 하는 **공통 규칙.** 작업 전 반드시 읽는다.
> 새 결정이 필요하면 여기에 `D-n`으로 추가하고 `handoffs.md`에 알린다.
>
> 2026-08-10 복구판: 이전 버전(`chore/ai-collab-scaffold`/`fe/frontend-refactor` 브랜치)의 D-1~D-9는
> 실행되지 않았거나 현재 기준 브랜치와 맞지 않는다. 아래 "역사적 결정"에 왜 폐기됐는지만 남기고,
> 실제로 유효한 규칙은 "현재 유효한 결정"에 다시 적었다.

## 현재 유효한 결정

### D-A · JS 모듈 구조 (ES Module, 구 D-7 대체)

- `window.Gmymate` 전역 네임스페이스 패턴은 **쓰지 않는다.** 모든 JS는 표준 ES Module(`import`/`export`)이다.
- `main.html`/`index.html`/`onboarding.html`은 각각 `<script type="module" src="./src/app.js">` **하나만** 로드한다. `src/app.js`가 필요한 `core/*`·`features/*`를 직접 import한다. 새 파일을 추가해도 HTML의 `<script>` 태그를 늘리지 않는다.
- 기능 모듈(`src/features/*.js`)은 `export function setupX()` 하나를 노출하고, `src/app.js`가 이를 import해 호출한다. 순수 로직은 `src/core/*.js`에 두고 DOM을 만지지 않는다(예: `src/core/routines.js`, `src/core/goals.js`, `src/core/reminders.js`).
- 기능 간 통신은 직접 함수 호출이 아니라 `window`의 `CustomEvent`로 한다. 현재 실제로 쓰이는 이벤트는 `gmymate:data-changed`(모든 localStorage 쓰기 시 `writeJson()`이 자동 발행, `key` detail 포함), `gmymate:workouts-changed`, `gmymate:settings-changed`, `gmymate:start-routine`, `gmymate:view-changed`뿐이다. 구판 D-7이 언급한 `gmymate:profile-loaded`는 실존하지 않는다 — 새로 참조하기 전에 코드에서 먼저 확인한다.

### D-B · 백엔드는 플랫 구조, repositories/services 분리는 없다 (구 D-1~D-6 대체)

- `api/`는 리소스별 `*.php` 엔드포인트가 전부다(`login.php`/`signup.php`/`session.php`/`sync.php`/`me.php`/`music/*`). `data.php`도, `repositories/`·`services/`·`core/validation.php` 같은 계층도 존재하지 않는다 — 구판 D-1~D-6이 계획했던 리팩터는 실행되지 않았다.
- 프로필·설정을 포함한 모든 localStorage 키는 `api/sync.php` + `user_data` 테이블(계정당 JSON 블롭 1개, last-write-wins)로 동기화된다. 새 리소스가 필요해도 **새 테이블을 만들지 않고** 기존 `gmymateProfile`/`gmymateSettings` JSON 구조를 확장하는 쪽을 우선한다(목표 설정·운동 알림 MVP가 이 원칙을 따른다).
- 이 구조를 바꾸는 백엔드 리팩터가 필요하면 착수 전 이 문서에 새 `D-n`으로 계획을 적고 Codex에게 `handoffs.md`로 넘긴다. 검증되지 않은 옛 계획을 그대로 되살리지 않는다.

### D-C · 순수 로직과 DOM 분리, 오류는 `{ ok, reason }` 형태로

- `src/core/*.js`의 검증·정규화 함수는 DOM/localStorage/타이머를 직접 만지지 않고, 실패를 예외 대신 `{ ok: false, reason: "invalid-xxx" }` 같은 값으로 반환한다(`src/core/routines.js`가 본보기). `src/features/*.js`가 `reason`을 사용자 메시지로 매핑한다.
- 기존 객체를 직접 mutate하지 않고 spread/`map`/`filter`로 새 객체·배열을 만든다.
- 신규 순수 로직 파일은 `tests/<주제>.test.mjs`에서 `node --test`로 검증하고, lines/branches/functions 커버리지를 각각 80% 이상 유지한다(`scripts/check.ps1`이 `tests/*.test.mjs`를 전부 실행한다).

## 역사적 결정 (참고용, 더 이상 따르지 않음)

- 구 D-1~D-6: `api/data.php`를 `repositories/`+`services/`로 분리하는 계획. `data.php` 자체가 지금 저장소에 없으므로 무효.
- 구 D-7: `window.Gmymate` 네임스페이스 + `Object.assign(app, ...)` 패턴. D-A로 대체.
- 구 D-8: `<script defer>` 로드 순서 + `?v=` 캐시버스터. 지금은 `type="module"` 진입점 하나뿐이라 무효.
- 구 D-9: `main.js`/`workout-log.js`의 `getDateKey`/`getWorkoutStats`/`formatNumber` 이름 충돌. 현재는 `getDateKey`/`getWorkoutStats`가 `src/core/storage.js`로 통합돼 있어 해소됨(`formatNumber`는 `main.js` 로컬에 남아 있으나 다른 파일과 충돌하지 않는다).
