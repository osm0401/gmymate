import { exerciseCatalog } from "../core/data.js";
import {
  ROUTINE_LIMITS,
  buildWeeklySchedule,
  createRoutine,
  mondayIndex,
  normalizeSchedule,
  normalizeStoredRoutines,
  resolveExerciseNames
} from "../core/routines.js";
import { escapeHtml, readJson, showToast, writeJson } from "../core/storage.js";

const ROUTINES_KEY = "gmymateCustomRoutines";
const SCHEDULE_KEY = "gmymateRoutineSchedule";

const ERROR_MESSAGES = {
  "invalid-name": "루틴 이름은 1~40자로 입력해주세요.",
  "limit-reached": `루틴은 최대 ${ROUTINE_LIMITS.maxRoutines}개까지 저장할 수 있어요.`
};

const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>';
const TRASH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4Zm-3 6h12l-1 12H7Z"/></svg>';

function getTodayExerciseIds() {
  return readJson("gmymateWorkoutLogsV2", []).map((workout) => workout.exerciseId);
}

function getRoutines() {
  return normalizeStoredRoutines(readJson(ROUTINES_KEY, []), exerciseCatalog);
}

function getSchedule(routines = getRoutines()) {
  return normalizeSchedule(readJson(SCHEDULE_KEY, []), routines);
}

function save(key, value, failMessage) {
  try {
    writeJson(key, value);
    return true;
  } catch {
    showToast(failMessage);
    return false;
  }
}

function saveNewRoutine(name, exerciseIds) {
  const routines = getRoutines();
  const result = createRoutine({ name, exerciseIds, existingRoutines: routines, exerciseCatalog });

  if (!result.ok) {
    return result;
  }

  if (!save(ROUTINES_KEY, [...routines, result.routine], "저장 공간이 부족해서 루틴을 저장하지 못했어요.")) {
    return { ok: false, reason: "storage" };
  }

  return result;
}

export function setupRoutines() {
  const list = document.querySelector("#myRoutineList");

  if (!list) {
    return;
  }

  const rerender = () => render();
  setupSaveTodayAsRoutine(rerender);
  setupRoutineBuilder(rerender);
  setupListActions(rerender);

  /* 다른 기기에서 동기화돼 들어오거나 로그아웃으로 비워질 때도 화면을 맞춘다. */
  window.addEventListener("gmymate:data-changed", (event) => {
    if ([ROUTINES_KEY, SCHEDULE_KEY].includes(event.detail?.key)) {
      rerender();
    }
  });

  render();
}

/* 기록 화면의 "루틴으로 저장" — 오늘 담은 운동을 그대로 루틴으로 만든다. */
function setupSaveTodayAsRoutine(onSaved) {
  const openButton = document.querySelector("[data-open-routine-form]");
  const form = document.querySelector("#saveRoutineForm");
  const nameInput = form?.querySelector('input[name="name"]');

  openButton?.addEventListener("click", () => {
    if (getTodayExerciseIds().length === 0) {
      showToast("오늘 운동을 먼저 추가해주세요.");
      return;
    }

    form.hidden = false;
    nameInput?.focus();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = saveNewRoutine(nameInput?.value, getTodayExerciseIds());

    if (!result.ok) {
      if (result.reason !== "storage") {
        showToast(result.reason === "no-exercises" ? "오늘 운동을 먼저 추가해주세요." : ERROR_MESSAGES[result.reason]);
      }
      return;
    }

    form.reset();
    form.hidden = true;
    onSaved();
    showToast("루틴을 저장했어요.");
  });
}

