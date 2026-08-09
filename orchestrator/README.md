# AI 3자 협업 오케스트레이터

한 줄 명령 → ChatGPT(지휘) → Claude Code(코딩) → Gemini(리뷰) → 자동 머지 → 보고서.
한도 소진 시 Gemini가 역할을 대행하는 **AGY 모드**로 자동 전환된다.

## 준비

1. `cp .env.example .env` 후 `OPENAI_API_KEY`, `GEMINI_API_KEY` 입력
2. `claude` CLI 로그인 (`claude` 실행 후 인증)
3. `gh` CLI 로그인 (`gh auth login`) — PR 생성/머지에 사용
4. Node 18+ (내장 `fetch` 사용, 의존성 없음)

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
| 리뷰 | Gemini 2.5 Pro, 6개 체크리스트 | 한도 소진 시 10~30분 간격 자동 재시도(보류) |
| 머지 | `gh pr create` → `gh pr merge --squash` | — |

- 리뷰 판정을 못 읽으면 `REQUEST_CHANGES`로 처리한다 (fail-closed).
- 같은 지적이 3회 반복되면 보고서에 "반복 이슈"로 표시만 하고 멈추지 않는다.
- `MAX_ROUNDS` 기본 20은 계획서 원안(무제한)에 붙인 폭주 방지 상한이다. `MAX_ROUNDS=0`이면 원안대로 무제한.
- 결과는 `reports/YYYY-MM-DD.md`에 누적된다.
