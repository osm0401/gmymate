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
- [TODO] FE-1 · [FE] · Claude — `src/features/workout-log.js`(1346줄) 모듈 분할 (`decisions.md` D-7~D-9)
  - 공유 가변 상태(`workouts`/`activeEditor`/`timerState`/`dragState`)를 어느 모듈이 소유할지 구현 중 결정. 타이머/피커/에디터 하위 모듈로.
  - `CustomEvent` 규약·스크립트 로드 순서 유지. 이름 충돌(`getDateKey`/`getWorkoutStats`/`formatNumber`) 해소.
- [TODO] FE-2 · [FE] · Claude — `src/features/main.js`(606줄) 분할
  - 진행상황 대시보드 블록(~210줄, 자체 완결적)을 별도 모듈로 우선 분리.
- [TODO] REVIEW-1 · [REVIEW] · Gemini — 테스트/검증 스캐폴드 확장
  - `scripts/check.ps1`(스타터 생성됨)를 확장. 이후 모든 REVIEW 상태 브랜치를 `decisions.md` 기준 + `check` 통과로 검증하고 `reviews/`에 노트.

## 백로그 (파일럿 이후)

- [TODO] BE-3 · [BE] · Codex — (선택) 예외 매핑 헬퍼 `core/http.php`로 통합 (`decisions.md` D-6). 필수 아님.
- [TODO] IDEA · [FE/BE] · — gmymate 기능 개선 아이디어를 여기에 쌓는다(기획=Claude가 태그·분해).
