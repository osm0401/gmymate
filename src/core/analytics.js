const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function dayFromDateKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(DATE_KEY_PATTERN);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }

  return timestamp / DAY_MS;
}

function dateKeyFromDay(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function calendarDate(value) {
  const dateKeyDay = dayFromDateKey(value);

  if (dateKeyDay !== null) {
    return { day: dateKeyDay, dateKey: value };
  }

  if (typeof value === "string" && DATE_KEY_PATTERN.test(value)) {
    return null;
  }

  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");

  return { day: dayFromDateKey(dateKey), dateKey };
}

function nonnegativeNumber(value) {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function completedSets(workout) {
  if (!Array.isArray(workout?.sets)) {
    return [];
  }

  return workout.sets
    .filter((set) => set && typeof set === "object" && set.done === true)
    .map((set) => ({
      weight: nonnegativeNumber(set.weight) ?? 0,
      reps: nonnegativeNumber(set.reps) ?? 0
    }))
    .filter((set) => set.reps > 0);
}

function setVolume(sets) {
  return sets.reduce((total, set) => total + set.weight * set.reps, 0);
}

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : []).flatMap((rawSession) => {
    if (!rawSession || typeof rawSession !== "object") {
      return [];
    }

    const dateKeyDay = dayFromDateKey(rawSession.dateKey);
    const calendar = dateKeyDay === null
      ? calendarDate(rawSession.finishedAt)
      : { day: dateKeyDay, dateKey: rawSession.dateKey };

    if (!calendar) {
      return [];
    }

    const workouts = Array.isArray(rawSession.workouts) ? rawSession.workouts : [];
    const storedVolume = nonnegativeNumber(rawSession.volume);
    const volume = storedVolume ?? workouts.reduce(
      (total, item) => total + setVolume(completedSets(item)),
      0
    );

    return [{ ...calendar, volume, workouts }];
  });
}

function streaksFromSessions(sessions, referenceDay) {
  const days = [...new Set(sessions.map((entry) => entry.day).filter((day) => day <= referenceDay))]
    .sort((a, b) => a - b);
  const best = days.reduce((state, day) => {
    const run = state.previous !== null && day === state.previous + 1 ? state.run + 1 : 1;
    return { previous: day, run, best: Math.max(state.best, run) };
  }, { previous: null, run: 0, best: 0 });
  const completedDays = new Set(days);
  const currentEnd = completedDays.has(referenceDay)
    ? referenceDay
    : completedDays.has(referenceDay - 1) ? referenceDay - 1 : null;
  let currentStreak = 0;

  while (currentEnd !== null && completedDays.has(currentEnd - currentStreak)) {
    currentStreak += 1;
  }

  return { currentStreak, bestStreak: best.best };
}

function progressFromSessions(sessions) {
  const entries = sessions.flatMap((session) => session.workouts.flatMap((item) => {
    const exerciseId = typeof item?.exerciseId === "string" ? item.exerciseId.trim() : "";
    const sets = completedSets(item);

    if (!exerciseId || sets.length === 0) {
      return [];
    }

    const bestSet = sets.reduce((best, set) => (
      set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps) ? set : best
    ));

    return [{
      exerciseId,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : exerciseId,
      point: {
        dateKey: session.dateKey,
        volume: setVolume(sets),
        bestWeight: bestSet.weight,
        bestReps: bestSet.reps
      }
    }];
  })).sort((a, b) => a.point.dateKey.localeCompare(b.point.dateKey) || a.exerciseId.localeCompare(b.exerciseId));

  const grouped = entries.reduce((groups, entry) => {
    const existing = groups.find((group) => group.exerciseId === entry.exerciseId);

    if (!existing) {
      return [...groups, { exerciseId: entry.exerciseId, name: entry.name, points: [entry.point] }];
    }

    return groups.map((group) => group.exerciseId === entry.exerciseId
      ? { ...group, name: entry.name, points: [...group.points, entry.point] }
      : group);
  }, []).sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));

  return deepFreeze(grouped);
}

export function getWorkoutStreaks(history, referenceDate = new Date()) {
  const reference = calendarDate(referenceDate) || calendarDate(new Date());
  return deepFreeze(streaksFromSessions(normalizeHistory(history), reference.day));
}

export function getExerciseProgress(history) {
  return progressFromSessions(normalizeHistory(history));
}

export function getExerciseProgressPoints(history, exerciseId) {
  if (typeof exerciseId !== "string" || !exerciseId.trim()) {
    return deepFreeze([]);
  }

  return getExerciseProgress(history).find((entry) => entry.exerciseId === exerciseId.trim())?.points || deepFreeze([]);
}

export function summarizeWorkoutHistory(history, referenceDate = new Date()) {
  const sessions = normalizeHistory(history);
  const reference = calendarDate(referenceDate) || calendarDate(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const dateKey = dateKeyFromDay(reference.day - 6 + index);
    const matching = sessions.filter((entry) => entry.dateKey === dateKey);
    return {
      dateKey,
      volume: matching.reduce((total, entry) => total + entry.volume, 0),
      sessions: matching.length
    };
  });
  const streaks = streaksFromSessions(sessions, reference.day);

  return deepFreeze({
    last7Days: {
      volume: days.reduce((total, day) => total + day.volume, 0),
      sessions: days.reduce((total, day) => total + day.sessions, 0),
      days
    },
    totalVolume: sessions.reduce((total, entry) => total + entry.volume, 0),
    totalSessions: sessions.length,
    ...streaks,
    exerciseProgress: progressFromSessions(sessions)
  });
}
