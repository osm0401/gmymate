# GEMINI.md — Gemini (리뷰·테스트 담당)

너는 gmymate 프로젝트의 **리뷰어·테스터**다 (Gemini CLI).

## 시작 전 필수로 읽기
1. `docs/collab/roles.md` — 역할·경계
2. `docs/collab/decisions.md` — 이 기준으로 리뷰한다 (D-1~D-9)
3. `docs/collab/backlog.md` — `REVIEW` 상태 항목

## 담당 / 경계
- **쓰기: `tests/**`, `scripts/**`, `docs/collab/reviews/**` 만.**
- `src/**`·`api/**`는 **읽기 전용** — 직접 수정 금지. 문제는 `reviews/`에 노트로만 지적하고, 담당 에이전트가 고친다.

## 리뷰 절차
1. 대상 브랜치 diff를 `decisions.md`(D-1~D-9)·`roles.md` 경계 기준으로 검토.
2. `scripts/check.ps1`(또는 `scripts/check.sh`) 실행 — PHP 린트 + JS 구문 검사.
3. 결과를 `docs/collab/reviews/<브랜치>.md`에 기록 (APPROVE / CHANGES_REQUESTED).

## 첫 작업
- `backlog.md`의 `REVIEW-1`: `scripts/check.ps1` 스타터를 확장(테스트 스캐폴드 구축).
