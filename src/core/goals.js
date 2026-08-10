export const GOAL_TYPES = ["fat-loss", "muscle-gain", "strength", "habit"];
export const WEEKLY_WORKOUT_OPTIONS = ["2", "3", "4", "5"];
export const TARGET_WEIGHT_MIN = 30;
export const TARGET_WEIGHT_MAX = 250;

const TARGET_WEIGHT_PATTERN = /^\d+(\.\d)?$/;

function isValidGoalType(value) {
  return GOAL_TYPES.includes(value);
}

function isValidWeeklyWorkout(value) {
  return WEEKLY_WORKOUT_OPTIONS.includes(value);
}

function normalizeTargetWeight(rawValue) {
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return null;
  }

  const text = String(rawValue).trim();

  if (!TARGET_WEIGHT_PATTERN.test(text)) {
    return null;
  }

  const value = Number(text);

  if (value < TARGET_WEIGHT_MIN || value > TARGET_WEIGHT_MAX) {
    return null;
  }

  return text;
}

export function normalizeGoalSettings({ goal, targetWeight, weeklyWorkout }) {
  if (!isValidGoalType(goal)) {
    return { ok: false, field: "goal", reason: "invalid-goal" };
  }

  const normalizedTargetWeight = normalizeTargetWeight(targetWeight);

  if (normalizedTargetWeight === null) {
    return { ok: false, field: "targetWeight", reason: "invalid-target-weight" };
  }

  if (!isValidWeeklyWorkout(weeklyWorkout)) {
    return { ok: false, field: "weeklyWorkout", reason: "invalid-weekly-workout" };
  }

  return {
    ok: true,
    values: { goal, targetWeight: normalizedTargetWeight, weeklyWorkout }
  };
}

export function mergeGoalIntoProfile(profile, goalValues) {
  return { ...profile, ...goalValues };
}
