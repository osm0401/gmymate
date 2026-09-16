# AI 3자 협업 오케스트레이터 — 단독 실행 가이드

한 줄 명령을 넣으면 세 개의 AI가 기획 → 구현 → 검증 → 리뷰 → 머지까지 사람 손 없이 처리한다.
Claude Code 없이 터미널에서 직접 돌리는 방법을 정리한다.

| 역할 | 담당 | 인증 |
| --- | --- | --- |
| 지휘 — 작업 지시서 작성, 웹 리서치 | `codex` CLI | ChatGPT 구독 |
| 코딩 — 구현 + 테스트 작성 | `claude` CLI | Claude 구독 |
| 리뷰 — 체크리스트 기반 승인/반려 | `gemini` CLI | 구글 계정 |
| PR·머지 | `gh` CLI | GitHub |

**API 키가 필요 없다.** 네 CLI 모두 계정/구독 인증을 쓴다.

---

## 1. 준비

### 1-1. 필요한 것

- Node.js 18 이상 (`node -v`로 확인)
- 아래 CLI 네 개가 설치되고 **로그인까지** 되어 있을 것

```bash
codex login      # 상태 확인: codex login status
claude           # 실행하면 인증 흐름이 뜬다
gemini -p "hi"   # 응답이 오면 로그인된 것
gh auth login    # 상태 확인: gh auth status
```

넷 중 하나라도 없거나 로그인이 안 되어 있으면 오케스트레이터가 시작 직후 멈추고 어느 CLI가 문제인지 알려준다.

### 1-2. 설정

`orchestrator/.env`를 만든다. `.env.example`을 복사해서 쓰면 된다.

```bash
cp orchestrator/.env.example orchestrator/.env
```

**필수 항목은 `BASE_BRANCH` 하나다.** 작업의 기준이 되는 브랜치이고, 여기서 feature 브랜치가 갈라져 나와 다시 여기로 머지된다.

```
BASE_BRANCH=restore/conversation-start-20260803
```

나머지는 전부 기본값이 있어 비워둬도 된다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `BASE_BRANCH` | `main` | 기준 브랜치. **원격에도 있어야 한다** |
| `MAX_ROUNDS` | `20` | 리뷰 반려 반복 상한. `0`이면 무제한 |
| `GEMINI_REVIEW_MODEL` | `gemini-2.5-pro` | 리뷰어 모델 |
| `GEMINI_AGY_MODEL` | `gemini-2.5-flash-lite` | AGY 대행 모델 |
| `CODEX_MODEL` | (비움) | 비우면 codex 기본 모델 |
| `CLAUDE_PERMISSION_MODE` | `acceptEdits` | 코더의 권한 모드 |
| `REPO_DIR` | 상위 디렉터리 | 대상 저장소 경로 |

`.env`는 gitignore에 걸려 있다. 커밋되지 않는다.

### 1-3. 시작 전 체크

오케스트레이터가 git을 건드리기 전에 아래를 자동으로 확인하고, 하나라도 걸리면 즉시 멈춘다.

1. 네 CLI가 모두 있는가
2. 작업 트리가 깨끗한가 — 더러우면 `git add -A`가 무관한 작업물까지 커밋에 쓸어담는다
3. `BASE_BRANCH`가 **원격에** 있는가 — 없으면 PR을 만들 수 없다

3번이 특히 중요하다. 로컬 전용 브랜치를 기준으로 잡으면 25분짜리 작업을 다 끝낸 뒤 마지막 단계에서야 실패한다. 지금은 시작 1초 만에 걸린다.

---

## 2. 실행

```bash
node orchestrator/orchestrator.mjs "운동 기록에 주간 볼륨 추이 그래프 추가해줘"
```

한 줄이면 끝이다. 25~40분 정도 걸리고, 진행 상황이 타임스탬프와 함께 출력된다.

```
[2026-08-10T02:10:19Z] 사이클 시작 t202608100210: 나만의 루틴 추가 기능 만들어줘
[2026-08-10T02:10:20Z] 지휘: 작업 지시서 작성 중 (온라인 리서치 포함)
[2026-08-10T02:24:44Z] 라운드 1: 코딩
[2026-08-10T02:35:18Z] 라운드 1: 자동 검사 (check.ps1)
[2026-08-10T02:35:19Z] 검사 통과
[2026-08-10T02:35:19Z] 라운드 1: 리뷰
[2026-08-10T02:35:45Z] 판정: APPROVE
[2026-08-10T02:35:50Z] PR 생성: https://github.com/osm0401/gmymate/pull/2
[2026-08-10T02:35:55Z] 머지 완료
```

> **터미널 출력을 `| tail`이나 `| head`로 파이프하지 마라.** 버퍼링 때문에 끝날 때까지 아무것도 안 보인다.
> 파일로도 남기고 싶으면 `| tee log.txt`를 쓴다.

### 주간 보고서

```bash
node orchestrator/orchestrator.mjs --report weekly
```

### 자체 점검

```bash
node orchestrator/test.mjs
```

