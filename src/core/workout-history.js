(function attachWorkoutHistory(app) {
const { readJson } = app;

function getWorkoutHistory() {
  const history = readJson("gmymateWorkoutHistory", []);

  if (!Array.isArray(history)) {
    return [];
  }

  return [...history].sort((left, right) => getSessionTime(right) - getSessionTime(left));
}

function getSessionTime(session) {
  const value = session?.finishedAt || (session?.dateKey ? `${session.dateKey}T12:00:00` : "");
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function findPreviousExerciseWorkout(exerciseId) {
  for (const session of getWorkoutHistory()) {
    const workout = Array.isArray(session.workouts)
      ? session.workouts.find((item) => item.exerciseId === exerciseId)
      : null;

    if (workout) {
      return { session, workout };
    }
  }

  return null;
}

function getPreviousCompletedSets(exerciseId) {
  const previous = findPreviousExerciseWorkout(exerciseId);

  if (!previous || !Array.isArray(previous.workout.sets)) {
    return [];
  }

  return previous.workout.sets.filter((set) => set.done);
}

function createSetsFromPrevious(exercise, requestedCount = exercise.sets) {
  const count = Math.min(Math.max(Number(requestedCount) || 1, 1), 20);
  const previousSets = getPreviousCompletedSets(exercise.id);

  return Array.from({ length: count }, (_, index) => {
    const previous = previousSets[index] || previousSets.at(-1);

    return {
      weight: previous ? Math.max(Number(previous.weight) || 0, 0) : exercise.weight,
      reps: previous ? Math.max(Math.round(Number(previous.reps) || 1), 1) : exercise.reps,
      done: false
    };
  });
}

Object.assign(app, {
  createSetsFromPrevious,
  findPreviousExerciseWorkout,
  getPreviousCompletedSets,
  getWorkoutHistory
});
})(window.Gmymate = window.Gmymate || {});
