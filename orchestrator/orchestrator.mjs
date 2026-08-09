#!/usr/bin/env node
// AI 3자 협업 오케스트레이터
//   ChatGPT(지휘) -> Claude Code(코딩) -> Gemini(리뷰) 자동 반복 파이프라인
//   한도 소진 시 Gemini가 역할을 대행하는 AGY 모드로 자동 폴백
//
// 사용법:
//   node orchestrator.mjs "운동 기록 기능 추가해줘"
//   node orchestrator.mjs --report weekly

import { execSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeDocx, stamp } from "./docx.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv(path.join(here, ".env"));           // 오케스트레이터 전용 키가 우선
loadEnv(path.resolve(here, "..", ".env")); // 없으면 저장소 루트 .env를 재사용

const repo = process.env.REPO_DIR || path.resolve(here, "..");
const base = process.env.BASE_BRANCH || "main";
const reviewModel = process.env.GEMINI_REVIEW_MODEL || "gemini-2.5-pro";
const agyModel = process.env.GEMINI_AGY_MODEL || "gemini-2.5-flash-lite"; // 대행은 한도 넉넉한 쪽
const maxRounds = Number(process.env.MAX_ROUNDS ?? 20); // 0 = 무제한

// 이번 사이클의 관찰 기록 — 보고서에 그대로 들어간다
const cycle = { agy: [], blocked: [], rounds: 0, flags: [], log: [] };

// ---------------------------------------------------------------- 유틸

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { cwd: repo, encoding: "utf8", maxBuffer: 64e6 }).trim();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  cycle.log.push(line);
  console.log(line);
}

// 한도/레이트리밋 계열 에러만 AGY 폴백 대상으로 본다.
// 하드코딩된 사용량 수치가 아니라 실시간 에러 응답으로 판단 (계획서 6.2)
const QUOTA_RE = /(\b429\b|rate[_ -]?limit|quota|too many requests|insufficient_quota|resource_exhausted|overloaded|usage limit)/i;
export function isQuotaError(err) {
  return QUOTA_RE.test(`${err?.status ?? ""} ${err?.message ?? err ?? ""}`);
}

// 1회 백오프 재시도 후에도 한도 에러면 Gemini 대행(AGY)으로 전환
async function withAGY(role, primary, fallback) {
  try {
    return await primary();
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    log(`${role} 한도 에러 — 5초 후 1회 재시도`);
    await sleep(5000);
    try {
      return await primary();
    } catch (e2) {
      if (!isQuotaError(e2)) throw e2;
      const reason = String(e2.message || e2).slice(0, 300);
      cycle.agy.push({ role, at: new Date().toISOString(), reason });
      log(`AGY 모드 발동: ${role} 역할을 Gemini(${agyModel})가 대행`);
      return await fallback();
    }
  }
}

// ---------------------------------------------------------------- API 호출

