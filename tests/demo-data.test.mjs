import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseCatalog } from "../src/core/data.js";

let moduleStorageReads = 0;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  get() {
    moduleStorageReads += 1;
    throw new Error("localStorage must not be accessed during import");
  }
});
const { DEMO_USER, createDemoSnapshot } = await import("../src/core/demo.js");
delete globalThis.localStorage;

const STORAGE_KEYS = [
  "gmymateProfile",
  "gmymateSettings",
  "gmymateHabits",
  "gmymateWorkoutLogsV2",
  "gmymateWorkoutHistory",
  "gmymateInBodyLogs",
  "gmymateCustomRoutines",
  "gmymateRecoveryCheckins"
];

function completedVolume(workouts) {
  return workouts.flatMap((workout) => workout.sets)
    .filter((set) => set.done)
    .reduce((total, set) => total + set.weight * set.reps, 0);
}

function isDeepFrozen(value) {
  return value === null || typeof value !== "object"
    || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));
}

test("DEMO_USER is a minimal immutable authenticated user", () => {
  assert.deepEqual(DEMO_USER, { username: "demo" });
  assert.ok(Object.isFrozen(DEMO_USER));
});

test("createDemoSnapshot uses exactly the app storage keys requested", () => {
  const snapshot = createDemoSnapshot("2026-08-14");

  assert.deepEqual(Object.keys(snapshot).sort(), [...STORAGE_KEYS].sort());
  assert.equal(snapshot.gmymateProfile.username, DEMO_USER.username);
  assert.equal("password" in snapshot.gmymateProfile, false);
});

test("createDemoSnapshot is deterministic, returns fresh data, and does not mutate its Date input", () => {
  const referenceDate = new Date(2026, 7, 14, 9, 30);
  const originalTime = referenceDate.getTime();
  const first = createDemoSnapshot(referenceDate);
  const second = createDemoSnapshot(referenceDate);

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(referenceDate.getTime(), originalTime);
  assert.ok(isDeepFrozen(first));
});

test("invalid reference dates use one deterministic fallback snapshot", () => {
  assert.deepEqual(createDemoSnapshot(null), createDemoSnapshot("not-a-date"));
  assert.deepEqual(createDemoSnapshot("2026-02-30"), createDemoSnapshot("not-a-date"));
});

test("demo history and body-composition dates move with the reference date", () => {
  const august = createDemoSnapshot("2026-08-14");
  const september = createDemoSnapshot("2026-09-14");

  assert.deepEqual(
    august.gmymateWorkoutHistory.map((entry) => entry.dateKey),
    ["2026-08-13", "2026-08-12", "2026-08-10", "2026-08-08", "2026-08-05", "2026-08-02", "2026-07-29"]
  );
  assert.equal(september.gmymateWorkoutHistory[0].dateKey, "2026-09-13");
  assert.equal(august.gmymateInBodyLogs.at(-1).date, "2026-08-14");
  assert.equal(september.gmymateInBodyLogs.at(-1).date, "2026-09-14");
});

test("demo workouts and routines use real exercise ids and internally consistent session totals", () => {
  const snapshot = createDemoSnapshot("2026-08-14");
  const catalogIds = new Set(exerciseCatalog.map((exercise) => exercise.id));
  const allWorkouts = [
    ...snapshot.gmymateWorkoutLogsV2,
    ...snapshot.gmymateWorkoutHistory.flatMap((entry) => entry.workouts)
  ];

  assert.ok(allWorkouts.length > 0);
  assert.ok(allWorkouts.every((entry) => catalogIds.has(entry.exerciseId)));
  assert.ok(snapshot.gmymateCustomRoutines.every((routine) => routine.exerciseIds.every((id) => catalogIds.has(id))));
  snapshot.gmymateWorkoutHistory.forEach((entry) => {
    assert.equal(entry.volume, completedVolume(entry.workouts));
    assert.equal(entry.doneSets, entry.workouts.flatMap((item) => item.sets).filter((set) => set.done).length);
  });
});

test("demo profile, settings, habits, inbody, and today workout contain realistic app-shaped data", () => {
  const snapshot = createDemoSnapshot("2026-08-14");

  assert.match(snapshot.gmymateProfile.username, /^[a-zA-Z0-9_]{3,20}$/);
  assert.ok(["fat-loss", "muscle-gain", "strength", "habit"].includes(snapshot.gmymateProfile.goal));
  assert.ok(["2", "3", "4", "5"].includes(snapshot.gmymateProfile.weeklyWorkout));
  assert.match(snapshot.gmymateSettings.workoutAlertTime, /^([01]\d|2[0-3]):[0-5]\d$/);
  assert.deepEqual(Object.keys(snapshot.gmymateHabits).sort(), ["protein", "stretch", "water"]);
  assert.ok(snapshot.gmymateWorkoutLogsV2.some((entry) => entry.sets.some((set) => set.done)));
  assert.ok(snapshot.gmymateWorkoutLogsV2.some((entry) => entry.sets.some((set) => !set.done)));
  assert.ok(snapshot.gmymateInBodyLogs.length >= 3);
});

test("demo module and snapshot creation never touch DOM or localStorage", () => {
  let storageReads = 0;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      storageReads += 1;
      throw new Error("localStorage must not be accessed");
    }
  });

  try {
    assert.equal(moduleStorageReads, 0);
    assert.doesNotThrow(() => createDemoSnapshot("2026-08-14"));
    assert.equal(storageReads, 0);
  } finally {
    delete globalThis.localStorage;
  }
});
