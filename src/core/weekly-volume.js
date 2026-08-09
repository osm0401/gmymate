const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseDateKey(dateKey) {
  if (typeof dateKey !== "string") {
    return null;
  }

  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  const isRealCalendarDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isRealCalendarDate ? date : null;
}

function parseFinishedAt(finishedAt) {
  if (!finishedAt) {
    return null;
  }

  const date = new Date(finishedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveSessionDate(session) {
  return parseDateKey(session?.dateKey) ?? parseFinishedAt(session?.finishedAt);
}

function resolveSessionVolume(session) {
  if (typeof session?.volume === "number" && Number.isFinite(session.volume) && session.volume >= 0) {
    return session.volume;
  }

  const workouts = Array.isArray(session?.workouts) ? session.workouts : [];

  return workouts.reduce((workoutSum, workout) => {
    const sets = Array.isArray(workout?.sets) ? workout.sets : [];

    const setsVolume = sets.reduce((setSum, set) => {
      if (set?.done !== true) {
        return setSum;
      }

      const weight = Math.max(0, toFiniteNumber(set.weight));
      const reps = Math.max(0, toFiniteNumber(set.reps));

      return setSum + weight * reps;
    }, 0);

    return workoutSum + setsVolume;
  }, 0);
}

function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findBucket(buckets, sessionDate) {
  return buckets.find((bucket) => {
    const diff = sessionDate.getTime() - bucket.weekStart.getTime();
    return diff >= 0 && diff < 7 * DAY_MS;
  });
}

// 일요일 00:00(로컬 시간) 기준 최근 count주 버킷을 오래된 주부터 만든다.
export function buildWeeklyVolumeBuckets(history, { count = 6, now = new Date() } = {}) {
  const safeHistory = Array.isArray(history) ? history : [];
  const currentWeekStart = startOfWeek(now);

  const buckets = [];
  for (let weeksAgo = count - 1; weeksAgo >= 0; weeksAgo -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - weeksAgo * 7);

    buckets.push({
      weekStart,
      weekStartKey: formatDateKey(weekStart),
      volume: 0,
      isCurrent: weeksAgo === 0
    });
  }

  safeHistory.forEach((session) => {
    const sessionDate = resolveSessionDate(session);
    if (!sessionDate) {
      return;
    }

    const bucket = findBucket(buckets, sessionDate);
    if (!bucket) {
      return;
    }

    bucket.volume += resolveSessionVolume(session);
  });

  return buckets;
}
