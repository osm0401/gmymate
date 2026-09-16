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

function getTodayWorkouts() {
  return readJson("gmymateWorkoutLogsV2", []);
}

function getTodayExerciseIds() {
  return getTodayWorkouts().map((workout) => workout.exerciseId);
}

/* 오늘 넣은 세트 수와 첫 세트의 무게·횟수를 그 운동의 목표치로 삼는다. */
function getTodayTargets() {
  return Object.fromEntries(getTodayWorkouts().map((workout) => {
    const sets = Array.isArray(workout.sets) ? workout.sets : [];
    const first = sets[0] || {};
    return [workout.exerciseId, { sets: sets.length, weight: first.weight, reps: first.reps }];
  }));
}

function exerciseById(id) {
  return exerciseCatalog.find((exercise) => exercise.id === id);
}

function formatWeight(weight) {
  return weight > 0 ? `${weight}kg` : "맨몸";
}

function targetSummary(routine) {
  return routine.exerciseIds.map((id) => {
    const name = exerciseById(id)?.name || id;
    const target = routine.targets?.[id];
    return target ? `${name} ${formatWeight(target.weight)}×${target.reps}회 ${target.sets}세트` : name;
  });
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

function saveNewRoutine(name, exerciseIds, targets) {
  const routines = getRoutines();
  const result = createRoutine({ name, exerciseIds, targets, existingRoutines: routines, exerciseCatalog });

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
    const result = saveNewRoutine(nameInput?.value, getTodayExerciseIds(), getTodayTargets());

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
  // [{ id, sets, weight, reps }] — 담은 순서가 곧 운동 순서다.
  let picked = [];

  function setNote(message) {
    note.textContent = message;
    note.classList.toggle("is-error", Boolean(message));
  }

  function numberField(item, field, label, unit, { min, max, step }) {
    return `
      <label class="routine-target-field">
        <span>${label}</span>
        <input type="number" inputmode="${step < 1 ? "decimal" : "numeric"}" min="${min}" max="${max}" step="${step}"
          value="${item[field]}" data-target-id="${escapeHtml(item.id)}" data-target-field="${field}"
          aria-label="${escapeHtml(exerciseById(item.id)?.name || "")} ${label}">
        <small>${unit}</small>
      </label>`;
  }

  function renderBuilder() {
    const keyword = search.value.trim();
    const pickedSet = new Set(picked.map((item) => item.id));
    const matches = exerciseCatalog.filter((exercise) =>
      !keyword || exercise.name.includes(keyword) || exercise.category.includes(keyword));
    const { maxSets, maxWeight, maxReps } = ROUTINE_LIMITS.target;

    countLabel.textContent = String(picked.length);
    pickedHost.innerHTML = picked.length
      ? picked.map((item, index) => `
        <div class="routine-target-row">
          <div class="routine-target-head">
            <b>${index + 1}</b>
            <strong>${escapeHtml(exerciseById(item.id)?.name || item.id)}</strong>
            <button class="icon-button" type="button" data-unpick-exercise="${escapeHtml(item.id)}" aria-label="${escapeHtml(exerciseById(item.id)?.name || "")} 빼기">✕</button>
          </div>
          <div class="routine-target-inputs">
            ${numberField(item, "sets", "세트", "세트", { min: 1, max: maxSets, step: 1 })}
            ${numberField(item, "weight", "무게", "kg", { min: 0, max: maxWeight, step: 0.5 })}
            ${numberField(item, "reps", "횟수", "회", { min: 1, max: maxReps, step: 1 })}
          </div>
        </div>`).join("")
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

    if (picked.some((item) => item.id === id)) {
      picked = picked.filter((item) => item.id !== id);
    } else if (picked.length >= ROUTINE_LIMITS.maxExercises) {
      setNote(`운동은 최대 ${ROUTINE_LIMITS.maxExercises}개까지 담을 수 있어요.`);
      return;
    } else {
      /* 기본값은 운동 카탈로그 값 — 기록 화면에서 운동을 추가할 때와 같다. */
      const exercise = exerciseById(id);
      picked = [...picked, { id, sets: exercise.sets, weight: exercise.weight, reps: exercise.reps }];
    }

    setNote("");
    renderBuilder();
  });

  form.addEventListener("input", (event) => {
    const input = event.target.closest("[data-target-field]");
    const item = input && picked.find((entry) => entry.id === input.dataset.targetId);

    if (item) {
      item[input.dataset.targetField] = input.value;
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const { maxSets, maxWeight, maxReps } = ROUTINE_LIMITS.target;
    const isValid = {
      sets: (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= maxSets,
      weight: (value) => String(value).trim() !== "" && Number(value) >= 0 && Number(value) <= maxWeight,
      reps: (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= maxReps
    };
    let invalid = null;

    for (const item of picked) {
      const field = ["sets", "weight", "reps"].find((key) => !isValid[key](item[key]));
      if (field) {
        invalid = { item, field };
        break;
      }
    }

    /* 저장 단계에서 조용히 기본값으로 바꾸지 않고, 틀린 칸으로 보내서 고치게 한다. */
    if (invalid) {
      setNote(`${exerciseById(invalid.item.id)?.name}: 세트 1~${maxSets}, 무게 0~${maxWeight}kg, 횟수 1~${maxReps}회로 입력해주세요.`);
      pickedHost.querySelector(`[data-target-id="${invalid.item.id}"][data-target-field="${invalid.field}"]`)?.focus();
      return;
    }

    const targets = Object.fromEntries(picked.map((item) => [item.id, item]));
    const result = saveNewRoutine(nameInput.value, picked.map((item) => item.id), targets);

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
        ${routine.targets
          ? `<ul class="routine-target-summary">${targetSummary(routine).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
          : `<p>${escapeHtml(exerciseNames.join(", "))}</p>`}
      </div>
      <div class="routine-card-actions">
        <button class="circle-button" type="button" data-start-workout data-routine="${escapeHtml(routine.exerciseIds.join(","))}" data-routine-id="${escapeHtml(routine.id)}" aria-label="${escapeHtml(routine.name)} 시작">${PLAY_ICON}</button>
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
      ${isToday && day.routine ? `<button class="circle-button" type="button" data-start-workout data-routine="${escapeHtml(day.routine.exerciseIds.join(","))}" data-routine-id="${escapeHtml(day.routine.id)}" aria-label="오늘 루틴 ${escapeHtml(day.routine.name)} 시작">${PLAY_ICON}</button>` : ""}
    </li>
  `;
  }).join("");
}
