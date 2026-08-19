import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("portfolio entry points are present and wired from the single module entry", () => {
  const login = read("index.html");
  const main = read("main.html");
  const app = read("src/app.js");

  assert.match(login, /data-demo-login/);
  assert.match(main, /id="portfolioAnalytics"/);
  assert.match(main, /id="exerciseGuideList"/);
  assert.match(main, /id="aiChatPanel"/);
  assert.match(main, /data-open-delete-account/);
  assert.match(app, /setupAnalytics/);
  assert.match(app, /setupExerciseGuides/);
  assert.match(app, /setupAiChat/);
  assert.match(app, /setupAccount/);
});

test("AI stays in the center of the seven-item mobile navigation", () => {
  const main = read("main.html");
  const nav = main.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  const items = [...nav.matchAll(/class="nav-item/g)];

  assert.equal(items.length, 7);
  assert.match(nav, /nav-item chat-nav-item/);
  assert.ok(nav.indexOf("chat-nav-item") > nav.indexOf('data-tab="log"'));
  assert.ok(nav.indexOf("chat-nav-item") < nav.indexOf('data-tab="routine"'));
});

test("account deletion is password-confirmed and AI supports stopping a response", () => {
  const account = read("src/features/account.js");
  const chat = read("src/features/ai-chat.js");

  assert.match(account, /api\/delete-account\.php/);
  assert.match(account, /password/);
  assert.match(chat, /AbortController/);
  assert.match(chat, /\.abort\(\)/);
});

test("AdFit removes unconfigured slots before loading its SDK", () => {
  const adfit = read("src/core/adfit.js");

  assert.match(adfit, /slot\.remove\(\)/);
  assert.ok(adfit.indexOf("slot.remove()") < adfit.indexOf('document.createElement("script")'));
});
