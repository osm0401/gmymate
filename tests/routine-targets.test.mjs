import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTINE_LIMITS,
  createRoutine,
  normalizeRoutineTarget,
  normalizeStoredRoutines
} from "../src/core/routines.js";

const catalog = [
  { id: "squat", name: "스쿼트", category: "하체", weight: 40, reps: 8, sets: 4 },
  { id: "cycle", name: "사이클", category: "유산소", weight: 0, reps: 20, sets: 1 }
];

test("a valid target is kept, weight rounded to one decimal", () => {
  assert.deepEqual(
    normalizeRoutineTarget({ sets: 5, weight: 62.54, reps: 6 }, catalog[0]),
    { sets: 5, weight: 62.5, reps: 6 }
  );
});

test("numeric strings from form inputs are accepted", () => {
  assert.deepEqual(
    normalizeRoutineTarget({ sets: "3", weight: "47.5", reps: "10" }, catalog[0]),
    { sets: 3, weight: 47.5, reps: 10 }
  );
});

test("each invalid field falls back to that exercise's default on its own", () => {
  assert.deepEqual(
    normalizeRoutineTarget({ sets: 0, weight: -5, reps: "abc" }, catalog[0]),
    { sets: 4, weight: 40, reps: 8 }
  );
  assert.deepEqual(normalizeRoutineTarget(null, catalog[0]), { sets: 4, weight: 40, reps: 8 });
});

test("values beyond the limits are rejected, not silently clamped", () => {
  const { maxSets, maxWeight, maxReps } = ROUTINE_LIMITS.target;
  assert.deepEqual(
    normalizeRoutineTarget({ sets: maxSets + 1, weight: maxWeight + 1, reps: maxReps + 1 }, catalog[0]),
    { sets: 4, weight: 40, reps: 8 }
  );
  assert.deepEqual(
    normalizeRoutineTarget({ sets: maxSets, weight: maxWeight, reps: maxReps }, catalog[0]),
    { sets: maxSets, weight: maxWeight, reps: maxReps }
  );
});

test("zero weight is valid (bodyweight or cardio)", () => {
  assert.deepEqual(normalizeRoutineTarget({ sets: 1, weight: 0, reps: 20 }, catalog[1]), { sets: 1, weight: 0, reps: 20 });
});

test("createRoutine stores a target for every kept exercise", () => {
  const result = createRoutine({
    name: "하체",
    exerciseIds: ["squat", "unknown", "cycle"],
    targets: { squat: { sets: 5, weight: 60, reps: 5 }, unknown: { sets: 9, weight: 9, reps: 9 } },
    exerciseCatalog: catalog,
    idFactory: () => "r1"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.routine, {
    id: "r1",
    name: "하체",
    exerciseIds: ["squat", "cycle"],
    targets: {
      squat: { sets: 5, weight: 60, reps: 5 },
      cycle: { sets: 1, weight: 0, reps: 20 }
    }
  });
});

test("createRoutine without targets keeps the old shape (start falls back to last record)", () => {
  const result = createRoutine({ name: "옛날", exerciseIds: ["squat"], exerciseCatalog: catalog, idFactory: () => "r2" });
  assert.deepEqual(result.routine, { id: "r2", name: "옛날", exerciseIds: ["squat"] });
});

test("stored routines keep valid targets and drop ones for exercises no longer in the routine", () => {
  const [routine] = normalizeStoredRoutines([{
    id: "r3",
    name: "저장본",
    exerciseIds: ["squat"],
    targets: {
      squat: { sets: 3, weight: 70, reps: 3 },
      cycle: { sets: 1, weight: 0, reps: 30 },
      __proto__: { sets: 1, weight: 1, reps: 1 }
    }
  }], catalog);

  assert.deepEqual(routine.targets, { squat: { sets: 3, weight: 70, reps: 3 } });
  assert.equal(Object.getPrototypeOf(routine.targets), Object.prototype);
});

test("stored routines without targets or with a non-object targets value stay target-less", () => {
  const routines = normalizeStoredRoutines([
    { id: "a", name: "A", exerciseIds: ["squat"] },
    { id: "b", name: "B", exerciseIds: ["squat"], targets: "garbage" }
  ], catalog);

  assert.equal("targets" in routines[0], false);
  assert.equal("targets" in routines[1], false);
});