/* 루틴 탭의 "+ 루틴 만들기" — 오늘 기록과 상관없이 운동을 골라 담는다. 누른 순서가 곧 운동 순서다. */
function setupRoutineBuilder(onSaved) {
  const form = document.querySelector("#routineBuilderForm");

  if (!form) {
    return;
  }

  const openButton = document.querySelector("[data-open-routine-builder]");
  const nameInput = form.querySelector('input[name="name"]');
  const search = form.querySelector("#routineBuilderSearch");
  const catalogHost = form.querySelector("#routineBuilderCatalog");
  const pickedHost = form.querySelector("#routineBuilderPicked");
  const countLabel = form.querySelector("#routineBuilderCount");
  const note = form.querySelector("#routineBuilderNote");
  let picked = [];

  function setNote(message) {
    note.textContent = message;
    note.classList.toggle("is-error", Boolean(message));
  }

  function renderBuilder() {
    const keyword = search.value.trim();
    const pickedSet = new Set(picked);
    const matches = exerciseCatalog.filter((exercise) =>
      !keyword || exercise.name.includes(keyword) || exercise.category.includes(keyword));

    countLabel.textContent = String(picked.length);
    pickedHost.innerHTML = picked.length
      ? resolveExerciseNames(picked, exerciseCatalog).map((name, index) => `
        <button type="button" class="routine-chip is-picked" data-unpick-exercise="${escapeHtml(picked[index])}">
          <b>${index + 1}</b> ${escapeHtml(name)} <span aria-hidden="true">✕</span>
        </button>`).join("")
      : '<p class="field-help">아래에서 운동을 눌러 담아주세요.</p>';

    catalogHost.innerHTML = matches.length
      ? matches.map((exercise) => `
        <button type="button" class="routine-chip${pickedSet.has(exercise.id) ? " is-picked" : ""}"
          data-pick-exercise="${escapeHtml(exercise.id)}" aria-pressed="${pickedSet.has(exercise.id)}">
          <small>${escapeHtml(exercise.category)}</small> ${escapeHtml(exercise.name)}
        </button>`).join("")
      : '<p class="field-help">검색 결과가 없어요.</p>';
  }

  function close() {
    form.reset();
    form.hidden = true;
    picked = [];
    setNote("");
    openButton?.removeAttribute("hidden");
  }

  openButton?.addEventListener("click", () => {
    form.hidden = false;
    openButton.hidden = true;
    picked = [];
    setNote("");
    renderBuilder();
    nameInput.focus();
  });

  form.querySelector("[data-close-routine-builder]")?.addEventListener("click", close);
  search.addEventListener("input", renderBuilder);

  form.addEventListener("click", (event) => {
    const pick = event.target.closest("[data-pick-exercise]");
    const unpick = event.target.closest("[data-unpick-exercise]");
    const id = pick?.dataset.pickExercise || unpick?.dataset.unpickExercise;

    if (!id) {
      return;
    }

    if (picked.includes(id)) {
      picked = picked.filter((pickedId) => pickedId !== id);
    } else if (picked.length >= ROUTINE_LIMITS.maxExercises) {
      setNote(`운동은 최대 ${ROUTINE_LIMITS.maxExercises}개까지 담을 수 있어요.`);
      return;
    } else {
      picked = [...picked, id];
    }

    setNote("");
    renderBuilder();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = saveNewRoutine(nameInput.value, picked);

    if (!result.ok) {
      if (result.reason === "no-exercises") {
        setNote("운동을 1개 이상 담아주세요.");
      } else if (result.reason !== "storage") {
        setNote(ERROR_MESSAGES[result.reason]);
      }
      return;
    }

    close();
    onSaved();
    showToast(`'${result.routine.name}' 루틴을 만들었어요.`);
  });
}

function setupListActions(onChanged) {
  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-routine]");
    const addButton = event.target.closest("[data-schedule-add]");
    const removeButton = event.target.closest("[data-schedule-remove]");
    const clearButton = event.target.closest("[data-clear-schedule]");

    if (deleteButton) {
      const routines = getRoutines();
      const next = routines.filter((routine) => routine.id !== deleteButton.dataset.deleteRoutine);

      if (next.length !== routines.length && save(ROUTINES_KEY, next, "루틴을 삭제하지 못했어요.")) {
        /* 스케줄에서도 같이 빠져야 요일 배정이 어긋나지 않는다. */
        save(SCHEDULE_KEY, getSchedule(next), "스케줄을 정리하지 못했어요.");
        onChanged();
        showToast("루틴을 삭제했어요.");
      }
      return;
    }

    if (addButton) {
      const schedule = getSchedule();

      if (schedule.length >= ROUTINE_LIMITS.maxScheduleEntries) {
        showToast(`스케줄은 한 주 길이인 ${ROUTINE_LIMITS.maxScheduleEntries}개까지 담을 수 있어요.`);
        return;
      }

      if (save(SCHEDULE_KEY, [...schedule, addButton.dataset.scheduleAdd], "스케줄을 저장하지 못했어요.")) {
        onChanged();
      }
      return;
    }

    if (removeButton) {
      const index = Number(removeButton.dataset.scheduleRemove);
      const schedule = getSchedule();

      if (save(SCHEDULE_KEY, schedule.filter((_, i) => i !== index), "스케줄을 저장하지 못했어요.")) {
        onChanged();
      }
      return;
    }

    if (clearButton && save(SCHEDULE_KEY, [], "스케줄을 비우지 못했어요.")) {
      onChanged();
    }
  });
}

