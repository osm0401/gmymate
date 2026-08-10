import { getDateKey } from "./storage.js";

export const DAYS_IN_WEEK = [0, 1, 2, 3, 4, 5, 6];
export const DEFAULT_ALERT_TIME = "18:00";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidAlertTime(value) {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function normalizeAlertDays(rawDays) {
  if (!Array.isArray(rawDays)) {
    return null;
  }

  const valid = rawDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const unique = [...new Set(valid)].sort((a, b) => a - b);

  return unique.length > 0 ? unique : null;
}

export function normalizeReminderSettings(rawSettings = {}) {
  return {
    workoutAlert: Boolean(rawSettings?.workoutAlert),
    workoutAlertTime: isValidAlertTime(rawSettings?.workoutAlertTime) ? rawSettings.workoutAlertTime : DEFAULT_ALERT_TIME,
    workoutAlertDays: normalizeAlertDays(rawSettings?.workoutAlertDays) || [...DAYS_IN_WEEK]
  };
}

export function getWeekDateKeys(referenceDate) {
  const sunday = new Date(referenceDate);
  sunday.setDate(referenceDate.getDate() - referenceDate.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return getDateKey(date);
  });
}

export function countCompletedDaysThisWeek(completedDateKeys, referenceDate) {
  return getWeekDateKeys(referenceDate).filter((key) => completedDateKeys.has(key)).length;
}

export function hasCompletedWorkoutToday({ completedDateKeys, todayWorkouts = [] }, referenceDate) {
  if (completedDateKeys.has(getDateKey(referenceDate))) {
    return true;
  }

  return todayWorkouts.some((workout) => (workout.sets || []).some((set) => set.done));
}

function formatClockTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function shouldShowWorkoutReminder(
  { settings, completedDateKeys, todayWorkouts = [], weeklyTarget = 0, lastShownDateKey = null },
  referenceDate = new Date()
) {
  const normalized = normalizeReminderSettings(settings);

  if (!normalized.workoutAlert) {
    return false;
  }

  if (lastShownDateKey === getDateKey(referenceDate)) {
    return false;
  }

  if (!normalized.workoutAlertDays.includes(referenceDate.getDay())) {
    return false;
  }

  if (formatClockTime(referenceDate) < normalized.workoutAlertTime) {
    return false;
  }

  if (hasCompletedWorkoutToday({ completedDateKeys, todayWorkouts }, referenceDate)) {
    return false;
  }

  if (weeklyTarget > 0 && countCompletedDaysThisWeek(completedDateKeys, referenceDate) >= weeklyTarget) {
    return false;
  }

  return true;
}
