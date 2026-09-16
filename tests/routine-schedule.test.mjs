import test from "node:test";
import assert from "node:assert/strict";
import {
  ROUTINE_LIMITS,
  WEEKDAY_LABELS,
  buildWeeklySchedule,
  mondayIndex,
  normalizeSchedule
} from "../src/core/routines.js";

const routines = [
  { id: "a", name: "A", exerciseIds: ["squat"] },
  { id: "b", name: "B", exerciseIds: ["chest-press"] },
  { id: "c", name: "C", exerciseIds: ["seated-row"] }
];

test("[A,B,C] rotates Monday-first: 월A 화B 수C 목A 금B 토C 일A", () => {
  const week = buildWeeklySchedule(["a", "b", "c"], routines);
  assert.deepEqual(week.map((day) => day.label), WEEKDAY_LABELS);
  assert.deepEqual(week.map((day) => day.routine.name), ["A", "B", "C", "A", "B", "C", "A"]);
});

test("a single routine fills every day", () => {
  const week = buildWeeklySchedule(["b"], routines);
  assert.ok(week.every((day) => day.routine.id === "b"));
});

test("an empty schedule leaves every day without a routine", () => {
  const week = buildWeeklySchedule([], routines);
  assert.equal(week.length, 7);
  assert.ok(week.every((day) => day.routine === null));
});

test("normalizeSchedule drops deleted routines and non-strings but keeps order and repeats", () => {
  assert.deepEqual(normalizeSchedule(["c", "gone", 3, null, "a", "c"], routines), ["c", "a", "c"]);
  assert.deepEqual(normalizeSchedule("not-an-array", routines), []);
});

test("normalizeSchedule caps at seven entries because a week has only seven days", () => {
  const long = ["a", "b", "c", "a", "b", "c", "a", "b", "c"];
  assert.equal(normalizeSchedule(long, routines).length, ROUTINE_LIMITS.maxScheduleEntries);
  assert.equal(ROUTINE_LIMITS.maxScheduleEntries, 7);
});

test("buildWeeklySchedule ignores ids whose routine was deleted", () => {
  const week = buildWeeklySchedule(["a", "gone", "b"], routines);
  assert.deepEqual(week.map((day) => day.routine.name), ["A", "B", "A", "B", "A", "B", "A"]);
});

test("mondayIndex maps Monday to 0 and Sunday to 6 in local time", () => {
  assert.equal(mondayIndex(new Date(2026, 8, 14)), 0); // 2026-09-14 월
  assert.equal(mondayIndex(new Date(2026, 8, 16)), 2); // 수
  assert.equal(mondayIndex(new Date(2026, 8, 20)), 6); // 일
});
