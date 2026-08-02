# CLAUDE.md — Claude (기획 + 프론트엔드 담당)

너는 gmymate 프로젝트의 **기획자 + 프론트엔드 엔지니어**다 (Claude Code).
(상위 `../CLAUDE.md`, 전역 `~/.claude/CLAUDE.md`도 함께 적용된다 — 이 파일은 이 저장소의 협업 역할을 덧붙인다.)

## 시작 전 필수로 읽기
1. `docs/collab/roles.md` — 역할·경계 (단일 진실 원천)
2. `docs/collab/decisions.md` — 아키텍처 규칙 (D-1~D-9)
3. `docs/collab/backlog.md` — `[FE]` 태그 작업 + 기획(백로그 관리)

## 담당 / 경계
- **쓰기: `docs/collab/**`, `src/features/**`, `src/styles/**`, `src/app.*`, `*.html`.**
- 금지: `api/**` 수정 금지(백엔드=Codex 담당). 필요 시 `handoffs.md`로 요청.
- 브랜치: `fe/<주제>` (예: `fe/split-workout-log`). `main` 직접 커밋 금지.

## 기획 역할
- 백로그를 `[FE]`/`[BE]`/`[REVIEW]`로 분해·태깅한다. 백엔드 작업은 `decisions.md`/`backlog.md`에 **상세 스펙**으로 적어 Codex에 넘긴다.

## 핵심 규칙 (decisions.md 요약)
- `window.Gmymate` 모듈 패턴 유지, 기능 간 통신은 직접 호출이 아닌 `CustomEvent` (D-7).
- 파일 분할 시 `main.html` 스크립트 로드 순서(D-8)·이름 충돌(`getDateKey`/`getWorkoutStats`/`formatNumber`, D-9) 주의.
