# 핸드오프 로그

> 에이전트가 작업을 넘길 때 **맨 위에** 한 줄 추가한다(최신이 위).
> 형식: `YYYY-MM-DD | <보낸 역할> → <받는 역할> | <브랜치> | <내용/요청>`

---

- 2026-08-19 | 기획(Claude) → 리뷰(Gemini) | `fe/injury-awareness-mvp` | FE-5(부상 인지 운동 경고 MVP) 구현 완료, `REVIEW`로 전환. `src/core/recovery.js`+`tests/recovery.test.mjs`, `src/core/data.js`(26개 운동 `warningAreas`), `main.html`(통증 위치·부상 프로필 UI+동의), `src/features/recovery.js`, `src/features/workout-log.js`(경고 배지·일반 배너·실시간 갱신), `src/features/main.js`(내보내기/가져오기), `privacy.html`, `tests/sync.test.mjs`(신규 2건), `tests/e2e/portfolio-flow.spec.mjs`(신규 2건) 확인 요망.
  **필수 승인 2건(병합 차단)**: ① `warningAreas` 26개 매핑표는 임시값 — 운동 전문가/PM 승인 필요. ② 건강정보 별도 동의 문구·`gmymateProfile.healthDataConsent` 보관/삭제 방식은 법무 검토 필요.
  **주의**: 이 세션 샌드박스 권한상 `node --test`/`scripts/check.ps1`/`npm run test:e2e`/`npm audit --audit-level=high`를 직접 실행하지 못했다(FE-3/FE-4 때와 동일 제약). 신규·기존 테스트 케이스를 코드와 수동 대조해 로직을 검증했으나, 병합 전 반드시 아래를 실행해 통과와 커버리지(`src/core/recovery.js` lines/branches/functions 80%↑)를 확인해달라.
  ```
  .\scripts\check.ps1
  node --test --test-isolation=none --experimental-test-coverage --test-coverage-include=src/core/recovery.js --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/recovery.test.mjs
  npm run test:e2e
  npm audit --audit-level=high
  ```
- 2026-08-10 | 기획(Claude) → 리뷰(Gemini) | `fe/workout-reminder-mvp` | FE-4(운동 알림) 구현 완료, `REVIEW`로 전환. `src/core/reminders.js`+`tests/workout-reminder.test.mjs`, `src/features/reminders.js`, `main.html`(시각/요일 설정 UI), `src/core/sync.js`(로컬 전용 `gmymateReminderLastShown` 계정 전환/로그아웃 시 삭제) 확인 요망. **주의**: 이 세션의 샌드박스 권한상 `node --test`/`scripts/check.ps1`을 직접 실행하지 못했다 — 로직은 테스트 케이스별로 수동 대조 검증했지만, 병합 전 반드시 `node --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/goal-settings.test.mjs tests/workout-reminder.test.mjs`와 `scripts/check.ps1`을 실행해 통과·커버리지 80%를 확인해달라.
- 2026-08-10 | 기획(Claude) → 리뷰(Gemini) | `fe/goal-settings-mvp` | FE-3(목표 설정·수정) 구현 완료, `REVIEW`로 전환. `src/core/goals.js`+`tests/goal-settings.test.mjs`, `src/features/goals.js`, `main.html`(목표 수정 폼) 확인 요망. 같은 세션 테스트 미실행 사유는 위 FE-4 항목 참고 — 병합 전 동일 명령으로 검증 필요.
- 2026-08-10 | 기획(Claude) → 전체 | — | `docs/collab/{roles,decisions,backlog,handoffs}.md` 복구 완료. 구판(`chore/ai-collab-scaffold`)은 `window.Gmymate`+`<script defer>`+`api/data.php` 계층 분리를 전제로 해서 현재 ES Module 기준 브랜치와 맞지 않아 그대로 복사하지 않고 다시 씀(`decisions.md` D-A/D-B 참고). 백로그에 `FE-3`(목표 설정·수정, `fe/goal-settings-mvp`)·`FE-4`(운동 알림, `fe/workout-reminder-mvp`) 등록, `DOING`으로 착수.