function render() {
  const routines = getRoutines();
  const schedule = getSchedule(routines);
  renderMyRoutines(routines);
  renderSchedule(routines, schedule);
}

function renderMyRoutines(routines) {
  const list = document.querySelector("#myRoutineList");
  const empty = document.querySelector("#myRoutineEmpty");

  if (empty) {
    empty.hidden = routines.length > 0;
  }

  list.innerHTML = routines.map((routine) => {
    const exerciseNames = resolveExerciseNames(routine.exerciseIds, exerciseCatalog);

    return `
    <article class="routine-card">
      <div>
        <span class="routine-type">내 루틴 · ${routine.exerciseIds.length}개</span>
        <h3>${escapeHtml(routine.name)}</h3>
        <p>${escapeHtml(exerciseNames.join(", "))}</p>
      </div>
      <div class="routine-card-actions">
        <button class="circle-button" type="button" data-start-workout data-routine="${escapeHtml(routine.exerciseIds.join(","))}" aria-label="${escapeHtml(routine.name)} 시작">${PLAY_ICON}</button>
        <button class="text-button" type="button" data-schedule-add="${escapeHtml(routine.id)}">스케줄에 추가</button>
        <button class="icon-button" type="button" data-delete-routine="${escapeHtml(routine.id)}" aria-label="${escapeHtml(routine.name)} 삭제">${TRASH_ICON}</button>
      </div>
    </article>
  `;
  }).join("");
}

function renderSchedule(routines, schedule) {
  const order = document.querySelector("#routineScheduleOrder");
  const week = document.querySelector("#routineWeek");
  const help = document.querySelector("#routineScheduleHelp");
  const clearButton = document.querySelector("[data-clear-schedule]");

  if (!order || !week) {
    return;
  }

  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const todayIndex = mondayIndex(new Date());

  if (clearButton) {
    clearButton.hidden = schedule.length === 0;
  }

  if (help) {
    help.hidden = schedule.length > 0;
  }

  order.innerHTML = schedule.map((id, index) => `
    <li>
      <span class="routine-chip is-picked"><b>${String.fromCharCode(65 + index)}</b> ${escapeHtml(byId.get(id).name)}</span>
      <button class="icon-button" type="button" data-schedule-remove="${index}" aria-label="${escapeHtml(byId.get(id).name)} 스케줄에서 빼기">✕</button>
    </li>
  `).join("");

  const letters = new Map(schedule.map((id, index) => [index, String.fromCharCode(65 + index)]));

  week.hidden = schedule.length === 0;
  week.innerHTML = buildWeeklySchedule(schedule, routines).map((day, index) => {
    const isToday = index === todayIndex;
    const letter = letters.get(index % schedule.length) || "";

    return `
    <li class="routine-week-day${isToday ? " is-today" : ""}"${isToday ? ' aria-current="date"' : ""}>
      <span class="routine-week-label">${day.label}${isToday ? " · 오늘" : ""}</span>
      <strong>${letter ? `<b>${letter}</b> ` : ""}${day.routine ? escapeHtml(day.routine.name) : "-"}</strong>
      ${isToday && day.routine ? `<button class="circle-button" type="button" data-start-workout data-routine="${escapeHtml(day.routine.exerciseIds.join(","))}" aria-label="오늘 루틴 ${escapeHtml(day.routine.name)} 시작">${PLAY_ICON}</button>` : ""}
    </li>
  `;
  }).join("");
}
