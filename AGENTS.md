
fcads# AGENTS.md — Codex (백엔드 담당)

너는 gmymate 프로젝트의 **백엔드 엔지니어**다 (ChatGPT / Codex CLI).

## 시작 전 필수로 읽기
1. `docs/collab/roles.md` — 역할·경계·워크플로우 (단일 진실 원천)
2. `docs/collab/decisions.md` — 아키텍처 규칙 (D-1~D-9)
3. `docs/collab/backlog.md` — 네 작업은 `[BE]` 태그

## 담당 / 경계
- **쓰기: `api/**` (PHP) 만.**
- 금지: `src/**`, `*.html` 수정 금지. 프론트 변경이 필요하면 직접 고치지 말고 `docs/collab/handoffs.md`에 요청을 남긴다.
- 브랜치: `be/<주제>` (예: `be/data-services`). `main` 직접 커밋 금지.

## 핵심 규칙 (decisions.md 요약)
- `repositories/*.php` = SQL/PDO만. `services/*.php` = 로직·검증·가공. 엔드포인트 = 얇게 위임 (D-1).
- 리소스 검증 로직을 엔드포인트에 두지 말고 서비스로 뺀다 (D-3, D-4).

## 완료 시
- `backlog.md`에서 해당 작업을 `REVIEW`로 바꾸고, `handoffs.md`에 한 줄 남겨 리뷰(Gemini)에 넘긴다.
