# 협업 역할 · 경계 (단일 진실 원천)

> 이 파일이 세 AI 에이전트의 역할 배분에 대한 **유일한 원본**이다.
> `AGENTS.md`(Codex) · `GEMINI.md`(Gemini) · `CLAUDE.md`(Claude)는 모두 이 파일을 가리킨다.
> 작업 시작 전 **반드시** 이 파일과 `decisions.md`를 먼저 읽는다.
>
> 2026-08-10 복구판: 이전 버전(`chore/ai-collab-scaffold` 브랜치)은 `window.Gmymate` 전역 네임스페이스 +
> `<script defer>` 다중 로드 구조를 전제로 작성됐다. 현재 기준 브랜치(`main`에서 분기한 ES Module 구조,
> `main.html`이 `<script type="module" src="./src/app.js">` 하나만 로드)와 맞지 않아 그대로 복사하지 않고
> 실제 코드 기준으로 다시 썼다. 오래된 버전을 참고할 필요가 있으면 git 히스토리에서만 확인한다.

## 역할 표

| AI | CLI | 역할 | 쓰기 담당 (여기만 수정) | 읽기 전용 / 금지 |
|---|---|---|---|---|
| **Claude** | Claude Code | 기획 + 프론트엔드 | `docs/collab/**`, `src/**`, `*.html` | `api/**` 수정 금지 |
| **ChatGPT** | Codex CLI | 백엔드 | `api/**` (PHP), 자기 작업의 `backlog.md` 상태·`handoffs.md` 항목 | `src/**`, `*.html`, 그 외 `docs/collab/**` 수정 금지 |
| **Gemini** | Antigravity CLI (`agy`) | 리뷰 · 테스트 | `tests/**`, `scripts/**`, `docs/collab/reviews/**` | `src/**`·`api/**` 읽기 전용(직접 수정 금지, 리뷰 노트로만 지적) |

- **기획(Claude)**은 `docs/collab/**`의 계획·결정·백로그를 관리한다. 백엔드 작업 스펙도 여기에 적어 Codex에 넘긴다.
- 경계를 넘는 변경이 필요하면 **직접 고치지 말고** `handoffs.md`에 요청을 남긴다.
- 현재 `api/`에는 D-1~D-6(구판)이 가정한 `repositories/`·`services/` 분리가 존재하지 않는다(플랫 `*.php` 파일: `login.php`/`signup.php`/`session.php`/`sync.php`/`me.php`/`music/*`). 그 분리는 실행되지 않은 과거 계획이었다 — 새 백엔드 작업을 배정할 때 이 사실을 전제로 스펙을 쓴다.

## 브랜치 규칙

- 프론트엔드: `fe/<주제>`  (예: `fe/goal-settings-mvp`, `fe/workout-reminder-mvp`)
- 백엔드: `be/<주제>`  (예: `be/data-services`)
- 리뷰/테스트: `review/<주제>` 또는 리뷰 노트만 (`docs/collab/reviews/`)
- `main` 직접 커밋 금지. 병합은 리뷰 통과 후에만.
- 서로 관련 없는 두 기능은 같은 PR/브랜치에 함께 넣지 않는다. 예: 목표 설정(`fe/goal-settings-mvp`)과 운동 알림(`fe/workout-reminder-mvp`)은 각각 별도 브랜치에서 구현·리뷰·병합한다.

## 작업 루프 (한 사이클)

1. **기획(Claude)**: `backlog.md`에 작업을 `[FE]`/`[BE]`/`[REVIEW]` 태그와 함께 정의. 상태 `TODO`.
2. **담당 에이전트**: 자기 태그 작업을 `DOING`으로 바꾸고 자기 브랜치에서 구현. 끝나면 `REVIEW`로 바꾸고 `handoffs.md`에 한 줄 남김.
3. **리뷰(Gemini)**: `decisions.md` 기준으로 diff 검증 + `scripts/check.ps1` 실행. 결과를 `docs/collab/reviews/`에 기록.
   - 통과 → 담당 에이전트(또는 사용자)가 `main` 병합, 작업 `DONE`.
   - 반려 → `DOING`으로 되돌리고 리뷰 노트의 지적 반영.

## 충돌 방지 원칙

- FE=`src/`+`*.html`, BE=`api/`로 디렉터리가 갈리므로 동시 작업해도 병합 충돌이 거의 없다.
- 두 영역에 걸치는 변경(예: 프론트가 백엔드 API 응답 형태 변경을 요구)은 `decisions.md`에 먼저 합의를 적고, 각자 자기 영역만 수정한다.
- 공유 문서(`docs/collab/**`)는 기획(Claude)이 주로 쓴다. Codex는 자기 작업의 `backlog.md` 상태·`handoffs.md` 항목만, Gemini는 `reviews/`만 수정한다.
- FE 내부에서도 서로 다른 기능(목표 설정 vs 운동 알림 등)은 별도 브랜치로 나눠 각자 리뷰·병합한다 — 브랜치 규칙 참고.
