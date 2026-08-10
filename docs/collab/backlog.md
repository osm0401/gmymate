# 공유 백로그

> 형식: `- [상태] ID · [태그] · 담당 — 내용`  · 상태: TODO / DOING / REVIEW / DONE
> 태그: `[FE]`(프론트/Claude) `[BE]`(백엔드/Codex) `[REVIEW]`(리뷰·테스트/Gemini)
> 상세 스펙은 각 항목 아래 들여쓰기로. 규칙은 `decisions.md` 참조.
>
> 2026-08-10 복구판: 이전 파일럿 항목(BE-1/BE-2/FE-1/FE-2/REVIEW-1)은 다른 브랜치 히스토리에만 남아있고
> 이 브랜치 기준으로는 상태를 신뢰할 수 없어 옮기지 않았다. 아래는 이번 목표 설정·운동 알림 MVP만 새로 등록한다.

## 목표 설정·운동 알림 MVP

- [REVIEW] FE-3 · [FE] · Claude — 목표 설정·수정 (`fe/goal-settings-mvp`)
  - `src/core/goals.js`: `goal`(`fat-loss|muscle-gain|strength|habit`), `targetWeight`(30~250, 소수 첫째자리), `weeklyWorkout`(`"2"|"3"|"4"|"5"`) 검증·정규화 + 기존 프로필에 세 필드만 병합(나머지 보존). `tests/goal-settings.test.mjs` 선작성.
  - `main.html`에 로그인 후 목표 편집 폼(주간 목표 빈 상태 "목표 설정하기" + 별도 "목표 수정" 버튼에서 열림), `src/features/goals.js`가 초기값·제출·필드 단위 오류·포커스 이동·닫기 담당.
  - 저장은 `writeJson("gmymateProfile", ...)`로 기존 동기화 이벤트 재사용, 저장 후 요약/주간 게이지 즉시 재렌더.
  - 전체 프로필 수정 링크(`onboarding.html`로 가서 `signup.php`를 다시 호출하는 기존 버그)는 이번 범위 아님 — 손대지 않는다.
  - `api/**` 변경 없음.
- [REVIEW] FE-4 · [FE] · Claude — 앱 활성 상태 운동 알림 (`fe/workout-reminder-mvp`, FE-3 병합 후 착수)
  - `gmymateSettings`에 `workoutAlertTime`(`HH:mm`, 기본 `"18:00"`)·`workoutAlertDays`(0=일~6=토 배열, 기본 매일) 추가. 기존 `workoutAlert:true` 단독 데이터는 매일 18:00로 읽기 호환.
  - `src/core/reminders.js`: 시각/요일 검증, 일~토 주간 범위 판정, 오늘 완료 세션+진행중 완료세트 확인, 주간 목표 달성 시 억제. `tests/workout-reminder.test.mjs` 선작성.
  - 알림 권한은 사용자가 토글을 켜는 클릭 이벤트 안에서만 요청(`granted`만 저장, `denied`는 토글 되돌림). 초기화/`focus`/`visibilitychange`/분 단위 재평가, 언마운트 시 타이머 정리.
  - 중복 방지 키는 동기화 대상(`SYNCED_KEYS`)에 넣지 않는 기기 로컬 키로 관리하되 로그아웃·계정 전환 시 함께 제거한다(`src/core/sync.js`의 `clearSyncedData()`/계정 전환 분기).
  - 잠금화면 알림 본문에 사용자명·체중·목표 수치 노출 금지. UI/문서에 "앱이 열려 있을 때만 동작"함을 명시.
  - Service Worker, 서버 Web Push, VAPID, cron/queue, `api/**` 변경 전부 비범위.

## 백로그 (파일럿 이후)

- [TODO] IDEA · [FE/BE] · — gmymate 기능 개선 아이디어를 여기에 쌓는다(기획=Claude가 태그·분해).
