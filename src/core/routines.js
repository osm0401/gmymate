export const ROUTINE_LIMITS = {
  maxRoutines: 30,
  minExercises: 1,
  maxExercises: 12,
  maxNameLength: 40,
  // 한 주는 7일이라 8번째 이후 항목은 어느 요일에도 배정되지 않는다.
  maxScheduleEntries: 7
};

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// Date.getDay()는 일요일이 0이다. 스케줄은 월요일부터 세므로 월=0 … 일=6으로 바꾼다.
export function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

// 저장된 스케줄에서 지워진 루틴을 걸러낸다. 같은 루틴을 여러 번 넣는 건 허용한다.
export function normalizeSchedule(rawIds, routines) {
  if (!Array.isArray(rawIds)) {
    return [];
  }

  const existing = new Set(routines.map((routine) => routine.id));
  return rawIds
    .filter((id) => typeof id === "string" && existing.has(id))
    .slice(0, ROUTINE_LIMITS.maxScheduleEntries);
}

// 등록 순서대로 요일에 돌려 배정한다: [A,B,C] → 월A 화B 수C 목A 금B 토C 일A.
export function buildWeeklySchedule(rawIds, routines) {
  const ids = normalizeSchedule(rawIds, routines);
  const byId = new Map(routines.map((routine) => [routine.id, routine]));

  return WEEKDAY_LABELS.map((label, index) => ({
    label,
    routine: ids.length > 0 ? byId.get(ids[index % ids.length]) : null
  }));
}

function defaultIdFactory() {
  return `routine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sanitizeRoutineName(name) {
  return typeof name === "string" ? name.trim() : "";
}

export function dedupeExerciseIds(exerciseIds, exerciseCatalog) {
  const validIds = new Set(exerciseCatalog.map((exercise) => exercise.id));
  const seen = new Set();
  const result = [];

  (Array.isArray(exerciseIds) ? exerciseIds : []).forEach((id) => {
    if (typeof id !== "string" || !validIds.has(id) || seen.has(id)) {
      return;
    }

    seen.add(id);
    result.push(id);
  });

  return result;
}

export function createRoutine({ name, exerciseIds, existingRoutines = [], exerciseCatalog, idFactory = defaultIdFactory }) {
  const trimmedName = sanitizeRoutineName(name);

  if (trimmedName.length === 0 || trimmedName.length > ROUTINE_LIMITS.maxNameLength) {
    return { ok: false, reason: "invalid-name" };
  }

  const cleanIds = dedupeExerciseIds(exerciseIds, exerciseCatalog).slice(0, ROUTINE_LIMITS.maxExercises);

  if (cleanIds.length < ROUTINE_LIMITS.minExercises) {
    return { ok: false, reason: "no-exercises" };
  }

  if (existingRoutines.length >= ROUTINE_LIMITS.maxRoutines) {
    return { ok: false, reason: "limit-reached" };
  }

  return {
    ok: true,
    routine: { id: idFactory(), name: trimmedName, exerciseIds: cleanIds }
  };
}

export function normalizeStoredRoutines(rawRoutines, exerciseCatalog) {
  if (!Array.isArray(rawRoutines)) {
    return [];
  }

  const result = [];

  for (const raw of rawRoutines) {
    if (result.length >= ROUTINE_LIMITS.maxRoutines) {
      break;
    }

    if (!raw || typeof raw !== "object") {
      continue;
    }

    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    const name = sanitizeRoutineName(raw.name);

    if (!id || name.length === 0 || name.length > ROUTINE_LIMITS.maxNameLength) {
      continue;
    }

    const exerciseIds = dedupeExerciseIds(raw.exerciseIds, exerciseCatalog).slice(0, ROUTINE_LIMITS.maxExercises);

    if (exerciseIds.length < ROUTINE_LIMITS.minExercises) {
      continue;
    }

    result.push({ id, name, exerciseIds });
  }

  return result;
}

export function resolveExerciseNames(exerciseIds, exerciseCatalog) {
  const nameById = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise.name]));
  return exerciseIds.map((id) => nameById.get(id)).filter(Boolean);
}

export function planRoutineStart({ existingExerciseIds = [], routineExerciseIds = [], exerciseCatalog, maxSlots = ROUTINE_LIMITS.maxExercises }) {
  const existingSet = new Set(existingExerciseIds);
  const validIds = new Set(exerciseCatalog.map((exercise) => exercise.id));
  const remainingSlots = Math.max(maxSlots - existingExerciseIds.length, 0);
  const candidates = (Array.isArray(routineExerciseIds) ? routineExerciseIds : [])
    .filter((id) => validIds.has(id) && !existingSet.has(id));
  const toAdd = candidates.slice(0, remainingSlots);

  return { toAdd, skippedCount: candidates.length - toAdd.length };
}
