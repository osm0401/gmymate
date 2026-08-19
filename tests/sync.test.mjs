import assert from "node:assert/strict";
import test from "node:test";

function createStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("pending offline data is pushed before remote data is pulled", async () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const originalFetch = globalThis.fetch;
  const fakeWindow = new EventTarget();
  fakeWindow.setTimeout = setTimeout;
  fakeWindow.clearTimeout = clearTimeout;
  globalThis.window = fakeWindow;
  globalThis.localStorage = createStorage([
    ["gmymateSyncOwner", "alex"],
    ["gmymateSyncDirty", "1"],
    ["gmymateProfile", JSON.stringify({ weight: "72" })]
  ]);

  const methods = [];
  let serverData = null;
  globalThis.fetch = async (_url, options = {}) => {
    const method = options.method || "GET";
    methods.push(method);

    if (method === "POST") {
      serverData = JSON.parse(options.body);
      return { json: async () => ({ ok: true }) };
    }

    return { json: async () => ({ ok: true, data: serverData }) };
  };

  try {
    const { syncAccount } = await import(`../src/core/sync.js?test=${Date.now()}`);
    assert.equal(await syncAccount("alex"), true);
    assert.deepEqual(methods, ["POST", "GET"]);
    assert.deepEqual(JSON.parse(localStorage.getItem("gmymateProfile")), { weight: "72" });
    assert.equal(localStorage.getItem("gmymateSyncDirty"), null);
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalStorage;
    globalThis.fetch = originalFetch;
  }
});

test("the app retries account sync whenever connectivity returns", async () => {
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync(new URL("../src/app.js", import.meta.url), "utf8")
  );

  assert.match(source, /addEventListener\("online",\s*\(\)\s*=>\s*syncAccount\(user\.username\)\)/);
  assert.doesNotMatch(source, /addEventListener\("online"[^\n]+once:\s*true/);
});

test("signup claims the new sync owner before saving its profile", async () => {
  const source = await import("node:fs").then(({ readFileSync }) =>
    readFileSync(new URL("../src/features/onboarding.js", import.meta.url), "utf8")
  );

  assert.ok(source.indexOf("markPendingSync(username)") < source.indexOf('writeJson("gmymateProfile", profile)'));
});
