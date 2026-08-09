# AI 3자 협업 오케스트레이터

한 줄 명령 → ChatGPT(지휘) → Claude Code(코딩) → Gemini(리뷰) → 자동 머지 → 보고서.
한도 소진 시 Gemini가 역할을 대행하는 **AGY 모드**로 자동 전환된다.

## 준비

1. `OPENAI_API_KEY` — 저장소 루트 `.env`에 있으면 그대로 쓴다. 없으면 `cp .env.example .env` 후 입력
2. `claude` CLI 로그인 — 코더 역할
3. `gemini` CLI 로그인 — 리뷰어 + AGY 대행 역할 (구글 계정 인증, API 키 불필요)
4. `gh` CLI 로그인 (`gh auth login`) — PR 생성/머지
5. Node 18+ (의존성 없음)

세 AI 중 둘은 CLI 계정 인증이라 관리할 키가 `OPENAI_API_KEY` 하나뿐이다.

## 실행

```bash
node orchestrator/orchestrator.mjs "운동 기록 기능 추가해줘"
```

주간 보고서:

```bash
node orchestrator/orchestrator.mjs --report weekly
```

상시 구동 (cron, 매주 월요일 주간 보고서):

```bash
0 9 * * 1 cd /path/to/gmymate && node orchestrator/orchestrator.mjs --report weekly
```

자체 점검:

```bash
node orchestrator/test.mjs
```

## 동작

| 단계 | 담당 | 실패 시 |
| --- | --- | --- |
| 작업 지시서 | OpenAI Responses API + web_search | 5초 후 1회 재시도 → Gemini Flash-Lite 대행 |
| 코드 구현 | `claude -p --output-format json` | 동일. 대행 시 Gemini가 파일 전체 내용을 JSON으로 반환 |
| 자동 검사 | `scripts/check.ps1` (win) / `check.sh` — php·js 문법 | 실패 시 리뷰를 건너뛰고 바로 코더에게 반려 |
| 리뷰 | `gemini --model gemini-2.5-pro -p @프롬프트파일`, 6개 체크리스트 | 한도 소진 시 10~30분 간격 자동 재시도(보류) |
| 머지 | `gh pr create` → `gh pr merge --squash` | — |

- 문법 검사가 리뷰보다 먼저다. 린트에서 걸릴 코드를 Gemini에 보내면 무료 한도만 태운다.
- `php`/`node`가 없으면 해당 검사는 `SKIP`으로 넘어간다. 도구 부재는 코드 결함이 아니라서 실패로 치면 코더가 고칠 수 없는 걸 무한히 고치려 든다.
- 리뷰 판정을 못 읽으면 `REQUEST_CHANGES`로 처리한다 (fail-closed).
- 같은 지적이 3회 반복되면 보고서에 "반복 이슈"로 표시만 하고 멈추지 않는다.
- `MAX_ROUNDS` 기본 20은 계획서 원안(무제한)에 붙인 폭주 방지 상한이다. `MAX_ROUNDS=0`이면 원안대로 무제한.
- 결과는 `reports/YYYY-MM-DD.md`에 누적된다.