한도 감지·리뷰 판정 파싱·반복 이슈 플래그 로직을 확인한다. `ok`가 나오면 정상이다.

---

## 3. 한 사이클에서 벌어지는 일

```
BASE_BRANCH ──► feature/tYYYYMMDDHHMM 생성
      │
      ├─ 1. 지휘 (codex)      웹 검색으로 최신 라이브러리·유사 서비스·알려진 취약점 확인
      │                       → 목표/근거/체크리스트/수용기준/리스크/참고링크 형식의 지시서
      │
      ├─ 2. 코딩 (claude)     지시서대로 구현 + 테스트 작성 → 오케스트레이터가 커밋
      │
      ├─ 3. 검사 (check.ps1)  PHP 문법 + JS 문법 + node --test
      │                       실패 → 리뷰 건너뛰고 즉시 코더에게 반려 (2번으로)
      │
      ├─ 4. 리뷰 (gemini)     6개 체크리스트로 APPROVE / REQUEST_CHANGES 판정
      │                       반려 → 피드백을 코더에게 (2번으로)
      │
      └─ 5. 머지 (gh)         PR 생성 → squash 머지 → 원격 브랜치 삭제
                              → BASE_BRANCH로 복귀
```

검사가 리뷰보다 먼저인 이유: 문법에서 걸릴 코드를 리뷰어에게 보내면 무료 한도만 태운다.

### 리뷰 체크리스트

기능 요구사항 · 보안(시크릿 하드코딩, 입력 검증) · 에러 처리 · 테스트 · 코드 품질 · 성능

### AGY 폴백

지휘나 코딩이 한도 에러(429, quota, usage limit 등)로 실패하면 5초 뒤 한 번 재시도하고, 그래도 안 되면 Gemini가 그 역할을 대신한다. Gemini까지 소진되면 10~30분 간격으로 자동 재시도한다.

한도 수치를 하드코딩하지 않고 실제 API 에러 응답으로 판단한다. 공급사가 정책을 바꿔도 따라간다.

---

## 4. 결과 확인

모든 실행 기록이 `reports/`에 쌓인다.

| 파일 | 내용 |
| --- | --- |
| `실행기록_YYYY-MM-DD_HHMM.docx` | **워드로 바로 열린다.** 명령, 라운드 수, 결과, AGY 발동, 반복 이슈, 지시서 전문, 타임스탬프 로그 |
| `YYYY-MM-DD.md` | 그날의 사이클 요약이 누적 |
| `주간요약_날짜_시각.docx` | `--report weekly`로 생성 |
| `tXXXXXXXXXXXX-order.md` | 그 사이클의 작업 지시서 원문 |

docx는 의존성 없이 `node:zlib`만으로 만든다. docx가 XML 세 개짜리 zip이라 라이브러리를 붙일 이유가 없다.

---

## 5. 문제가 생기면

실제로 겪은 것들이다. 대부분 이미 수정됐지만 다시 나올 때를 위해 남긴다.

| 증상 | 원인 | 대처 |
| --- | --- | --- |
| `작업 트리에 커밋되지 않은 변경 N건` | 더티 트리 | 커밋하거나 `git stash`. 보고서를 워드로 열어둔 경우는 이제 안 걸린다 |
| `기준 브랜치가 원격에 없어 PR을 만들 수 없다` | 로컬 전용 브랜치를 base로 지정 | `git push -u origin <브랜치>` 또는 `BASE_BRANCH` 변경 |
| `... CLI를 찾을 수 없다` | 미설치 또는 미로그인 | 해당 CLI 설치·로그인 |
| `codex: ... requires a newer version of Codex` / `not supported ... ChatGPT account` | codex 자체 기본 모델이 이 계정 등급에서 못 쓰는 걸로 바뀜(주기적으로 발생) | CLI 업그레이드로 안 풀린다 — `.env`에 `CODEX_MODEL=<실제로 되는 모델명>` 고정. `echo hi \| codex exec -s read-only -m <모델명> "test"`로 먼저 확인 |
| `리뷰어가 두 번 모두 판정을 내지 못했다` | 리뷰어가 도구 권한에 걸려 빈 응답 | 다시 실행. 반복되면 6장 참고 |
| `AGY 모드 발동` | 한도 도달 | 정상 동작이다. 사유가 로그와 docx에 남는다 |
| `블로킹 발생` | Gemini까지 소진 | 자동 재시도한다. 기다리면 된다 |
| `변경 사항 없음 — 중단` | 코더가 "이미 구현됨"으로 판단 | 정상이다. 같은 기능을 두 번 요청하면 이렇게 된다 |
| 검사가 계속 실패 | `php`/`node` 미설치 | 도구가 없으면 `SKIP`으로 넘어간다. 진짜 문법 오류일 때만 `FAIL` |

### 사이클이 중간에 죽으면

작업물은 `feature/*` 브랜치에 남아있다. 잃지 않는다.

```bash
git branch --list "feature/*"          # 남은 브랜치 확인
git log --oneline -1 feature/tXXXX     # 뭐가 들어있는지
git branch -D feature/tXXXX            # 버릴 때
```

