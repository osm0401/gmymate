import assert from "node:assert/strict";
import test from "node:test";
import {
  BODY_AREAS,
  calculateRecovery,
  clearCheckinPainAreas,
  getExerciseWarningAreas,
  getInjuryAreas,
  hasGeneralInjuryNotice,
  hasHealthDataConsent,
  normalizeBodyAreas,
  normalizeRecoveryCheckins,
  withHealthDataConsent,
  withInjuryAreas,
  withdrawHealthDataConsent
} from "../src/core/recovery.js";
import { exerciseCatalog } from "../src/core/data.js";

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

test("stored recovery data keeps valid unique dates newest first and normalizes missing painAreas", () => {
  assert.deepEqual(normalizeRecoveryCheckins([
    { dateKey: "2026-08-13", sleep: 3, energy: 3, soreness: 2 },
    { dateKey: "bad", sleep: 5, energy: 5, soreness: 1 },
    { dateKey: "2026-08-13", sleep: 4, energy: 4, soreness: 1 },
    { dateKey: "2026-08-14", sleep: 5, energy: 4, soreness: 2, painAreas: ["knee"] }
  ]), [
    { dateKey: "2026-08-14", sleep: 5, energy: 4, soreness: 2, painAreas: ["knee"] },
    { dateKey: "2026-08-13", sleep: 4, energy: 4, soreness: 1, painAreas: [] }
  ]);
});

test("normalizeBodyAreas drops unknown/malicious values, dedupes, and enforces a fixed order", () => {
  assert.deepEqual(normalizeBodyAreas(["shoulder", "shoulder", "<img onerror=alert(1)>", null, {}]), ["shoulder"]);
  assert.deepEqual(normalizeBodyAreas(["other", "knee", "shoulder"]), ["shoulder", "knee", "other"]);
  assert.deepEqual(normalizeBodyAreas(BODY_AREAS), BODY_AREAS);
  assert.deepEqual(normalizeBodyAreas(null), []);
  assert.deepEqual(normalizeBodyAreas("shoulder"), []);
  assert.deepEqual(normalizeBodyAreas(undefined), []);
});

test("normalizeRecoveryCheckins caps painAreas at four entries via normalizeBodyAreas", () => {
  const [entry] = normalizeRecoveryCheckins([
    { dateKey: "2026-08-13", sleep: 3, energy: 3, soreness: 2, painAreas: [...BODY_AREAS, "shoulder"] }
  ]);
  assert.equal(entry.painAreas.length, 4);
  assert.deepEqual(entry.painAreas, BODY_AREAS);
});

test("a painful recovery result never returns the unconditional 'go ahead' message alone", () => {
  const withoutPain = calculateRecovery({ sleep: 5, energy: 5, soreness: 1 });
  const withPain = calculateRecovery({ sleep: 5, energy: 5, soreness: 1, painAreas: ["shoulder"] });

  assert.equal(withPain.score, withoutPain.score);
  assert.equal(withPain.status, withoutPain.status);
  assert.notEqual(withPain.recommendation, "평소 계획대로 운동해도 좋아요.");
  assert.match(withPain.recommendation, /통증이 있거나 악화되면 중단하고 의료 전문가와 상담하세요\./);
});

test("withInjuryAreas replaces only injuryAreas and never mutates the source profile", () => {
  const profile = { weight: "72", goal: "muscle-gain" };
  const next = withInjuryAreas(profile, ["knee", "not-real"]);

  assert.deepEqual(next, { weight: "72", goal: "muscle-gain", injuryAreas: ["knee"] });
  assert.deepEqual(profile, { weight: "72", goal: "muscle-gain" });
});

test("getInjuryAreas reads legacy profiles without the field as an empty list", () => {
  assert.deepEqual(getInjuryAreas({ weight: "72" }), []);
  assert.deepEqual(getInjuryAreas(null), []);
});

test("getExerciseWarningAreas intersects an exercise's warningAreas with registered injury areas", () => {
  const exercise = { warningAreas: ["shoulder", "knee"] };
  assert.deepEqual(getExerciseWarningAreas(exercise, ["knee", "lower-back"]), ["knee"]);
  assert.deepEqual(getExerciseWarningAreas(exercise, ["other"]), []);
  assert.deepEqual(getExerciseWarningAreas({}, ["shoulder"]), []);
});

test("hasGeneralInjuryNotice only fires for the 'other' area", () => {
  assert.equal(hasGeneralInjuryNotice(["other"]), true);
  assert.equal(hasGeneralInjuryNotice(["shoulder"]), false);
  assert.equal(hasGeneralInjuryNotice([]), false);
});

test("every exercise declares an approved warningAreas list without 'other'", () => {
  exerciseCatalog.forEach((exercise) => {
    assert.ok(Array.isArray(exercise.warningAreas), `${exercise.id} needs a warningAreas array`);
    exercise.warningAreas.forEach((area) => {
      assert.ok(["shoulder", "lower-back", "knee"].includes(area), `${exercise.id} has an unapproved warning area: ${area}`);
    });
  });
});

test("health data consent is versioned and does not disturb the rest of the profile", () => {
  const profile = { weight: "72" };
  assert.equal(hasHealthDataConsent(profile), false);

  const consented = withHealthDataConsent(profile, "2026-08-19T00:00:00.000Z");
  assert.deepEqual(consented, {
    weight: "72",
    healthDataConsent: { version: 1, agreedAt: "2026-08-19T00:00:00.000Z" }
  });
  assert.equal(hasHealthDataConsent(consented), true);
  assert.deepEqual(profile, { weight: "72" });
});

test("withdrawing consent clears injuryAreas and the consent record but keeps other fields", () => {
  const profile = {
    weight: "72",
    injuryAreas: ["shoulder"],
    healthDataConsent: { version: 1, agreedAt: "2026-08-01T00:00:00.000Z" }
  };
  const next = withdrawHealthDataConsent(profile);

  assert.deepEqual(next, { weight: "72", injuryAreas: [] });
  assert.equal(hasHealthDataConsent(next), false);
  assert.deepEqual(profile.injuryAreas, ["shoulder"]);
});

test("clearCheckinPainAreas empties painAreas but preserves the recovery score inputs", () => {
  const checkins = [{ dateKey: "2026-08-13", sleep: 4, energy: 4, soreness: 2, painAreas: ["knee"] }];
  const cleared = clearCheckinPainAreas(checkins);

  assert.deepEqual(cleared, [{ dateKey: "2026-08-13", sleep: 4, energy: 4, soreness: 2, painAreas: [] }]);
  assert.deepEqual(checkins[0].painAreas, ["knee"]);
});
