import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAYS_IN_WEEK,
  DEFAULT_ALERT_TIME,
  countCompletedDaysThisWeek,
  getWeekDateKeys,
  hasCompletedWorkoutToday,
  isValidAlertTime,
  normalizeAlertDays,
  normalizeReminderSettings,
  shouldShowWorkoutReminder
} from "../src/core/reminders.js";

// 2026-08-09 is a Sunday, so the calendar week under test runs 2026-08-09 (Sun) .. 2026-08-15 (Sat),
// with 2026-08-10 (Mon) used as "today" in most scenarios below.
const MONDAY_BEFORE_ALERT = new Date(2026, 7, 10, 17, 59);
const MONDAY_AT_ALERT = new Date(2026, 7, 10, 18, 0);
const MONDAY_AFTER_ALERT = new Date(2026, 7, 10, 20, 30);
const SUNDAY = new Date(2026, 7, 9, 18, 0);

test("isValidAlertTime accepts zero-padded HH:mm within range and rejects everything else", () => {
  assert.equal(isValidAlertTime("00:00"), true);
  assert.equal(isValidAlertTime("23:59"), true);
  assert.equal(isValidAlertTime("18:00"), true);
  assert.equal(isValidAlertTime("24:00"), false);
  assert.equal(isValidAlertTime("9:00"), false);
  assert.equal(isValidAlertTime("18:0"), false);
  assert.equal(isValidAlertTime(""), false);
  assert.equal(isValidAlertTime(null), false);
  assert.equal(isValidAlertTime(1800), false);
});

test("normalizeAlertDays dedupes, sorts, and drops invalid entries", () => {
  assert.deepEqual(normalizeAlertDays([3, 1, 1, 5]), [1, 3, 5]);
  assert.deepEqual(normalizeAlertDays([6, "2", -1, 7, 0, 2.5]), [0, 6]);
});

test("normalizeAlertDays returns null for non-arrays or arrays with no valid days", () => {
  assert.equal(normalizeAlertDays(undefined), null);
  assert.equal(normalizeAlertDays("everyday"), null);
  assert.equal(normalizeAlertDays([7, -1, "x"]), null);
});

test("normalizeReminderSettings fills in defaults for legacy workoutAlert:true data", () => {
  assert.deepEqual(normalizeReminderSettings({ workoutAlert: true }), {
    workoutAlert: true,
    workoutAlertTime: DEFAULT_ALERT_TIME,
    workoutAlertDays: [...DAYS_IN_WEEK]
  });
});

test("normalizeReminderSettings keeps valid explicit time/days and ignores invalid ones", () => {
  assert.deepEqual(
    normalizeReminderSettings({ workoutAlert: true, workoutAlertTime: "07:30", workoutAlertDays: [1, 3, 5] }),
    { workoutAlert: true, workoutAlertTime: "07:30", workoutAlertDays: [1, 3, 5] }
  );
  assert.deepEqual(
    normalizeReminderSettings({ workoutAlert: false, workoutAlertTime: "bogus", workoutAlertDays: "bogus" }),
    { workoutAlert: false, workoutAlertTime: DEFAULT_ALERT_TIME, workoutAlertDays: [...DAYS_IN_WEEK] }
  );
});

test("normalizeReminderSettings handles a completely empty settings object", () => {
  assert.deepEqual(normalizeReminderSettings({}), {
    workoutAlert: false,
    workoutAlertTime: DEFAULT_ALERT_TIME,
    workoutAlertDays: [...DAYS_IN_WEEK]
  });
});

test("normalizeReminderSettings defaults to an empty object when called with no arguments", () => {
  assert.deepEqual(normalizeReminderSettings(), {
    workoutAlert: false,
    workoutAlertTime: DEFAULT_ALERT_TIME,
    workoutAlertDays: [...DAYS_IN_WEEK]
  });
});

test("getWeekDateKeys returns the Sunday-Saturday week containing the reference date", () => {
  assert.deepEqual(getWeekDateKeys(MONDAY_AT_ALERT), [
    "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"
  ]);
});

