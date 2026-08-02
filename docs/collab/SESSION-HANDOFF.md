# 세션 핸드오프 (Codex가 이어받기)

> 이 문서만 읽으면 이어서 작업 가능. 먼저 `docs/collab/decisions.md`(D-1~D-9) + `roles.md`도 읽을 것.
> 원래 프론트=Claude 역할이지만 토큰 사정으로 Codex가 FE 리팩터를 이어받는다. **같은 규칙 준수.**

## 지금 상태
- **브랜치: `fe/frontend-refactor`** (여기서 계속 작업). `main`엔 사용자 WIP 체크포인트 `5007997`(안전지점).
- 앱은 **dothome에서만 실행**됨 (https://kpgo.dothome.co.kr/, 사용자가 수동 업로드). 로컬 PHP 없음. 테스트 스위트 없음.
- 검증법: `node --check` + `file://`로 main.html 열어 `window.Gmymate` 확인 + 라이브 업로드 후 점검. **php 미설치**(리뷰용 `php -l` 하려면 설치 필요).

## 완료 (커밋됨)
- **FE-2** (`32f66ff`): `main.js` 진행상황 대시보드 → `src/features/progress-dashboard.js`(`app.renderProgressDashboard`). 606→391줄.
- **FE-1 Stage 1** (`b93293d`): `workout-log.js` 순수 헬퍼(formatNumber/formatTime/formatSavedTime/exerciseIcon) → `src/features/workout-log-utils.js`(`app.workoutLogUtils`). 1346→1319줄. 클로저 상단(line 12)에서 `const {...} = app.workoutLogUtils`로 재-import → 호출부 무변경.
- `main.html` 스크립트 순서: `main.js` → `progress-dashboard.js` → `workout-log-utils.js` → `workout-log.js` → … → `app.js`. **분할 시 새 파일은 의존 대상 뒤·`app.js` 앞**에 `<script defer ?v=>` 추가.

## 진행 중: 라이브 검증 대기
사용자가 `fe/frontend-refactor` 상태를 dothome에 업로드 중. 올라오면 라이브에서 (1)신규 JS 2개 404 없나 (2)콘솔 파싱에러 없나 (3)로그인 화면은 사용자가 대시보드/기록 확인. **여기 OK 확인 후 Stage 2 진입.**

## 다음: FE-1 Stage 2 — 타이머 서브시스템 (가장 위험)
- 대상: `workout-log.js`의 타이머 함수들(`restoreTimerState`/`saveTimerState`/`ensureTimerInterval`/`startSetTimer`/`startRestTimer`/`stopTimer`/`finishRest`/`primeRestAlert`/`playRestCompleteSound`/`showRestCompleteNotification`/`renderTimer`) + 공유상태 `timerState`/`timerIntervalId`/`restCompletionTimeoutId`/`audioContext` + DOM refs(timerDock/timerModeLabel/timerDisplay/timerBar/restStatus/addRestButton/skipRestButton/nextSetButton).
- 방법: `src/features/workout-log-timer.js`에 팩토리 `app.createWorkoutTimer(ctx)` — 내부에 타이머 상태 캡슐화, 메서드 노출(startSet/startRest/stop/render/ensureInterval/restore + **addRest(15)**, **getMode()**). ctx로 DOM refs + 콜백(getSettings/getRestSeconds/getNextSetLabel/showToast/formatTime) 주입. `getNextSetLabel`은 `workouts` 읽으므로 **콜백으로 전달**(메인 클로저에 유지).
- **외부 호출부 재배선**(먼저 `grep -nE 'startSetTimer|startRestTimer|stopTimer|renderTimer|ensureTimerInterval|timerState' src/features/workout-log.js`): ~14곳. 주의 3곳 = `timerState` 내부 직접 접근: (a) +15초 핸들러 `timerState.restEndsAt += 15000; restTotalSeconds += 15` → `timer.addRest(15)`로, (b)(c) `timerState.mode === "idle"` 체크 → `timer.getMode()`로.
- 타이머 카운트다운/휴식알림은 file://로 확인 불가 → **라이브 테스트 필수**.

## 그다음: FE-1 Stage 3 — 피커 + 세트 에디터
공유 `workouts`/`activeEditor` 접근. Stage 2 팩토리 패턴 재사용. (미착수)

## 규칙 요약 (decisions.md)
- `window.Gmymate` 모듈: `(function attach(app){...; app.x=...;})(window.Gmymate=window.Gmymate||{})`.
- 기능 간 통신은 `CustomEvent`(gmymate:workouts-changed/view-changed/settings-changed/profile-loaded), 직접 호출 금지.
- 이름 충돌(`getDateKey`/`getWorkoutStats`/`formatNumber`)은 **네임스페이스 객체로 노출**하거나 파일 로컬 유지 (D-9).
- 커밋: `fe/*` 브랜치, `main` 직접 금지. 각 단계 검증 후 커밋. 완료 시 `handoffs.md`+`backlog.md` 갱신.
