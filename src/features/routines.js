(function attachRoutines(app) {
const { createSetsFromPrevious, exerciseCatalog, escapeHtml, readJson, showToast, writeJson } = app;

function setupRoutines() {
  const list = document.querySelector("#customRoutineList");
  const builder = document.querySelector("#routineBuilder");
  const builderTitle = document.querySelector("#routineBuilderTitle");
  const nameInput = document.querySelector("#routineNameInput");
  const searchInput = document.querySelector("#routineExerciseSearch");
  const selectedList = document.querySelector("#routineSelectedList");
  const exerciseList = document.querySelector("#routineExerciseList");
  const exerciseCount = document.querySelector("#routineExerciseCount");
  const saveButton = document.querySelector("[data-save-routine]");

  if (!list || !builder || !nameInput || !selectedList || !exerciseList) {
    return;
  }

  let routines = normalizeRoutines(readJson("gmymateCustomRoutines", []));
  let editingId = null;
  let draftExercises = [];
  const routineParameterRules = {
    weight: { min: 0, max: 500, precision: 1 },
    reps: { min: 1, max: 999, precision: 0 },
    restSeconds: { min: 15, max: 600, precision: 0 }
  };

  function normalizeRoutineNumber(value, min, max, fallback, precision = 0) {
    const parsed = value === "" || value === null || value === undefined ? Number.NaN : Number(value);
    const fallbackNumber = Number(fallback);
    const safeValue = Number.isFinite(parsed) ? parsed : fallbackNumber;
    const clamped = Math.min(Math.max(Number.isFinite(safeValue) ? safeValue : min, min), max);
    return precision > 0 ? Number(clamped.toFixed(precision)) : Math.round(clamped);
  }

  function formatRoutineNumber(value) {
    return Number(value).toFixed(1).replace(/\.0$/, "");
  }

  function getDefaultRestSeconds() {
    const settings = readJson("gmymateSettings", {});
    return normalizeRoutineNumber(settings.restSeconds, 15, 600, 90);
  }

  function getRoutineExerciseDefaults(exercise) {
    const previousSet = createSetsFromPrevious(exercise, 1)[0] || {};

    return {
      exerciseId: exercise.id,
      sets: normalizeRoutineNumber(exercise.sets, 1, 20, 3),
      weight: normalizeRoutineNumber(previousSet.weight, 0, 500, exercise.weight, 1),
      reps: normalizeRoutineNumber(previousSet.reps, 1, 999, exercise.reps),
      restSeconds: getDefaultRestSeconds()
    };
  }

  function normalizeRoutineExercise(item) {
    const exercise = getExercise(item?.exerciseId);

    if (!exercise) {
      return null;
    }

    const defaults = getRoutineExerciseDefaults(exercise);
    return {
      exerciseId: exercise.id,
      sets: normalizeRoutineNumber(item.sets, 1, 20, defaults.sets),
      weight: normalizeRoutineNumber(item.weight, 0, 500, defaults.weight, 1),
      reps: normalizeRoutineNumber(item.reps, 1, 999, defaults.reps),
      restSeconds: normalizeRoutineNumber(item.restSeconds, 15, 600, defaults.restSeconds)
    };
  }

  function normalizeRoutines(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((routine, index) => ({
      id: routine.id || `routine-${Date.now()}-${index}`,
      dbId: Math.max(Number(routine.dbId) || 0, 0),
      name: String(routine.name || "나의 루틴").slice(0, 30),
      isFavorite: Boolean(routine.isFavorite),
      exercises: Array.isArray(routine.exercises)
        ? routine.exercises.map(normalizeRoutineExercise).filter(Boolean)
        : []
    })).filter((routine) => routine.exercises.length > 0);
  }

  function getExercise(id) {
    return exerciseCatalog.find((exercise) => exercise.id === id);
  }

  function saveRoutines() {
    writeJson("gmymateCustomRoutines", routines);
    app.cloudSync?.syncRoutines(routines);
  }

  function renderRoutines() {
    if (!routines.length) {
      list.innerHTML = `
        <button class="empty-routine" type="button" data-new-routine>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7Z"/></svg>
          <strong>아직 만든 루틴이 없어요.</strong>
          <span>자주 하는 운동을 한 번만 정해두세요.</span>
        </button>
      `;
      return;
    }

    list.innerHTML = routines.map((routine) => {
      const totalSets = routine.exercises.reduce((sum, item) => sum + item.sets, 0);
      const names = routine.exercises.map((item) => getExercise(item.exerciseId)?.name).filter(Boolean).join(", ");
      return `
        <article class="custom-routine-card" data-routine-id="${escapeHtml(routine.id)}">
          <div class="custom-routine-copy">
            <strong>${escapeHtml(routine.name)}</strong>
            <span>${routine.exercises.length}개 운동 · ${totalSets}세트</span>
            <p>${escapeHtml(names)}</p>
          </div>
          <div class="custom-routine-actions">
            <button type="button" data-start-routine="${escapeHtml(routine.id)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>
              시작
            </button>
            <button type="button" data-edit-routine="${escapeHtml(routine.id)}" aria-label="${escapeHtml(routine.name)} 수정">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16.5 10.7-10.7 2.5 2.5L7.5 19H5Zm11.7-12.7 1.5-1.5 3.5 3.5-1.5 1.5Z"/></svg>
            </button>
            <button type="button" data-delete-routine="${escapeHtml(routine.id)}" aria-label="${escapeHtml(routine.name)} 삭제">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10l-.6 14H7.6Zm2-3h6l1 2H8Z"/></svg>
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderBuilder() {
    const keyword = searchInput?.value.trim().toLowerCase() || "";
    const selectedIds = new Set(draftExercises.map((item) => item.exerciseId));
    const filtered = exerciseCatalog.filter((exercise) => `${exercise.name} ${exercise.category}`.toLowerCase().includes(keyword));

    exerciseCount.textContent = `${draftExercises.length}개`;
    selectedList.innerHTML = draftExercises.length ? draftExercises.map((item, index) => {
      const exercise = getExercise(item.exerciseId);
      const unit = exercise.unit || "회";
      const repsLabel = unit === "회" ? "횟수" : "시간";
      return `
        <div class="routine-selected-row" data-routine-exercise="${escapeHtml(item.exerciseId)}">
          <div class="routine-selected-header">
            <div class="routine-selected-copy">
              <strong>${escapeHtml(exercise.name)}</strong>
              <span>${escapeHtml(exercise.category)}</span>
            </div>
            <div class="routine-selected-actions">
              <div class="routine-order-buttons">
                <button type="button" data-move-routine-exercise="${index}:-1" aria-label="${escapeHtml(exercise.name)} 위로 이동" ${index === 0 ? "disabled" : ""}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5-1.4 1.4-3.6-3.6-3.6 3.6Z"/></svg>
                </button>
                <button type="button" data-move-routine-exercise="${index}:1" aria-label="${escapeHtml(exercise.name)} 아래로 이동" ${index === draftExercises.length - 1 ? "disabled" : ""}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5-1.4-1.4-3.6 3.6-3.6-3.6Z"/></svg>
                </button>
              </div>
              <button class="routine-remove-exercise" type="button" data-remove-routine-exercise="${index}" aria-label="${escapeHtml(exercise.name)} 빼기">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v2H6Z"/></svg>
              </button>
            </div>
          </div>
          <div class="routine-parameter-grid">
            <div class="routine-parameter">
              <span>세트</span>
              <div class="routine-set-control" aria-label="${escapeHtml(exercise.name)} 세트 수">
                <button type="button" data-routine-set="${index}:-1" aria-label="세트 줄이기" ${item.sets <= 1 ? "disabled" : ""}>−</button>
                <strong>${item.sets}</strong>
                <button type="button" data-routine-set="${index}:1" aria-label="세트 추가">+</button>
              </div>
            </div>
            <label class="routine-parameter">
              <span>무게</span>
              <span class="routine-number-field">
                <input type="number" min="0" max="500" step="0.5" inputmode="decimal" value="${formatRoutineNumber(item.weight)}" data-routine-param="${index}:weight" aria-label="${escapeHtml(exercise.name)} 무게">
                <small>kg</small>
              </span>
            </label>
            <label class="routine-parameter">
              <span>${repsLabel}</span>
              <span class="routine-number-field">
                <input type="number" min="1" max="999" step="1" inputmode="numeric" value="${formatRoutineNumber(item.reps)}" data-routine-param="${index}:reps" aria-label="${escapeHtml(exercise.name)} ${repsLabel}">
                <small>${escapeHtml(unit)}</small>
              </span>
            </label>
            <label class="routine-parameter">
              <span>휴식</span>
              <span class="routine-number-field">
                <input type="number" min="15" max="600" step="15" inputmode="numeric" value="${formatRoutineNumber(item.restSeconds)}" data-routine-param="${index}:restSeconds" aria-label="${escapeHtml(exercise.name)} 휴식 시간">
                <small>초</small>
              </span>
            </label>
          </div>
        </div>
      `;
    }).join("") : `<p class="routine-selected-empty">아래에서 운동을 추가하세요.</p>`;

    exerciseList.innerHTML = filtered.map((exercise) => {
      const selected = selectedIds.has(exercise.id);
      return `
        <button type="button" data-add-routine-exercise="${escapeHtml(exercise.id)}" ${selected ? "disabled" : ""}>
          <span>
            <strong>${escapeHtml(exercise.name)}</strong>
            <small>${escapeHtml(exercise.category)} · 기본 ${exercise.sets}세트</small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${selected ? "m9.7 15.5 7-7 1.4 1.4-8.4 8.4-4.1-4.1L7 12.8Z" : "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"}"/></svg>
        </button>
      `;
    }).join("");
  }

  function openBuilder(routineId) {
    const routine = routines.find((item) => item.id === routineId);
    editingId = routine?.id || null;
    draftExercises = routine ? routine.exercises.map((item) => ({ ...item })) : [];
    nameInput.value = routine?.name || "";
    searchInput.value = "";
    builderTitle.textContent = routine ? "루틴 수정" : "새 루틴 만들기";
    builder.classList.add("show");
    builder.setAttribute("aria-hidden", "false");
    renderBuilder();
    window.setTimeout(() => nameInput.focus(), 80);
  }

  function closeBuilder() {
    builder.classList.remove("show");
    builder.setAttribute("aria-hidden", "true");
    editingId = null;
    draftExercises = [];
  }

  function saveRoutine() {
    builder.querySelectorAll("[data-routine-param]").forEach((input) => updateDraftParameter(input, true));
    const name = nameInput.value.trim();
    const wasEditing = Boolean(editingId);

    if (!name) {
      nameInput.focus();
      showToast("루틴 이름을 입력해요.");
      return;
    }

    if (!draftExercises.length) {
      showToast("운동을 하나 이상 추가해요.");
      return;
    }

    const existingRoutine = routines.find((item) => item.id === editingId);
    const routine = {
      id: editingId || `routine-${Date.now()}`,
      dbId: existingRoutine?.dbId || 0,
      name,
      isFavorite: Boolean(existingRoutine?.isFavorite),
      exercises: draftExercises.map(normalizeRoutineExercise).filter(Boolean)
    };
    if (editingId) {
      routines = routines.map((item) => item.id === editingId ? routine : item);
    } else {
      routines.unshift(routine);
    }
    saveRoutines();
    renderRoutines();
    closeBuilder();
    showToast(wasEditing ? "루틴을 수정했어요." : "나만의 루틴을 저장했어요.");
  }

  function startRoutine(id) {
    const routine = routines.find((item) => item.id === id);
    if (!routine) {
      return;
    }

    const now = Date.now();
    const workouts = routine.exercises.map((item, index) => {
      const exercise = getExercise(item.exerciseId);
      return {
        id: `${exercise.id}-${now}-${index}`,
        exerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        restSeconds: item.restSeconds,
        sets: Array.from({ length: item.sets }, () => ({
          weight: item.weight,
          reps: item.reps,
          done: false
        }))
      };
    });

    writeJson("gmymateWorkoutLogsV2", workouts);
    window.dispatchEvent(new CustomEvent("gmymate:workouts-changed", { detail: { source: "routine-builder" } }));
    document.querySelector('nav.bottom-nav button[data-tab="log"]')?.click();
    showToast(`${routine.name} 루틴을 불러왔어요.`);
  }

  document.querySelectorAll("[data-new-routine]").forEach((button) => button.addEventListener("click", () => openBuilder()));
  list.addEventListener("click", (event) => {
    if (event.target.closest("[data-new-routine]")) {
      openBuilder();
      return;
    }
    const startButton = event.target.closest("[data-start-routine]");
    const editButton = event.target.closest("[data-edit-routine]");
    const deleteButton = event.target.closest("[data-delete-routine]");
    if (startButton) startRoutine(startButton.dataset.startRoutine);
    if (editButton) openBuilder(editButton.dataset.editRoutine);
    if (deleteButton) {
      routines = routines.filter((item) => item.id !== deleteButton.dataset.deleteRoutine);
      saveRoutines();
      renderRoutines();
      showToast("루틴을 삭제했어요.");
    }
  });

  builder.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-routine-builder]")) {
      closeBuilder();
      return;
    }
    const addButton = event.target.closest("[data-add-routine-exercise]");
    const removeButton = event.target.closest("[data-remove-routine-exercise]");
    const setButton = event.target.closest("[data-routine-set]");
    const moveButton = event.target.closest("[data-move-routine-exercise]");
    if (addButton && draftExercises.length < 12) {
      const exercise = getExercise(addButton.dataset.addRoutineExercise);
      if (exercise) {
        draftExercises.push(getRoutineExerciseDefaults(exercise));
        renderBuilder();
      }
    }
    if (removeButton) {
      draftExercises.splice(Number(removeButton.dataset.removeRoutineExercise), 1);
      renderBuilder();
    }
    if (setButton) {
      const [indexValue, amountValue] = setButton.dataset.routineSet.split(":");
      const item = draftExercises[Number(indexValue)];
      if (item) item.sets = Math.min(Math.max(item.sets + Number(amountValue), 1), 20);
      renderBuilder();
    }
    if (moveButton) {
      const [indexValue, directionValue] = moveButton.dataset.moveRoutineExercise.split(":");
      const index = Number(indexValue);
      const nextIndex = index + Number(directionValue);
      if (draftExercises[index] && draftExercises[nextIndex]) {
        [draftExercises[index], draftExercises[nextIndex]] = [draftExercises[nextIndex], draftExercises[index]];
        renderBuilder();
      }
    }
  });

  function updateDraftParameter(input, normalizeInput = false) {
    const [indexValue, field] = input.dataset.routineParam.split(":");
    const item = draftExercises[Number(indexValue)];
    const rule = routineParameterRules[field];

    if (!item || !rule || (!normalizeInput && input.value === "")) {
      return;
    }

    item[field] = normalizeRoutineNumber(input.value, rule.min, rule.max, item[field], rule.precision);
    if (normalizeInput) {
      input.value = formatRoutineNumber(item[field]);
    }
  }

  searchInput?.addEventListener("input", renderBuilder);
  builder.addEventListener("input", (event) => {
    const input = event.target.closest?.("[data-routine-param]");
    if (input) updateDraftParameter(input);
  });
  builder.addEventListener("change", (event) => {
    const input = event.target.closest?.("[data-routine-param]");
    if (input) updateDraftParameter(input, true);
  });
  saveButton?.addEventListener("click", saveRoutine);
  window.addEventListener("gainmuscle:routines-synced", (event) => {
    routines = normalizeRoutines(event.detail || []);
    writeJson("gmymateCustomRoutines", routines);
    renderRoutines();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && builder.classList.contains("show")) closeBuilder();
  });

  renderRoutines();
}

app.setupRoutines = setupRoutines;
})(window.Gmymate = window.Gmymate || {});
