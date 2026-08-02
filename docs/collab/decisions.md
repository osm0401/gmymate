# 아키텍처 결정 기록 (ADR 경량판)

> 세 에이전트가 서로 모순되지 않도록 하는 **공통 규칙.** 작업 전 반드시 읽는다.
> 새 결정이 필요하면 여기에 `D-n`으로 추가하고 `handoffs.md`에 알린다.

## D-1 · PHP 레이어 규칙 (백엔드)

기존 `users`/`auth`가 본보기다. 이 계층 분리를 **모든 리소스에 동일하게** 적용한다.

- `api/repositories/*.php` = **순수 DB 접근만**(PDO/prepared statement). 가공·검증·파생 계산 금지.
- `api/services/*.php` = **가공·검증·파생 로직·세션 부수효과.** repository를 호출하되 PDO를 직접 만지지 않는다.
- 엔드포인트 파일(`data.php`, `auth.php`, `profile.php`, `gemini.php`) = **얇은 컨트롤러.** 입력을 받아 service/repository로 위임하고 응답. 리소스 검증 로직을 컨트롤러에 두지 않는다.

## D-2 · 제네릭 검증 헬퍼 위치

`data.php`에만 있던 스칼라 새니타이저 5종(`cleanText`, `cleanNumber`, `cleanInteger`, `cleanBoolean`, `cleanDate`)은 리소스 비의존적이므로 **`api/core/validation.php` 신규 파일로 이동**해 공용화한다. (당장 `profile.php`/`auth.php`가 이를 채택하도록 강제하진 않는다 — 별도 작업.)

## D-3 · 리소스별 서비스 신설

`settings`/`habits`/`exercises`/`routines`/`workouts`는 repository는 있으나 service가 없다. 각 리소스의 `clean*` 함수를 대응 서비스로 옮긴다:

| 리소스 | 신규 서비스 | 옮길 함수 (data.php에서) |
|---|---|---|
| settings | `api/services/settings.php` | `cleanSettings` |
| habits | `api/services/habits.php` | 습관 key 화이트리스트 검증(현재 인라인 `DEFAULT_HABITS` 체크) |
| exercises | `api/services/exercises.php` | `cleanExercise` |
| routines | `api/services/routines.php` | `cleanRoutine` (내부에서 `cleanExercise` 재사용) |
| workouts | `api/services/workouts.php` | `cleanWorkouts`, `cleanActiveWorkout`, `cleanSession`(파생 totalSets/doneSets/volume 계산 포함) |

- `cleanExercise`는 routines/workouts가 공유하므로 `services/exercises.php`에 두고 다른 서비스가 require하여 재사용한다.

## D-4 · `data.php`는 얇은 디스패처로

추출 후 `data.php`는: `core/bootstrap.php` + 신규 서비스들 + 기존 repository들을 require하고, GET/POST 액션을 **service→repository로 라우팅만** 한다. 검증/가공 코드는 남기지 않는다. (형태는 `auth.php`가 `services/authentication.php`에 위임하는 방식과 동일.)

## D-5 · `gemini.php` 관례 정렬

- 다른 엔드포인트처럼 `core/bootstrap.php`를 사용하고, 인라인 `$_SESSION['user_id']` 체크 대신 `requireUserId()`(core/session.php)를 쓴다.
- config 로딩(`geminiConfig`/`geminiApiKey`/`geminiModel`) · 레이트리밋(`enforceGeminiRateLimit`) · 요청 가공(`geminiHistory`/`geminiInput`/`extractGeminiText`/`geminiFailureMessage`)을 **`api/services/gemini.php`로 이동**, `gemini.php`는 얇은 엔드포인트로. (DB 없는 리소스라 repository는 없음 — service만.)

## D-6 · 예외 매핑 헬퍼 (선택/스트레치)

`data.php`·`auth.php`·`profile.php`에 거의 동일한 try/catch(InvalidArgumentException→422, JsonException→422, PDOException→500, Throwable→500)가 중복. 여유 되면 `core/http.php`에 `handleException()` 공용 헬퍼로 통합. **필수 아님** — 리소스 분리를 먼저.

## D-7 · JS 모듈 규칙 (프론트엔드)

- `window.Gmymate` 네임스페이스 패턴 유지: `(function attachX(app){ ...; app.setupX = setupX; })(window.Gmymate = window.Gmymate || {});`
- setup형 기능은 `app.setupX`를 붙이고, 순수 라이브러리(no-DOM)는 `Object.assign(app, {...})`로 헬퍼를 노출. (본보기: `src/features/tap-effects.js`, `src/core/workout-history.js`)
- 기능 간 통신은 **직접 함수 호출이 아니라 `window`의 `CustomEvent`**(`gmymate:workouts-changed`, `gmymate:view-changed`, `gmymate:settings-changed`, `gmymate:profile-loaded`). 이 규약을 깨지 않는다.

## D-8 · 스크립트 로드 순서 (빌드 도구 없음)

`main.html`의 `<script defer>` 순서가 의존성 순서다: `core/*` → `features/*` → `app.js`. 파일을 쪼개면 **새 `<script>` 태그를 올바른 위치(의존하는 core 뒤, `app.js` 앞)에 추가**하고, 기존 파일들처럼 `?v=` 캐시버스터를 붙인다. `onboarding.html`/`index.html`은 더 작은 하위집합을 로드하므로 그쪽에서 쓰지 않는 파일은 추가하지 않는다.

## D-9 · 이름 충돌 해소 (FE 분할 시)

`main.js`와 `workout-log.js`에 **서로 다른 동작으로 중복 정의**된 함수: `getDateKey`, `getWorkoutStats`, `formatNumber`. 지금은 각자 클로저에 갇혀 안전하지만, `Object.assign(app, ...)`로 노출하면 전역 `app.*`에서 충돌한다.
- 원칙: **꼭 공유해야 하는 것만 `app.*`에 노출**하고, 나머지는 파일 로컬로 둔다.
- 공유가 필요하면 하나로 통합해 `src/core/`로 올리고 양쪽이 재사용(중복 제거). 통합 불가하면 이름을 구분(예: `getLogDateKey` vs `getStatsDateKey`).
