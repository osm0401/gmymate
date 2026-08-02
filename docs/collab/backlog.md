# 공유 백로그

> 형식: `- [상태] ID · [태그] · 담당 — 내용`  · 상태: TODO / DOING / REVIEW / DONE
> 태그: `[FE]`(프론트/Claude) `[BE]`(백엔드/Codex) `[REVIEW]`(리뷰·테스트/Gemini)
> 상세 스펙은 각 항목 아래 들여쓰기로. 규칙은 `decisions.md` 참조.

## 파일럿 (협업 루프 첫 검증)

- [TODO] BE-1 · [BE] · Codex — `api/data.php` 리소스별 서비스로 분리 (`decisions.md` D-1~D-4)
  - 신규 `api/core/validation.php`: `cleanText`/`cleanNumber`/`cleanInteger`/`cleanBoolean`/`cleanDate` 이동(현재 data.php 상단, 이 파일에서만 사용).
  - 신규 서비스 5종에 리소스별 `clean*` 이동: `services/settings.php`(`cleanSettings`), `services/exercises.php`(`cleanExercise`), `services/routines.php`(`cleanRoutine`, exercises 재사용), `services/workouts.php`(`cleanWorkouts`/`cleanActiveWorkout`/`cleanSession`), `services/habits.php`(습관 key 화이트리스트).
  - `data.php`는 얇은 디스패처로: bootstrap+서비스+repo require, GET/POST 액션을 service→repo로 라우팅. 검증코드 잔류 금지.
  - 동작 동일 유지(리팩터). 액션: `settings`/`habit`/`syncHabits`/`seedExercises`/`syncRoutines`/`saveActiveWorkout`/`clearActiveWorkout`/`completeWorkout`/`importHistory`.
- [TODO] BE-2 · [BE] · Codex — `api/gemini.php` 관례 정렬 (`decisions.md` D-5)
  - `core/bootstrap.php` 사용 + 인라인 세션체크 → `requireUserId()`.
  - config/레이트리밋/요청가공 함수를 `api/services/gemini.php`로, `gemini.php`는 얇은 엔드포인트로. (DB 없음 → repository 없음.)
- [DOING] FE-1 · [FE] · Claude — `src/features/workout-log.js` 모듈 분할 (3단계, `decisions.md` D-7~D-9)
  - Stage 1 ✅: 순수 헬퍼(`formatNumber`/`formatTime`/`formatSavedTime`/`exerciseIcon`) → `workout-log-utils.js`(`app.workoutLogUtils`, 네임스페이스로 D-9 충돌 회피). 1346→1319줄. `node --check`+브라우저 검증.
  - Stage 2 (다음): 타이머 서브시스템(~200줄) → 팩토리 모듈. 외부 호출부 ~14곳 재배선(3곳은 `timerState` 내부 접근: +15초 핸들러, 모드 체크). **라이브(dothome) 테스트 권장** — 카운트다운/알림은 file:// 정적 로드로 확인 불가.
  - Stage 3: 피커 + 세트 에디터. 공유 `workouts`/`activeEditor` 접근.
- [DONE] FE-2 · [FE] · Claude — `src/features/main.js` 분할 ✅
  - 진행상황 대시보드 블록을 `src/features/progress-dashboard.js`(238줄)로 분리. `main.js` 606→391줄.
  - `app.renderProgressDashboard`로 노출, `main.js`의 `renderAppStats`가 호출. 충돌 헬퍼(`getDateKey`/`formatNumber`/`formatHistoryDate`)는 파일 로컬 복제(D-9).
  - 검증: `node --check` 통과, 브라우저에서 모듈 로드+DOM 렌더 확인(1,000kg/1회). `main.html`에 script 태그 추가.
- [TODO] REVIEW-1 · [REVIEW] · Gemini — 테스트/검증 스캐폴드 확장
  - `scripts/check.ps1`(스타터 생성됨)를 확장. 이후 모든 REVIEW 상태 브랜치를 `decisions.md` 기준 + `check` 통과로 검증하고 `reviews/`에 노트.

## 백로그 (파일럿 이후)

- [TODO] BE-3 · [BE] · Codex — (선택) 예외 매핑 헬퍼 `core/http.php`로 통합 (`decisions.md` D-6). 필수 아님.
- [TODO] IDEA · [FE/BE] · — gmymate 기능 개선 아이디어를 여기에 쌓는다(기획=Claude가 태그·분해).
