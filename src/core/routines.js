export const ROUTINE_LIMITS = {
  maxRoutines: 30,
  minExercises: 1,
  maxExercises: 12,
  maxNameLength: 40
};

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
