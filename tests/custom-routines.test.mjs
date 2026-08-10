import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUTINE_LIMITS,
  createRoutine,
  dedupeExerciseIds,
  normalizeStoredRoutines,
  planRoutineStart,
  resolveExerciseNames,
  sanitizeRoutineName
} from "../src/core/routines.js";

const exerciseCatalog = Array.from({ length: 15 }, (_, index) => ({
  id: `ex-${index + 1}`,
  name: `운동 ${index + 1}`
}));

let idCounter = 0;
const idFactory = () => `test-id-${idCounter++}`;

test("sanitizeRoutineName trims strings and rejects non-strings", () => {
  assert.equal(sanitizeRoutineName("  등 집중  "), "등 집중");
  assert.equal(sanitizeRoutineName(null), "");
  assert.equal(sanitizeRoutineName(42), "");
});

test("dedupeExerciseIds keeps first occurrence, drops unknown/invalid ids, preserves order", () => {
  const result = dedupeExerciseIds(["ex-2", "ex-1", "ex-2", "unknown", null, "ex-3"], exerciseCatalog);
  assert.deepEqual(result, ["ex-2", "ex-1", "ex-3"]);
});

test("dedupeExerciseIds returns empty array for non-array input", () => {
  assert.deepEqual(dedupeExerciseIds(undefined, exerciseCatalog), []);
});

test("createRoutine accepts a valid name and exercise list, preserving order", () => {
  const result = createRoutine({
    name: "  등 집중  ",
    exerciseIds: ["ex-3", "ex-1"],
    existingRoutines: [],
    exerciseCatalog,
    idFactory
  });

  assert.equal(result.ok, true);
  assert.equal(result.routine.name, "등 집중");
  assert.deepEqual(result.routine.exerciseIds, ["ex-3", "ex-1"]);
  assert.ok(result.routine.id);
});

test("createRoutine rejects an empty (whitespace-only) name", () => {
  const result = createRoutine({ name: "   ", exerciseIds: ["ex-1"], exerciseCatalog, idFactory });
  assert.deepEqual(result, { ok: false, reason: "invalid-name" });
});

test("createRoutine generates an id via the default id factory when none is provided", () => {
  const result = createRoutine({ name: "기본 아이디", exerciseIds: ["ex-1"], exerciseCatalog });
  assert.equal(result.ok, true);
  assert.match(result.routine.id, /^routine-\d+-[0-9a-f]+$/);
});

test("createRoutine rejects a name over 40 characters", () => {
  const result = createRoutine({ name: "a".repeat(41), exerciseIds: ["ex-1"], exerciseCatalog, idFactory });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-name");
});

test("createRoutine accepts a name at exactly 40 characters", () => {
  const result = createRoutine({ name: "a".repeat(40), exerciseIds: ["ex-1"], exerciseCatalog, idFactory });
  assert.equal(result.ok, true);
});

test("createRoutine rejects when today's workout list is empty", () => {
  const result = createRoutine({ name: "등 집중", exerciseIds: [], exerciseCatalog, idFactory });
  assert.deepEqual(result, { ok: false, reason: "no-exercises" });
});

test("createRoutine rejects when every exercise id is missing from the catalog", () => {
  const result = createRoutine({ name: "등 집중", exerciseIds: ["ghost-1", "ghost-2"], exerciseCatalog, idFactory });
  assert.deepEqual(result, { ok: false, reason: "no-exercises" });
});

test("createRoutine caps exercises at 12 and drops the rest", () => {
  const ids = exerciseCatalog.map((exercise) => exercise.id); // 15 ids
  const result = createRoutine({ name: "전신", exerciseIds: ids, exerciseCatalog, idFactory });
  assert.equal(result.ok, true);
  assert.equal(result.routine.exerciseIds.length, ROUTINE_LIMITS.maxExercises);
  assert.deepEqual(result.routine.exerciseIds, ids.slice(0, 12));
});

