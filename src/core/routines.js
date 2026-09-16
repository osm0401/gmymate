export const ROUTINE_LIMITS = {
  maxRoutines: 30,
  minExercises: 1,
  maxExercises: 12,
  maxNameLength: 40,
  // 한 주는 7일이라 8번째 이후 항목은 어느 요일에도 배정되지 않는다.
  maxScheduleEntries: 7,
  // 루틴에 저장하는 운동별 목표치. 범위를 벗어난 값은 잘라 맞추지 않고 기본값으로 되돌린다.
  target: { maxSets: 10, maxWeight: 500, maxReps: 100 }
};

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

// 운동 하나의 목표(세트·무게·횟수). 필드마다 따로 검사해서 틀린 것만 운동 기본값으로 채운다.
export function normalizeRoutineTarget(raw, exercise) {
  const { maxSets, maxWeight, maxReps } = ROUTINE_LIMITS.target;
  const sets = toNumber(raw?.sets);
  const weight = toNumber(raw?.weight);
  const reps = toNumber(raw?.reps);

  return {
    sets: Number.isInteger(sets) && sets >= 1 && sets <= maxSets ? sets : exercise.sets,
    weight: Number.isFinite(weight) && weight >= 0 && weight <= maxWeight ? Math.round(weight * 10) / 10 : exercise.weight,
    reps: Number.isInteger(reps) && reps >= 1 && reps <= maxReps ? reps : exercise.reps
  };
}

function normalizeTargets(rawTargets, exerciseIds, exerciseCatalog, { fillMissing }) {
  const byId = new Map(exerciseCatalog.map((exercise) => [exercise.id, exercise]));
  const hasRaw = rawTargets && typeof rawTargets === "object" && !Array.isArray(rawTargets);
  const result = {};

  exerciseIds.forEach((id) => {
    const provided = hasRaw && Object.hasOwn(rawTargets, id);

    if (provided || fillMissing) {
      result[id] = normalizeRoutineTarget(provided ? rawTargets[id] : null, byId.get(id));
    }
  });

  return result;
}

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

export function createRoutine({ name, exerciseIds, targets, existingRoutines = [], exerciseCatalog, idFactory = defaultIdFactory }) {
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

  const routine = { id: idFactory(), name: trimmedName, exerciseIds: cleanIds };

  // 목표치를 넘겼으면 담긴 운동 전부에 목표를 채운다. 안 넘겼으면 예전 모양 그대로 —
  // 시작할 때 지난 기록/기본값을 쓴다.
  if (targets !== undefined) {
    routine.targets = normalizeTargets(targets, cleanIds, exerciseCatalog, { fillMissing: true });
  }

  return { ok: true, routine };
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

    const routine = { id, name, exerciseIds };
    const targets = normalizeTargets(raw.targets, exerciseIds, exerciseCatalog, { fillMissing: false });

    if (Object.keys(targets).length > 0) {
      routine.targets = targets;
    }

    result.push(routine);
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