사이클은 끝날 때 기준 브랜치로 자동 복귀한다. feature 브랜치에 체크아웃된 채 끝나면 다음 커밋이 거기로 흘러들어가기 때문이다.

---

## 6. 알아둘 제약

**1. 이 PC의 `gemini`는 Google Gemini CLI가 아니다.**
`AppData\Roaming\npm\gemini-shim.js`가 인자를 변환해 `agy.exe`(Antigravity)로 넘긴다. 그래서:

- 헤드리스로 돌 때 리뷰어가 도구를 쓰려 하면 자동 거부되고 **종료 코드 0에 빈 출력**으로 끝난다. 리뷰 프롬프트에 "도구를 쓰지 말고 제공된 텍스트만으로 판정하라"를 명시해서 해결했다
- 셔임의 `mapModelName()`이 `gemini-2.5-pro`와 `gemini-2.5-flash-lite`를 **둘 다 같은 모델**로 매핑한다. 리뷰용/AGY용 모델 분리가 실제로는 작동하지 않는다
- 모델 문자열에 `sonnet`/`opus`가 들어가면 Claude 모델로 라우팅된다. 리뷰어를 Claude로 돌릴 수는 있지만 코더와 같은 계열이 되어 3자 교차검증의 의미가 약해진다

**2. 자동 머지는 실제로 원격에 반영된다.**
승인되면 사람 확인 없이 push하고 머지한다. 계획서가 요구한 동작이다. 저장소가 공개면 그대로 공개된다.

`--admin`은 일부러 뺐다. 브랜치 보호 규칙을 자동 에이전트가 우회하면 규칙이 무의미해진다.

**3. `MAX_ROUNDS` 기본값 20은 원안에 없던 상한이다.**
계획서 원안은 통과할 때까지 무제한 반복이지만, 리뷰가 계속 반려되면 밤새 무료 한도를 태울 수 있다. 원안대로 가려면 `MAX_ROUNDS=0`.

**4. 지휘자와 저장소 규약이 어긋날 수 있다.**
브랜치마다 아키텍처가 다르면 지휘자가 다른 브랜치의 관례를 전제한 지시서를 쓴다. 실제로 겪었고, 코더가 "지시서가 틀렸다"며 저장소의 실제 규약을 따랐다. 코더의 판단이 옳았지만, 애초에 브랜치 구조를 정리해두는 편이 낫다.

**5. codex CLI 자체 기본 모델은 이 계정 등급에서 갑자기 안 될 수 있다.**
OpenAI가 codex의 기본 모델을 바꾸는 건 CLI 업그레이드와 무관하게 서버 쪽에서 일어난다. 실제로 겪었다 — 기본값이 `gpt-6-astra`로 바뀌었는데 이 ChatGPT 구독 등급에서는 `gpt-6` 계열 자체가 "not supported ... ChatGPT account"로 거부된다. CLI를 최신으로 올려도 계정 제약이라 안 풀린다. `.env`의 `CODEX_MODEL`을 실제로 되는 모델(`gpt-5.5`, `gpt-5.6-sol` 등 확인된 값)로 고정해야 한다.

같은 이름의 CLI가 여러 벌 설치돼 있으면(npm 전역판 + 네이티브 인스톨러판 등) `--version`을 찍어 더 높은 쪽을 자동으로 고른다 — 다만 이건 "설치된 버전 중 최신"을 고르는 것뿐이라, 설치된 버전 전부가 새 모델을 지원 못 하면(이번 경우) 이 로직만으로는 못 풀리고 `CODEX_MODEL` 고정이 필요하다.

---

## 7. 상시 구동

계획서 7장이 상정한 방식이다. **파이프라인이 검증된 다음에 하는 것을 권한다.**

### Windows 작업 스케줄러

```powershell
$action  = New-ScheduledTaskAction -Execute "node" `
  -Argument "orchestrator/orchestrator.mjs --report weekly" `
  -WorkingDirectory "C:\경로\gmymate"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9am
Register-ScheduledTask -TaskName "OrchestratorWeekly" -Action $action -Trigger $trigger
```

### cron

```bash
0 9 * * 1 cd /경로/gmymate && node orchestrator/orchestrator.mjs --report weekly
```

무인으로 두기 전에 확인할 것: `MAX_ROUNDS`가 적절한가, 저장소가 공개인가, 자동 머지가 들어가도 되는 브랜치인가.

---

## 8. 파일 구성

```
orchestrator/
  orchestrator.mjs   전체 사이클. 이 파일 하나가 파이프라인이다
  docx.mjs           의존성 없는 docx 작성기 (node:zlib만 사용)
  test.mjs           자체 점검
  .env               내 설정 (gitignore됨)
  .env.example       설정 템플릿
  README.md          요약
  GUIDE.md           이 문서
scripts/
  check.ps1          검사 게이트 (Windows)
  check.sh           검사 게이트 (POSIX)
reports/             실행 기록이 쌓이는 곳
```

의존성 0개, `npm install` 불필요. Node 내장 모듈만 쓴다.