test("countCompletedDaysThisWeek only counts keys that fall inside the current week", () => {
  const completed = new Set(["2026-08-08", "2026-08-09", "2026-08-11", "2026-09-01"]);
  assert.equal(countCompletedDaysThisWeek(completed, MONDAY_AT_ALERT), 2);
});

test("hasCompletedWorkoutToday is true when today's dateKey is in the completed set", () => {
  const completed = new Set(["2026-08-10"]);
  assert.equal(hasCompletedWorkoutToday({ completedDateKeys: completed, todayWorkouts: [] }, MONDAY_AT_ALERT), true);
});

test("hasCompletedWorkoutToday is true when an in-progress workout already has a done set", () => {
  const todayWorkouts = [{ exerciseId: "squat", sets: [{ done: false }, { done: true }] }];
  assert.equal(hasCompletedWorkoutToday({ completedDateKeys: new Set(), todayWorkouts }, MONDAY_AT_ALERT), true);
});

test("hasCompletedWorkoutToday is false with no history entry and no done sets", () => {
  const todayWorkouts = [{ exerciseId: "squat", sets: [{ done: false }] }];
  assert.equal(hasCompletedWorkoutToday({ completedDateKeys: new Set(), todayWorkouts }, MONDAY_AT_ALERT), false);
});

function baseArgs(overrides = {}) {
  return {
    settings: { workoutAlert: true, workoutAlertTime: "18:00", workoutAlertDays: [...DAYS_IN_WEEK] },
    completedDateKeys: new Set(),
    todayWorkouts: [],
    weeklyTarget: 0,
    lastShownDateKey: null,
    ...overrides
  };
}

test("shouldShowWorkoutReminder is false when the alert is turned off", () => {
  assert.equal(shouldShowWorkoutReminder(baseArgs({ settings: { workoutAlert: false } }), MONDAY_AT_ALERT), false);
});

test("shouldShowWorkoutReminder is false before the configured time and true once it arrives", () => {
  assert.equal(shouldShowWorkoutReminder(baseArgs(), MONDAY_BEFORE_ALERT), false);
  assert.equal(shouldShowWorkoutReminder(baseArgs(), MONDAY_AT_ALERT), true);
  assert.equal(shouldShowWorkoutReminder(baseArgs(), MONDAY_AFTER_ALERT), true);
});

test("shouldShowWorkoutReminder is false on a day that is not selected", () => {
  const args = baseArgs({ settings: { workoutAlert: true, workoutAlertTime: "18:00", workoutAlertDays: [1, 2, 3, 4, 5] } });
  assert.equal(shouldShowWorkoutReminder(args, SUNDAY), false);
});

test("shouldShowWorkoutReminder is false when today's workout is already done", () => {
  const args = baseArgs({ completedDateKeys: new Set(["2026-08-10"]) });
  assert.equal(shouldShowWorkoutReminder(args, MONDAY_AT_ALERT), false);
});

test("shouldShowWorkoutReminder is false when this week's goal is already met", () => {
  const args = baseArgs({
    completedDateKeys: new Set(["2026-08-09", "2026-08-11"]),
    weeklyTarget: 2
  });
  assert.equal(shouldShowWorkoutReminder(args, MONDAY_AT_ALERT), false);
});

test("shouldShowWorkoutReminder is true when this week's goal is not yet met", () => {
  const args = baseArgs({
    completedDateKeys: new Set(["2026-08-09"]),
    weeklyTarget: 3
  });
  assert.equal(shouldShowWorkoutReminder(args, MONDAY_AT_ALERT), true);
});

test("shouldShowWorkoutReminder defaults the reference date to now when none is given", () => {
  assert.equal(typeof shouldShowWorkoutReminder(baseArgs()), "boolean");
});

test("shouldShowWorkoutReminder is false once already shown today, true again the next day", () => {
  const shownToday = baseArgs({ lastShownDateKey: "2026-08-10" });
  assert.equal(shouldShowWorkoutReminder(shownToday, MONDAY_AT_ALERT), false);

  const shownYesterday = baseArgs({ lastShownDateKey: "2026-08-09" });
  assert.equal(shouldShowWorkoutReminder(shownYesterday, MONDAY_AT_ALERT), true);
});
