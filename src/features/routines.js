import { exerciseCatalog } from "../core/data.js";
import { ROUTINE_LIMITS, createRoutine, normalizeStoredRoutines, resolveExerciseNames } from "../core/routines.js";
import { escapeHtml, readJson, showToast, writeJson } from "../core/storage.js";

const ROUTINES_KEY = "gmymateCustomRoutines";

const ERROR_MESSAGES = {
  "no-exercises": "오늘 운동을 먼저 추가해주세요.",
  "invalid-name": "루틴 이름은 1~40자로 입력해주세요.",
  "limit-reached": `루틴은 최대 ${ROUTINE_LIMITS.maxRoutines}개까지 저장할 수 있어요.`
};

function getTodayExerciseIds() {
  return readJson("gmymateWorkoutLogsV2", []).map((workout) => workout.exerciseId);
}

function getRoutines() {
  return normalizeStoredRoutines(readJson(ROUTINES_KEY, []), exerciseCatalog);
}

function saveRoutines(routines) {
  try {
    writeJson(ROUTINES_KEY, routines);
    return true;
  } catch {
    showToast("저장 공간이 부족해서 루틴을 저장하지 못했어요.");
    return false;
  }
}

export function setupRoutines() {
  const section = document.querySelector("#myRoutineSection");
  const list = document.querySelector("#myRoutineList");
  const openButton = document.querySelector("[data-open-routine-form]");
  const form = document.querySelector("#saveRoutineForm");
  const nameInput = form?.querySelector('input[name="name"]');

  if (!section || !list) {
    return;
  }

  renderMyRoutines(section, list);

  openButton?.addEventListener("click", () => {
    if (getTodayExerciseIds().length === 0) {
      showToast(ERROR_MESSAGES["no-exercises"]);
      return;
    }

    form.hidden = false;
    nameInput?.focus();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const result = createRoutine({
      name: nameInput?.value,
      exerciseIds: getTodayExerciseIds(),
      existingRoutines: getRoutines(),
      exerciseCatalog
    });

    if (!result.ok) {
      showToast(ERROR_MESSAGES[result.reason] || "루틴을 저장하지 못했어요.");
      return;
    }

    if (!saveRoutines([...getRoutines(), result.routine])) {
      return;
    }

    form.reset();
    form.hidden = true;
    renderMyRoutines(section, list);
    showToast("루틴을 저장했어요.");
  });

  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-routine]");

    if (!deleteButton) {
      return;
    }

    const routines = getRoutines();
    const nextRoutines = routines.filter((routine) => routine.id !== deleteButton.dataset.deleteRoutine);

    if (nextRoutines.length === routines.length || !saveRoutines(nextRoutines)) {
      return;
    }

    renderMyRoutines(section, list);
    showToast("루틴을 삭제했어요.");
  });
}

function renderMyRoutines(section, list) {
  const routines = getRoutines();
  section.hidden = routines.length === 0;

  list.innerHTML = routines.map((routine) => {
    const exerciseNames = resolveExerciseNames(routine.exerciseIds, exerciseCatalog);

    return `
    <article class="routine-card">
      <div>
        <span class="routine-type">내 루틴</span>
        <h3>${escapeHtml(routine.name)}</h3>
        <p>${escapeHtml(exerciseNames.join(", "))}</p>
      </div>
      <div class="routine-card-actions">
        <button class="circle-button" type="button" data-start-workout data-routine="${escapeHtml(routine.exerciseIds.join(","))}" aria-label="${escapeHtml(routine.name)} 시작">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>
        </button>
        <button class="icon-button" type="button" data-delete-routine="${escapeHtml(routine.id)}" aria-label="${escapeHtml(routine.name)} 삭제">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4Zm-3 6h12l-1 12H7Z"/></svg>
        </button>
      </div>
    </article>
  `;
  }).join("");
}
