import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecovery, normalizeRecoveryCheckins } from "../src/core/recovery.js";

test("recovery score rewards sleep and energy while treating soreness as fatigue", () => {
  assert.deepEqual(calculateRecovery({ sleep: 5, energy: 5, soreness: 1 }), {
    ok: true,
    score: 100,
    status: "준비 좋음",
    recommendation: "평소 계획대로 운동해도 좋아요."
  });
  assert.equal(calculateRecovery({ sleep: 3, energy: 3, soreness: 3 }).status, "가볍게 진행");
  assert.equal(calculateRecovery({ sleep: 1, energy: 1, soreness: 5 }).status, "회복 우선");
});

test("recovery rejects values outside the one-to-five range", () => {
  assert.deepEqual(calculateRecovery({ sleep: 0, energy: 3, soreness: 3 }), { ok: false, reason: "invalid-values" });
  assert.deepEqual(calculateRecovery({ sleep: "bad", energy: 3, soreness: 3 }), { ok: false, reason: "invalid-values" });
});

test("stored recovery data keeps valid unique dates newest first", () => {
  assert.deepEqual(normalizeRecoveryCheckins([
    { dateKey: "2026-08-13", sleep: 3, energy: 3, soreness: 2 },
    { dateKey: "bad", sleep: 5, energy: 5, soreness: 1 },
    { dateKey: "2026-08-13", sleep: 4, energy: 4, soreness: 1 },
    { dateKey: "2026-08-14", sleep: 5, energy: 4, soreness: 2 }
  ]), [
    { dateKey: "2026-08-14", sleep: 5, energy: 4, soreness: 2 },
    { dateKey: "2026-08-13", sleep: 4, energy: 4, soreness: 1 }
  ]);
});
