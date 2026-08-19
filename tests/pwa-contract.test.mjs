import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path/posix";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("manifest describes an installable standalone app", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));

  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.name);
  assert.ok(manifest.short_name);
  assert.ok(manifest.start_url);
  assert.ok(manifest.scope);
  assert.ok(manifest.theme_color);
  assert.ok(manifest.icons.some((icon) => icon.src && icon.sizes));
});

test("every page links the manifest and a theme color", () => {
  for (const page of ["index.html", "main.html", "onboarding.html", "privacy.html"]) {
    const html = readFileSync(new URL(page, root), "utf8");
    assert.match(html, /rel="manifest"/);
    assert.match(html, /name="theme-color"/);
  }
});

test("service worker never caches API requests", () => {
  const source = readFileSync(new URL("service-worker.js", root), "utf8");

  assert.match(source, /\/api\//);
  assert.match(source, /request\.method\s*!==\s*"GET"/);
  assert.match(source, /caches\.open/);
});

test("offline shell includes every local JavaScript and CSS dependency", () => {
  const worker = readFileSync(new URL("service-worker.js", root), "utf8");
  const cached = new Set([...worker.matchAll(/"\.\/([^"?#]+)"/g)].map((match) => normalize(match[1])));
  const visited = new Set();

  function visit(path) {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(new URL(path, root), "utf8");
    const imports = [...source.matchAll(/(?:from\s+|@import\s+)["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((value) => value.startsWith("."));
    imports.forEach((specifier) => visit(normalize(join(dirname(path), specifier))));
  }

  visit("src/app.js");
  visit("src/app.css");
  visited.forEach((path) => assert.ok(cached.has(path), `${path} must be precached`));
});