test("createRoutine allows duplicate routine names", () => {
  const existing = [{ id: "r1", name: "등 집중", exerciseIds: ["ex-1"] }];
  const result = createRoutine({ name: "등 집중", exerciseIds: ["ex-2"], existingRoutines: existing, exerciseCatalog, idFactory });
  assert.equal(result.ok, true);
});

test("createRoutine rejects the 31st routine with a limit-reached reason", () => {
  const existing = Array.from({ length: 30 }, (_, index) => ({ id: `r${index}`, name: `루틴 ${index}`, exerciseIds: ["ex-1"] }));
  const result = createRoutine({ name: "새 루틴", exerciseIds: ["ex-1"], existingRoutines: existing, exerciseCatalog, idFactory });
  assert.deepEqual(result, { ok: false, reason: "limit-reached" });
});

test("normalizeStoredRoutines drops corrupted entries but keeps valid ones", () => {
  const raw = [
    { id: "r1", name: "등 집중", exerciseIds: ["ex-1", "ex-2"] },
    null,
    "not-an-object",
    { id: "r2", name: "", exerciseIds: ["ex-1"] },
    { id: "r3", name: "b".repeat(41), exerciseIds: ["ex-1"] },
    { id: "", name: "이름은 있지만 id 없음", exerciseIds: ["ex-1"] },
    { id: "r4", name: "삭제된 운동만", exerciseIds: ["ghost"] },
    { id: "r5", name: "일부 삭제된 운동", exerciseIds: ["ghost", "ex-4", "ex-4"] }
  ];

  const result = normalizeStoredRoutines(raw, exerciseCatalog);
  assert.deepEqual(result, [
    { id: "r1", name: "등 집중", exerciseIds: ["ex-1", "ex-2"] },
    { id: "r5", name: "일부 삭제된 운동", exerciseIds: ["ex-4"] }
  ]);
});

test("normalizeStoredRoutines returns an empty array for non-array input", () => {
  assert.deepEqual(normalizeStoredRoutines(null, exerciseCatalog), []);
  assert.deepEqual(normalizeStoredRoutines("garbage", exerciseCatalog), []);
});

test("normalizeStoredRoutines caps the result at 30 routines", () => {
  const raw = Array.from({ length: 40 }, (_, index) => ({ id: `r${index}`, name: `루틴 ${index}`, exerciseIds: ["ex-1"] }));
  const result = normalizeStoredRoutines(raw, exerciseCatalog);
  assert.equal(result.length, ROUTINE_LIMITS.maxRoutines);
});

test("resolveExerciseNames recomputes names from the catalog and skips deleted ids", () => {
  const names = resolveExerciseNames(["ex-2", "ghost", "ex-1"], exerciseCatalog);
  assert.deepEqual(names, ["운동 2", "운동 1"]);
});

test("planRoutineStart keeps existing workouts and appends only new, valid, in-order exercises", () => {
  const result = planRoutineStart({
    existingExerciseIds: ["ex-1"],
    routineExerciseIds: ["ex-1", "ex-2", "ghost", "ex-3"],
    exerciseCatalog
  });

  assert.deepEqual(result, { toAdd: ["ex-2", "ex-3"], skippedCount: 0 });
});

test("planRoutineStart truncates to the remaining slots and reports the skipped count", () => {
  const existingExerciseIds = Array.from({ length: 10 }, (_, index) => `ex-${index + 1}`); // 10 used, 2 slots left
  const result = planRoutineStart({
    existingExerciseIds,
    routineExerciseIds: ["ex-11", "ex-12", "ex-13"],
    exerciseCatalog
  });

  assert.deepEqual(result.toAdd, ["ex-11", "ex-12"]);
  assert.equal(result.skippedCount, 1);
});

test("planRoutineStart returns no candidates once today's log is already full", () => {
  const existingExerciseIds = Array.from({ length: 12 }, (_, index) => `ex-${index + 1}`);
  const result = planRoutineStart({
    existingExerciseIds,
    routineExerciseIds: ["ex-13"],
    exerciseCatalog
  });

  assert.deepEqual(result, { toAdd: [], skippedCount: 1 });
});
