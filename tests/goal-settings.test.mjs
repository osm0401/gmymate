import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_TYPES,
  WEEKLY_WORKOUT_OPTIONS,
  TARGET_WEIGHT_MAX,
  TARGET_WEIGHT_MIN,
  mergeGoalIntoProfile,
  normalizeGoalSettings
} from "../src/core/goals.js";

test("normalizeGoalSettings accepts a valid goal/targetWeight/weeklyWorkout combination", () => {
  const result = normalizeGoalSettings({ goal: "fat-loss", targetWeight: "68.5", weeklyWorkout: "3" });
  assert.deepEqual(result, {
    ok: true,
    values: { goal: "fat-loss", targetWeight: "68.5", weeklyWorkout: "3" }
  });
});

test("normalizeGoalSettings normalizes a numeric targetWeight to the string profile format", () => {
  const result = normalizeGoalSettings({ goal: "strength", targetWeight: 72, weeklyWorkout: "4" });
  assert.equal(result.ok, true);
  assert.equal(result.values.targetWeight, "72");
});

test("normalizeGoalSettings accepts every documented goal type and weekly workout option", () => {
  GOAL_TYPES.forEach((goal) => {
    WEEKLY_WORKOUT_OPTIONS.forEach((weeklyWorkout) => {
      const result = normalizeGoalSettings({ goal, targetWeight: "60", weeklyWorkout });
      assert.equal(result.ok, true, `${goal}/${weeklyWorkout} should be accepted`);
    });
  });
});

test("normalizeGoalSettings rejects a goal type outside the allowed enum", () => {
  const result = normalizeGoalSettings({ goal: "get-shredded", targetWeight: "68", weeklyWorkout: "3" });
  assert.deepEqual(result, { ok: false, field: "goal", reason: "invalid-goal" });
});

test("normalizeGoalSettings rejects a targetWeight just below the minimum", () => {
  const result = normalizeGoalSettings({ goal: "habit", targetWeight: "29.9", weeklyWorkout: "2" });
  assert.deepEqual(result, { ok: false, field: "targetWeight", reason: "invalid-target-weight" });
});

test("normalizeGoalSettings rejects a targetWeight just above the maximum", () => {
  const result = normalizeGoalSettings({ goal: "habit", targetWeight: "250.1", weeklyWorkout: "2" });
  assert.deepEqual(result, { ok: false, field: "targetWeight", reason: "invalid-target-weight" });
});

test("normalizeGoalSettings rejects a targetWeight with two decimal places", () => {
  const result = normalizeGoalSettings({ goal: "habit", targetWeight: "68.55", weeklyWorkout: "2" });
  assert.deepEqual(result, { ok: false, field: "targetWeight", reason: "invalid-target-weight" });
});

test("normalizeGoalSettings rejects a non-numeric targetWeight", () => {
  const result = normalizeGoalSettings({ goal: "habit", targetWeight: "seventy", weeklyWorkout: "2" });
  assert.deepEqual(result, { ok: false, field: "targetWeight", reason: "invalid-target-weight" });
});

test("normalizeGoalSettings rejects a missing targetWeight (neither string nor number)", () => {
  assert.deepEqual(
    normalizeGoalSettings({ goal: "habit", targetWeight: null, weeklyWorkout: "2" }),
    { ok: false, field: "targetWeight", reason: "invalid-target-weight" }
  );
  assert.deepEqual(
    normalizeGoalSettings({ goal: "habit", targetWeight: undefined, weeklyWorkout: "2" }),
    { ok: false, field: "targetWeight", reason: "invalid-target-weight" }
  );
});

test("normalizeGoalSettings accepts targetWeight at the exact boundaries", () => {
  assert.equal(normalizeGoalSettings({ goal: "habit", targetWeight: String(TARGET_WEIGHT_MIN), weeklyWorkout: "2" }).ok, true);
  assert.equal(normalizeGoalSettings({ goal: "habit", targetWeight: String(TARGET_WEIGHT_MAX), weeklyWorkout: "2" }).ok, true);
});

test("normalizeGoalSettings rejects weekly workout counts of 1 and 6", () => {
  assert.deepEqual(
    normalizeGoalSettings({ goal: "habit", targetWeight: "68", weeklyWorkout: "1" }),
    { ok: false, field: "weeklyWorkout", reason: "invalid-weekly-workout" }
  );
  assert.deepEqual(
    normalizeGoalSettings({ goal: "habit", targetWeight: "68", weeklyWorkout: "6" }),
    { ok: false, field: "weeklyWorkout", reason: "invalid-weekly-workout" }
  );
});

test("normalizeGoalSettings checks goal before targetWeight before weeklyWorkout so the first invalid field wins", () => {
  const result = normalizeGoalSettings({ goal: "not-real", targetWeight: "999", weeklyWorkout: "9" });
  assert.equal(result.field, "goal");
});

test("mergeGoalIntoProfile merges only the goal fields and preserves everything else", () => {
  const profile = {
    height: "175",
    age: "28",
    weight: "80",
    experience: "under-2-years",
    goal: "habit",
    targetWeight: "75",
    weeklyWorkout: "2",
    username: "gains_person"
  };

  const nextProfile = mergeGoalIntoProfile(profile, { goal: "muscle-gain", targetWeight: "78.5", weeklyWorkout: "4" });

  assert.deepEqual(nextProfile, {
    height: "175",
    age: "28",
    weight: "80",
    experience: "under-2-years",
    goal: "muscle-gain",
    targetWeight: "78.5",
    weeklyWorkout: "4",
    username: "gains_person"
  });
});

test("mergeGoalIntoProfile does not mutate the original profile object", () => {
  const profile = { goal: "habit", targetWeight: "70", weeklyWorkout: "2", height: "170" };
  const frozen = { ...profile };

  mergeGoalIntoProfile(profile, { goal: "strength", targetWeight: "80", weeklyWorkout: "5" });

  assert.deepEqual(profile, frozen);
});
