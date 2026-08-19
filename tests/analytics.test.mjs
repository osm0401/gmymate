import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getExerciseProgress,
  getExerciseProgressPoints,
  getWorkoutStreaks,
  summarizeWorkoutHistory
} from "../src/core/analytics.js";

const completedSet = (weight, reps, done = true) => ({ weight, reps, done });
const workout = (exerciseId, name, sets) => ({ exerciseId, name, sets });
const session = (dateKey, volume, workouts = []) => ({ dateKey, volume, workouts });

test("summarizeWorkoutHistory returns an immutable seven-day zero state for malformed input", () => {
  const summary = summarizeWorkoutHistory([
    null,
    "bad",
    { dateKey: null, finishedAt: null, volume: 999 },
    { dateKey: 0, finishedAt: false, volume: 999 },
    { dateKey: "2026-02-30", volume: 500 },
    { finishedAt: "not-a-date", volume: 200 }
  ], "2026-08-14");

  assert.equal(summary.totalVolume, 0);
  assert.equal(summary.totalSessions, 0);
  assert.equal(summary.currentStreak, 0);
  assert.equal(summary.bestStreak, 0);
  assert.deepEqual(summary.last7Days, {
    volume: 0,
    sessions: 0,
    days: [
      { dateKey: "2026-08-08", volume: 0, sessions: 0 },
      { dateKey: "2026-08-09", volume: 0, sessions: 0 },
      { dateKey: "2026-08-10", volume: 0, sessions: 0 },
      { dateKey: "2026-08-11", volume: 0, sessions: 0 },
      { dateKey: "2026-08-12", volume: 0, sessions: 0 },
      { dateKey: "2026-08-13", volume: 0, sessions: 0 },
      { dateKey: "2026-08-14", volume: 0, sessions: 0 }
    ]
  });
  assert.ok(Object.isFrozen(summary));
  assert.ok(Object.isFrozen(summary.last7Days.days));
});

test("summarizeWorkoutHistory counts sessions and volume inside the inclusive last-seven-day window", () => {
  const history = [
    session("2026-08-14", 100),
    session("2026-08-14", 50),
    session("2026-08-08", 200),
    session("2026-08-07", 300)
  ];

  const summary = summarizeWorkoutHistory(history, "2026-08-14");

  assert.equal(summary.last7Days.volume, 350);
  assert.equal(summary.last7Days.sessions, 3);
  assert.deepEqual(summary.last7Days.days.at(-1), { dateKey: "2026-08-14", volume: 150, sessions: 2 });
  assert.equal(summary.totalVolume, 650);
  assert.equal(summary.totalSessions, 4);
});

test("analytics derives missing volume from completed valid sets and never mutates frozen history", () => {
  const history = [{
    dateKey: "2026-08-12",
    volume: "not-a-number",
    workouts: [workout("squat", "스쿼트", [
      completedSet(20, 10),
      completedSet(-10, 5),
      completedSet(5, "bad"),
      completedSet(100, 2, false)
    ])]
  }, session("2026-08-13", "125.5")];
  const frozenHistory = structuredClone(history);
  Object.freeze(history);
  Object.freeze(history[0]);
  Object.freeze(history[0].workouts);
  Object.freeze(history[0].workouts[0]);
  Object.freeze(history[0].workouts[0].sets);

  const summary = summarizeWorkoutHistory(history, "2026-08-14");

  assert.equal(summary.totalVolume, 325.5);
  assert.deepEqual(history, frozenHistory);
});

test("getWorkoutStreaks uses unique dates, reports the best run, and keeps yesterday's run current", () => {
  const history = [
    session("2026-08-07", 1),
    session("2026-08-08", 1),
    session("2026-08-10", 1),
    session("2026-08-11", 1),
    session("2026-08-12", 1),
    session("2026-08-12", 1)
  ];

  assert.deepEqual(getWorkoutStreaks(history, "2026-08-13"), { currentStreak: 3, bestStreak: 3 });
  assert.deepEqual(getWorkoutStreaks(history, "2026-08-14"), { currentStreak: 0, bestStreak: 3 });
  assert.deepEqual(getWorkoutStreaks(history, "2026-08-12"), { currentStreak: 3, bestStreak: 3 });
});

test("getExerciseProgress creates chronological points from completed sets", () => {
  const history = [
    session("2026-08-12", 430, [
      workout("squat", "스쿼트", [completedSet(50, 5), completedSet(60, 3), completedSet(70, 2, false)]),
      workout("cycle", "사이클", [completedSet(0, 20)])
    ]),
    session("2026-08-10", 545, [
      workout("squat", "스쿼트", [completedSet(40, 8), completedSet(45, 5)]),
      workout("", "잘못된 운동", [completedSet(10, 10)]),
      { exerciseId: "broken", name: "깨진 운동", sets: "bad" }
    ])
  ];

  const progress = getExerciseProgress(history);

  assert.deepEqual(progress, [
    {
      exerciseId: "cycle",
      name: "사이클",
      points: [{ dateKey: "2026-08-12", volume: 0, bestWeight: 0, bestReps: 20 }]
    },
    {
      exerciseId: "squat",
      name: "스쿼트",
      points: [
        { dateKey: "2026-08-10", volume: 545, bestWeight: 45, bestReps: 5 },
        { dateKey: "2026-08-12", volume: 430, bestWeight: 60, bestReps: 3 }
      ]
    }
  ]);
  assert.ok(Object.isFrozen(progress));
  assert.ok(Object.isFrozen(progress[0].points[0]));
  assert.deepEqual(getExerciseProgressPoints(history, "squat"), progress[1].points);
  assert.deepEqual(getExerciseProgressPoints(history, null), []);
});

test("finishedAt is a safe fallback when a session has no dateKey", () => {
  const history = [{ finishedAt: "2026-08-09T12:00:00", volume: 75, workouts: [] }];
  const summary = summarizeWorkoutHistory(history, "2026-08-14");

  assert.equal(summary.totalSessions, 1);
  assert.equal(summary.last7Days.volume, 75);
  assert.equal(summary.last7Days.days[1].dateKey, "2026-08-09");
});
