# 협업 역할 · 경계 (단일 진실 원천)

> 이 파일이 세 AI 에이전트의 역할 배분에 대한 **유일한 원본**이다.
> `AGENTS.md`(Codex) · `GEMINI.md`(Gemini) · `CLAUDE.md`(Claude)는 모두 이 파일을 가리킨다.
> 작업 시작 전 **반드시** 이 파일과 `decisions.md`를 먼저 읽는다.

## 역할 표

| AI | CLI | 역할 | 쓰기 담당 (여기만 수정) | 읽기 전용 / 금지 |
|---|---|---|---|---|
| **Claude** | Claude Code | 기획 + 프론트엔드 | `docs/collab/**`, `src/features/**`, `src/styles/**`, `src/app.*`, `*.html` | `api/**` 수정 금지 |
| **ChatGPT** | Codex CLI | 백엔드 | `api/**` (PHP) | `src/**`, `*.html` 수정 금지 |
| **Gemini** | Gemini CLI | 리뷰 · 테스트 | `tests/**`, `scripts/**`, `docs/collab/reviews/**` | `src/**`·`api/**` 읽기 전용(직접 수정 금지, 리뷰 노트로만 지적) |

- **기획(Claude)**은 `docs/collab/**`의 계획·결정·백로그를 관리한다. 백엔드 작업 스펙도 여기에 적어 Codex에 넘긴다.
- 경계를 넘는 변경이 필요하면 **직접 고치지 말고** `handoffs.md`에 요청을 남긴다.

## 브랜치 규칙

- 프론트엔드: `fe/<주제>`  (예: `fe/split-workout-log`)
- 백엔드: `be/<주제>`  (예: `be/data-services`)
- 리뷰/테스트: `review/<주제>` 또는 리뷰 노트만 (`docs/collab/reviews/`)
- `main` 직접 커밋 금지. 병합은 리뷰 통과 후에만.

## 작업 루프 (한 사이클)

1. **기획(Claude)**: `backlog.md`에 작업을 `[FE]`/`[BE]`/`[REVIEW]` 태그와 함께 정의. 상태 `TODO`.
2. **담당 에이전트**: 자기 태그 작업을 `DOING`으로 바꾸고 자기 브랜치에서 구현. 끝나면 `REVIEW`로 바꾸고 `handoffs.md`에 한 줄 남김.
3. **리뷰(Gemini)**: `decisions.md` 기준으로 diff 검증 + `scripts/check.ps1` 실행. 결과를 `docs/collab/reviews/`에 기록.
   - 통과 → 담당 에이전트(또는 사용자)가 `main` 병합, 작업 `DONE`.
   - 반려 → `DOING`으로 되돌리고 리뷰 노트의 지적 반영.

## 충돌 방지 원칙

- FE=`src/`, BE=`api/`로 디렉터리가 갈리므로 동시 작업해도 병합 충돌이 거의 없다.
- 두 영역에 걸치는 변경(예: 프론트가 백엔드 API 응답 형태 변경을 요구)은 `decisions.md`에 먼저 합의를 적고, 각자 자기 영역만 수정한다.
- 공유 문서(`docs/collab/**`)는 기획(Claude)이 주로 쓴다. 다른 에이전트는 자기 몫(`handoffs.md` 항목, `reviews/`)만 추가한다.
