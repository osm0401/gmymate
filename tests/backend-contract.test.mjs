import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("database foreign keys exactly match users.id", () => {
  const schema = read("api/schema.sql");
  const userIds = [...schema.matchAll(/^\s*user_id\s+([A-Z]+(?:\s+UNSIGNED)?)\s+NOT NULL/gim)];

  assert.equal(userIds.length, 3);
  assert.deepEqual(userIds.map((match) => match[1].toUpperCase()), Array(3).fill("BIGINT"));
});

test("JSON input and login attempts have bounded shared guards", () => {
  const session = read("api/session.php");
  const login = read("api/login.php");

  assert.match(session, /MAX_JSON_BODY_BYTES\s*=\s*128\s*\*\s*1024/);
  assert.match(session, /MAX_JSON_BODY_BYTES\s*\+\s*1/);
  assert.match(session, /jsonResponse\(413/);
  assert.match(session, /json_last_error\(\)\s*!==\s*JSON_ERROR_NONE/);
  assert.match(session, /LOGIN_MAX_FAILED_ATTEMPTS\s*=\s*8/);
  assert.match(session, /LOGIN_WINDOW_SECONDS\s*=\s*10\s*\*\s*60/);
  assert.match(session, /REMOTE_ADDR/);
  assert.match(session, /flock/);
  assert.match(session, /sharedRateLimitExceeded/);
  assert.match(session, /gmymate-rate-limits-/);
  assert.match(login, /recordLoginFailure\(\)/);
  assert.match(login, /resetLoginFailures\(\)/);
});

test("sensitive endpoints keep their security contracts", () => {
  const deletion = read("api/delete-account.php");
  const gemini = read("api/gemini.php");

  assert.match(deletion, /REQUEST_METHOD[^\n]+POST/);
  assert.match(deletion, /password_verify/);
  assert.match(deletion, /DELETE_ACCOUNT_MAX_FAILED_ATTEMPTS\s*=\s*5/);
  assert.match(deletion, /recordSharedRateLimitAttempt/);
  assert.match(deletion, /beginTransaction\(\)/);
  assert.match(deletion, /DELETE FROM users WHERE id = \?/);
  assert.match(deletion, /commit\(\)/);
  assert.match(deletion, /destroyAppSession\(\)/);

  assert.match(gemini, /https:\/\/generativelanguage\.googleapis\.com\/v1beta\/interactions/);
  assert.match(gemini, /gemini-3\.7-flash/);
  assert.match(gemini, /['"]store['"]\s*=>\s*false/);
  assert.match(gemini, /GEMINI_MAX_PROMPT_CHARS\s*=\s*2000/);
  assert.match(gemini, /GEMINI_MAX_HISTORY_ITEMS\s*=\s*6/);
  assert.match(gemini, /GEMINI_MAX_HISTORY_CHARS\s*=\s*1000/);
  assert.match(gemini, /GEMINI_REQUESTS_PER_MINUTE\s*=\s*8/);
  assert.match(gemini, /sharedRateLimitExceeded/);
  assert.match(gemini, /recordSharedRateLimitAttempt/);
  assert.match(gemini, /Do not reject a question merely because it is unrelated to fitness/);
  assert.match(gemini, /basic math/);
  assert.match(gemini, /x-goog-api-key/);
  assert.match(gemini, /model_output/);
  assert.match(gemini, /\['content'\]/);
  assert.match(gemini, /\['text'\]/);
  assert.match(gemini, /jsonResponse\(200, \['reply'\s*=>/);
});

test("example configs exist and contain placeholders", () => {
  for (const path of [
    "api/config.example.php",
    "api/music/google-config.example.php",
    "api/config/gemini.example.php"
  ]) {
    const source = read(path);
    assert.match(source, /your_[a-z_]+/);
    assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}/);
  }

  assert.match(read(".gitignore"), /api\/config\/gemini\.php/);
});