// Gemini CLI를 쓴다 — 구글 계정 인증이라 API 키가 필요 없고, 코더(claude CLI)와 방식이 같다.
// 프롬프트에 diff가 통째로 들어가 argv 길이 제한(윈도우 ~32KB)을 넘기므로 파일로 넘긴다.
function gemini(model, prompt) {
  const f = path.join(tmpdir(), `orch-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(f, prompt);
  try {
    return execFileSync("gemini", ["--model", model, "-p", `@${f}`], {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 64e6,
    }).trim();
  } catch (e) {
    throw new Error(`gemini ${model}: ${e.stderr || e.stdout || e.message}`);
  } finally {
    try { unlinkSync(f); } catch {}
  }
}

// Gemini까지 소진되면 파이프라인을 "보류"로 두고 10~30분 간격 자동 재시도 (계획서 6.3)
async function geminiHold(model, prompt) {
  for (let i = 0; ; i++) {
    try {
      return await gemini(model, prompt);
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      const wait = Math.min(30, 10 * (i + 1));
      cycle.blocked.push({ at: new Date().toISOString(), model, wait });
      log(`블로킹 발생: Gemini 한도 소진 — ${wait}분 후 자동 재시도`);
      await sleep(wait * 60_000);
    }
  }
}

async function openai(prompt) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      tools: [{ type: "web_search" }], // 지휘자는 온라인 리서치 필수 (계획서 3)
      input: prompt,
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`openai: ${await r.text()}`), { status: r.status });
  const j = await r.json();
  return j.output_text ?? (j.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("");
}

// Claude Code CLI를 헤드리스로 실행. CLI가 직접 파일을 수정하고 결과 요약을 돌려준다.
function claudeCode(prompt) {
  try {
    const out = execFileSync(
      "claude",
      ["-p", prompt, "--output-format", "json", "--permission-mode", process.env.CLAUDE_PERMISSION_MODE || "acceptEdits"],
      { cwd: repo, encoding: "utf8", maxBuffer: 64e6 },
    );
    const j = JSON.parse(out);
    if (j.is_error) throw new Error(j.result || "claude code 실패");
    return j.result ?? "";
  } catch (e) {
    throw new Error(e.stderr || e.message);
  }
}

// ---------------------------------------------------------------- 역할

const projectContext = () => {
  const f = path.join(repo, "CLAUDE.md");
  return existsSync(f) ? readFileSync(f, "utf8").slice(0, 4000) : "";
};

function directorPrompt(command) {
  return `당신은 개발 파이프라인의 지휘자다. 아래 한 줄 명령을 실행 가능한 작업 지시서로 만들어라.

# 명령
${command}

# 대상 저장소 규약
${projectContext()}

# 절차
1. 명령을 목표/범위/제약조건으로 분해한다.
2. 웹 검색으로 관련 라이브러리 최신 버전, 유사 서비스 벤치마킹, 알려진 이슈(취약점·deprecated API)를 확인한다.
3. 아래 포맷으로 작업 지시서를 작성한다. PR 하나가 기능 하나가 되도록 범위를 좁게 잡는다.

## 목표
## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)
## 세부 작업 체크리스트
## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로
## 예상 리스크
## 참고 링크

마크다운 지시서만 출력하라.`;
}

const director = (command) =>
  withAGY("지휘(ChatGPT)", () => openai(directorPrompt(command)), () => geminiHold(agyModel, directorPrompt(command)));

function coderPrompt(order, feedback) {
  return `아래 작업 지시서대로 이 저장소에 코드를 구현하라.

${order}
${feedback ? `\n# 리뷰어 반려 피드백 — 아래 지적을 모두 해결하라\n${feedback}\n` : ""}
요구사항:
- 저장소의 기존 규약(CLAUDE.md)을 따를 것
- 핵심 로직에는 테스트 코드를 함께 작성하고 로컬에서 통과시킬 것
- 수용 기준을 실제로 충족시킬 것
- 커밋은 하지 말 것 (오케스트레이터가 처리한다)`;
}

// AGY 코더 대행: Gemini는 파일을 직접 못 고치므로 전체 파일 내용을 JSON으로 받아 기록한다.
// ponytail: 전체 파일 재작성 방식이라 대형 파일에선 토큰이 크다. 문제되면 unified diff + git apply로 교체.
async function agyCoder(order, feedback) {
  const tree = sh('git ls-files').split("\n").slice(0, 400).join("\n");
  const text = await geminiHold(
    agyModel,
    `${coderPrompt(order, feedback)}

# 저장소 파일 목록
${tree}

출력 형식: 설명 없이 JSON만. [{"path":"src/foo.js","content":"파일 전체 내용"}]
수정이 필요한 파일만 포함하고, 각 파일은 전체 내용을 담아라.`,
  );
  const json = text.match(/\[[\s\S]*\]/);
  if (!json) throw new Error("AGY 코더 응답에서 JSON을 찾지 못함");
  const files = JSON.parse(json[0]);
  for (const f of files) {
    const dest = path.join(repo, f.path);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, f.content);
  }
  return `AGY 코더가 ${files.length}개 파일 작성: ${files.map((f) => f.path).join(", ")}`;
}

const coder = (order, feedback) =>
  withAGY("코딩(Claude)", () => claudeCode(coderPrompt(order, feedback)), () => agyCoder(order, feedback));

const REVIEW_CHECKLIST = `- 기능 요구사항: 지시서의 수용 기준을 코드가 실제로 충족하는가
- 보안: 인증/인가 누락, 입력값 검증, 시크릿(API 키 등) 하드코딩 여부
- 에러 처리: 예외 상황·네트워크 실패 처리 존재 여부
- 테스트: 핵심 로직 테스트 존재 및 통과 여부
- 코드 품질: 스타일 일관성, 불필요한 복잡도, 가독성
- 성능: 불필요한 반복 호출, N+1 쿼리 등 명백한 성능 이슈`;

async function reviewer(order, diff) {
  const text = await geminiHold(
    reviewModel,
    `당신은 코드 리뷰어다. 아래 작업 지시서와 diff를 체크리스트 기준으로 검토하라.

# 작업 지시서
${order}

# 체크리스트
${REVIEW_CHECKLIST}

# diff
${diff.slice(0, 400_000)}

첫 줄에 판정만 단독으로 출력하라: APPROVE 또는 REQUEST_CHANGES
반려 시 둘째 줄부터 "파일:라인 — 문제 — 수정 방향" 형식으로 지적하라.`,
  );
  return parseReview(text);
}

// 판정을 못 읽으면 통과시키지 않는다 (fail-closed)
export function parseReview(text) {
  const m = String(text).match(/REQUEST[_ ]CHANGES|APPROVE/i);
  const verdict = m && /APPROVE/i.test(m[0]) ? "APPROVE" : "REQUEST_CHANGES";
  return { verdict, feedback: String(text).trim() };
}

// 같은 지적이 3회 이상 반복되면 플래그만 세운다 (자동 정지는 하지 않음 — 계획서 4)
export function repeatFlag(history) {
  const seen = new Map();
  const flags = [];
  for (const fb of history) {
    const key = fb.toLowerCase().replace(/[\s\d]+/g, " ").slice(0, 200);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === 3) flags.push(fb.split("\n").slice(0, 3).join(" ").slice(0, 160));
  }
  return flags;
}

// ---------------------------------------------------------------- 보고서

const reportsDir = () => {
  const d = path.join(repo, "reports");
  mkdirSync(d, { recursive: true });
  return d;
};

function writeDaily(entry) {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(reportsDir(), `${day}.md`);
  if (!existsSync(file)) writeFileSync(file, `# 일일 요약 ${day}\n`);
  appendFileSync(file, entry);
  return file;
}

// 실행 기록을 날짜_시각 이름의 docx로 남긴다 — 워드에서 바로 열어볼 수 있게
function saveRecord(title, markdown) {
  const ts = stamp();
  const file = path.join(reportsDir(), `실행기록_${ts}.docx`);
  writeDocx(file, `# ${title}\n\n생성 시각: ${new Date().toLocaleString("ko-KR")}\n\n${markdown}\n\n## 실행 로그\n\n\`\`\`\n${cycle.log.join("\n")}\n\`\`\`\n`);
  log(`실행 기록 저장: ${file}`);
  return file;
}

function weeklyReport() {
  const files = readdirSync(reportsDir()).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-7);
  const body = files.map((f) => readFileSync(path.join(reportsDir(), f), "utf8")).join("\n");
  const count = (re) => (body.match(re) ?? []).length;
  const out = `# 주간 요약 (${files[0] ?? "-"} ~ ${files.at(-1) ?? "-"})

- 완료 PR: ${count(/^- 결과: 머지 완료/gm)}건
- 반려/재작업: ${count(/^- 리뷰 라운드:/gm)}건 중 재작업 포함
- AGY 모드 발동: ${count(/AGY 모드 발동/g)}회
- 블로킹 발생: ${count(/블로킹 발생/g)}회
- 반복 이슈 플래그: ${count(/^  - 반복 이슈/gm)}건

## 원본 일일 요약
${body}
`;
  const file = path.join(reportsDir(), `weekly-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(file, out);
  const doc = path.join(reportsDir(), `주간요약_${stamp()}.docx`);
  writeDocx(doc, out);
  return `${file}\n${doc}`;
}

// ---------------------------------------------------------------- 사이클

async function runCycle(command) {
  const id = `t${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12)}`;
  const branch = `feature/${id}`;
  const started = new Date();

  log(`사이클 시작 ${id}: ${command}`);

  // 사전 점검 — git을 건드리기 전에 막는다.
  // 특히 더티 트리에서 시작하면 뒤의 `git add -A`가 무관한 작업물까지 커밋에 쓸어담는다.
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY 없음 — .env를 채워라");
  for (const cli of ["gemini", "claude", "gh"]) {
    try { execFileSync(process.platform === "win32" ? "where" : "which", [cli], { stdio: "ignore" }); }
    catch { throw new Error(`${cli} CLI를 찾을 수 없다 — 설치/로그인 후 실행하라`); }
  }
  const dirty = sh("git status --porcelain");
  if (dirty) throw new Error(`작업 트리에 커밋되지 않은 변경 ${dirty.split("\n").length}건 — 먼저 커밋/스태시 후 실행하라`);

  sh(`git checkout ${base}`);
  sh(`git pull --ff-only || true`);
  sh(`git checkout -b ${branch}`);

  log("지휘: 작업 지시서 작성 중 (온라인 리서치 포함)");
  const order = await director(command);
  const orderFile = path.join(reportsDir(), `${id}-order.md`);
  writeFileSync(orderFile, order);

  let feedback = null;
  let verdict = "REQUEST_CHANGES";
  const history = [];

  while (verdict !== "APPROVE") {
    cycle.rounds++;
    if (maxRounds && cycle.rounds > maxRounds) {
      log(`라운드 상한(${maxRounds}) 도달 — 사람이 볼 수 있게 보고서에 남기고 중단`);
      break;
    }
    log(`라운드 ${cycle.rounds}: 코딩`);
    const work = await coder(order, feedback);
    log(work.slice(0, 500));

    if (!sh("git status --porcelain")) {
      log("변경 사항 없음 — 중단");
      break;
    }
    writeFileSync(path.join(repo, ".git", "ORCH_MSG"), `${id}: ${command}\n\n${order.split("\n").slice(0, 12).join("\n")}\n`);
    sh("git add -A");
    sh(`git commit -F .git/ORCH_MSG`);

    const diff = sh(`git diff ${base}...HEAD`);
    log(`라운드 ${cycle.rounds}: 리뷰`);
    ({ verdict, feedback } = await reviewer(order, diff));
    log(`판정: ${verdict}`);
    if (verdict !== "APPROVE") {
      history.push(feedback);
      cycle.flags = repeatFlag(history);
    }
  }

  let result = "미완료 (라운드 상한 또는 변경 없음)";
  if (verdict === "APPROVE") {
    sh(`git push -u origin ${branch}`);
    const bodyFile = path.join(reportsDir(), `${id}-pr.md`);
    writeFileSync(bodyFile, `## 작업 지시서 요약\n\n${order.split("\n").slice(0, 30).join("\n")}\n\n## Gemini 리뷰 결과\n\nAPPROVE\n\n${feedback ?? ""}`);
    const url = sh(`gh pr create --base ${base} --head ${branch} --title "${id}: ${command.replace(/"/g, "'")}" --body-file "${bodyFile}"`);
    log(`PR 생성: ${url}`);
    sh(`gh pr merge ${branch} --squash --delete-branch --admin`);
    result = `머지 완료 — ${url.split("\n").pop()}`;
    log("머지 완료 — Vercel/배포 파이프라인이 이어받음");
  }

  const summary = `
## ${id} — ${command}
- 시작: ${started.toISOString()}
- 리뷰 라운드: ${cycle.rounds}
- 결과: ${result}
- AGY 모드: ${cycle.agy.length ? cycle.agy.map((a) => `${a.role} (${a.reason.slice(0, 80)})`).join("; ") : "없음"}
- 블로킹: ${cycle.blocked.length ? `${cycle.blocked.length}회` : "없음"}
${cycle.flags.map((f) => `  - 반복 이슈(3회+): ${f}`).join("\n")}
`;
  writeDaily(summary);
  saveRecord(`${id} 실행 기록`, `${summary}\n## 작업 지시서\n\n${order}`);
}

// ---------------------------------------------------------------- 진입점

const args = process.argv.slice(2);
if (args[0] === "--report") {
  console.log(args[1] === "weekly" ? weeklyReport() : writeDaily(""));
} else if (args[0]) {
  runCycle(args.join(" ")).catch((e) => {
    log(`사이클 실패: ${e.message}`);
    const summary = `\n## 실패 — ${args.join(" ")}\n- 사유: ${e.message}\n`;
    writeDaily(summary);
    saveRecord("사이클 실패 기록", summary);
    process.exit(1);
  });
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('사용법: node orchestrator.mjs "명령" | node orchestrator.mjs --report weekly');
}
