(function attachWorkoutLog(app) {
const { exerciseCatalog, escapeHtml, readJson, showToast, writeJson } = app;

function setupWorkoutLog() {
  const list = document.querySelector("#logList");
  const summary = document.querySelector("#workoutSummary");
  const picker = document.querySelector("#exercisePicker");
  const search = document.querySelector("#exerciseSearch");
  const exerciseList = document.querySelector("#exerciseList");
  const recentSection = document.querySelector("#recentExerciseSection");
  const recentList = document.querySelector("#recentExerciseList");
  const clearButton = document.querySelector("[data-clear-logs]");
  const noteInput = document.querySelector("#workoutNote");
  const finishButton = document.querySelector("[data-finish-workout]");
  const restTimerDisplay = document.querySelector("#restTimerDisplay");
  const restTimerBar = document.querySelector("#restTimerBar");
  const restStatus = document.querySelector("#restStatus");

  if (!list || !picker || !exerciseList || !recentList) {
    return;
  }

  let workouts = readJson("gmymateWorkoutLogsV2", []);
  let recentExerciseIds = readJson("gmymateRecentExercises", ["bench-press", "squat", "lat-pulldown"]);
  const oldLogs = readJson("gmymateWorkoutLogs", []);
  let restIntervalId = null;
  let restTotalSeconds = 0;
  let restRemainingSeconds = 0;

  if (noteInput) {
    noteInput.value = readJson("gmymateWorkoutNote", "");
  }

  if (workouts.length === 0 && oldLogs.length > 0) {
    workouts = oldLogs.map((log) => {
      const exercise = exerciseCatalog.find((item) => item.name === log.exercise) || exerciseCatalog[0];
      const setCount = Math.max(Number(log.sets) || 1, 1);

      return {
        id: `migrated-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        exerciseId: exercise.id,
        name: log.exercise || exercise.name,
        category: exercise.category,
        sets: Array.from({ length: setCount }, () => ({
          weight: Number(log.weight) || exercise.weight,
          reps: Number(log.reps) || exercise.reps,
          done: false
        }))
      };
    });
  }

  function saveWorkouts() {
    writeJson("gmymateWorkoutLogsV2", workouts);
  }

  function saveRecentExercises() {
    writeJson("gmymateRecentExercises", recentExerciseIds);
  }

  function notifyWorkoutsChanged() {
    window.dispatchEvent(new CustomEvent("gmymate:workouts-changed"));
  }

  function getSettings() {
    return {
      weightStepKg: 1,
      restSeconds: 90,
      ...readJson("gmymateSettings", {})
    };
  }

  function getExercise(id) {
    return exerciseCatalog.find((exercise) => exercise.id === id) || exerciseCatalog[0];
  }

  function makeSets(exercise) {
    return Array.from({ length: exercise.sets }, () => ({
      weight: exercise.weight,
      reps: exercise.reps,
      done: false
    }));
  }

  function getWeightStep() {
    const step = Number(getSettings().weightStepKg);
    return step > 0 ? step : 1;
  }

  function getRestSeconds() {
    const seconds = Number(getSettings().restSeconds);
    return seconds > 0 ? seconds : 90;
  }

  function formatIncrement(value) {
    return Number(value).toFixed(1).replace(/\.0$/, "");
  }

  function getLastText(workout) {
    const firstSet = workout.sets[0] || { weight: 0, reps: 0 };
    const weightText = Number(firstSet.weight) > 0 ? `${firstSet.weight}kg` : "맨몸";
    const repsText = workout.exerciseId === "plank" ? `${firstSet.reps}초` : `${firstSet.reps}회`;
    return `Last ${weightText} · ${repsText}`;
  }

  function exerciseIcon(name) {
    const initial = escapeHtml(name.slice(0, 1));

    return `
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <rect x="3" y="3" width="38" height="38" rx="14"></rect>
        <path d="M12 22h20M9 16h5v12H9zm21 0h5v12h-5z"></path>
        <text x="22" y="29">${initial}</text>
      </svg>
    `;
  }

  function setSummary() {
    if (!summary) {
      return;
    }

    const { doneSets, totalSets } = getWorkoutStats();
    summary.textContent = workouts.length ? `운동 ${workouts.length}개 · ${doneSets}/${totalSets}세트` : "운동 0개";
  }

  function getWorkoutStats() {
    return workouts.reduce((stats, workout) => {
      workout.sets.forEach((set) => {
        stats.totalSets += 1;

        if (set.done) {
          stats.doneSets += 1;
          stats.volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
        }
      });

      return stats;
    }, { doneSets: 0, totalSets: 0, volume: 0 });
  }

  function renderWorkoutMetrics() {
    const { doneSets, totalSets, volume } = getWorkoutStats();
    const progress = document.querySelector("#workoutProgress");
    const volumeElement = document.querySelector("#workoutVolume");

    if (progress) {
      progress.textContent = `${doneSets}/${totalSets}`;
    }

    if (volumeElement) {
      volumeElement.textContent = `${Math.round(volume).toLocaleString("ko-KR")}kg`;
    }
  }

  function renderRestTimer() {
    const remaining = Math.max(restRemainingSeconds, 0);
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    const percent = restTotalSeconds ? ((restTotalSeconds - remaining) / restTotalSeconds) * 100 : 0;

    if (restTimerDisplay) {
      restTimerDisplay.textContent = `${minutes}:${seconds}`;
    }

    if (restTimerBar) {
      restTimerBar.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
    }

    if (restStatus) {
      restStatus.textContent = restIntervalId ? `${minutes}:${seconds}` : "대기";
    }
  }

  function stopRestTimer(message) {
    window.clearInterval(restIntervalId);
    restIntervalId = null;
    restTotalSeconds = 0;
    restRemainingSeconds = 0;
    renderRestTimer();

    if (message) {
      showToast(message);
    }
  }

  function startRestTimer(seconds = getRestSeconds()) {
    restTotalSeconds = Math.max(Number(seconds) || getRestSeconds(), 1);
    restRemainingSeconds = restTotalSeconds;
    window.clearInterval(restIntervalId);
    restIntervalId = window.setInterval(() => {
      restRemainingSeconds -= 1;
      renderRestTimer();

      if (restRemainingSeconds <= 0) {
        stopRestTimer("휴식 끝! 다음 세트 가요.");
      }
    }, 1000);
    renderRestTimer();
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function finishWorkout() {
    const stats = getWorkoutStats();

    if (stats.totalSets === 0) {
      showToast("먼저 운동을 추가해요.");
      return;
    }

    const now = new Date();
    const history = readJson("gmymateWorkoutHistory", []);
    const note = noteInput?.value.trim() || "";

    history.unshift({
      id: `session-${Date.now()}`,
      title: workouts.map((workout) => workout.name).slice(0, 2).join(", ") || "운동 기록",
      dateKey: getDateKey(now),
      finishedAt: now.toISOString(),
      exerciseCount: workouts.length,
      doneSets: stats.doneSets,
      totalSets: stats.totalSets,
      volume: Math.round(stats.volume),
      note,
      workouts
    });

    writeJson("gmymateWorkoutHistory", history.slice(0, 80));
    workouts = [];
    writeJson("gmymateWorkoutLogsV2", workouts);
    writeJson("gmymateWorkoutNote", "");

    if (noteInput) {
      noteInput.value = "";
    }

    stopRestTimer();
    renderLogs();
    notifyWorkoutsChanged();
    showToast("운동 기록을 저장했어요.");
  }

  function renderLogs() {
    setSummary();
    renderWorkoutMetrics();

    if (workouts.length === 0) {
      list.innerHTML = `
        <button class="empty-log-card" type="button" data-open-exercise-picker>
          <strong>아직 기록이 없어요.</strong>
          <span>운동 추가를 눌러 오늘 할 운동을 골라보세요.</span>
        </button>
      `;
      return;
    }

    const weightStep = getWeightStep();
    const bigWeightStep = weightStep * 5;

    list.innerHTML = workouts.map((workout) => `
      <article class="exercise-log-card" data-workout-id="${escapeHtml(workout.id)}">
        <header class="exercise-card-header">
          <div class="exercise-avatar">${exerciseIcon(workout.name)}</div>
          <div class="exercise-title-block">
            <strong>${escapeHtml(workout.name)}</strong>
            <span>${escapeHtml(getLastText(workout))}</span>
          </div>
          <div class="exercise-actions">
            <button class="icon-button" type="button" data-add-set="${escapeHtml(workout.id)}" aria-label="세트 추가">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
            </button>
            <button class="icon-button" type="button" data-remove-workout="${escapeHtml(workout.id)}" aria-label="운동 삭제">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10l-.6 14H7.6Zm2-3h6l1 2H8Zm1 6v8h2V9Zm4 0v8h2V9Z"/></svg>
            </button>
          </div>
        </header>

        <div class="set-count-row">
          <button type="button" data-remove-set="${escapeHtml(workout.id)}">-</button>
          <strong>${workout.sets.length}</strong>
          <button type="button" data-add-set="${escapeHtml(workout.id)}">+</button>
        </div>

        <div class="set-row-list">
          ${workout.sets.map((set, index) => `
            <div class="set-row ${set.done ? "is-done" : ""}" data-set-index="${index}">
              <span class="set-number">${index + 1}</span>
              <div class="set-input-control weight-control">
                <input class="set-field" data-field="weight" type="number" min="0" step="${escapeHtml(weightStep)}" value="${escapeHtml(set.weight)}" aria-label="${index + 1}세트 무게">
                <span class="set-quick-buttons weight-quick-buttons" aria-label="${index + 1}세트 무게 빠른 조절">
                  <button class="set-quick-button decrease" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:weight:${-bigWeightStep}" aria-label="${index + 1}세트 무게 ${formatIncrement(bigWeightStep)}kg 빼기">-${formatIncrement(bigWeightStep)}</button>
                  <button class="set-quick-button decrease" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:weight:${-weightStep}" aria-label="${index + 1}세트 무게 ${formatIncrement(weightStep)}kg 빼기">-${formatIncrement(weightStep)}</button>
                  <button class="set-quick-button" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:weight:${weightStep}" aria-label="${index + 1}세트 무게 ${formatIncrement(weightStep)}kg 추가">+${formatIncrement(weightStep)}</button>
                  <button class="set-quick-button" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:weight:${bigWeightStep}" aria-label="${index + 1}세트 무게 ${formatIncrement(bigWeightStep)}kg 추가">+${formatIncrement(bigWeightStep)}</button>
                </span>
                <span class="set-unit">kg</span>
              </div>
              <div class="set-input-control reps-control">
                <input class="set-field" data-field="reps" type="number" min="1" step="1" value="${escapeHtml(set.reps)}" aria-label="${index + 1}세트 횟수">
                <span class="set-quick-buttons" aria-label="${index + 1}세트 횟수 빠른 추가">
                  <button class="set-quick-button" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:reps:1" aria-label="${index + 1}세트 횟수 1회 추가">+1</button>
                  <button class="set-quick-button" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:reps:5" aria-label="${index + 1}세트 횟수 5회 추가">+5</button>
                </span>
                <span class="set-unit">${workout.exerciseId === "plank" ? "초" : "회"}</span>
              </div>
              <button class="set-check" type="button" data-toggle-set="${escapeHtml(workout.id)}:${index}" aria-label="${index + 1}세트 완료">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.7 15.5 7-7 1.4 1.4-8.4 8.4-4.1-4.1L7 12.8Z"/></svg>
              </button>
            </div>
          `).join("")}
        </div>
      </article>
    `).join("");
  }

  function renderExercisePicker() {
    const keyword = search?.value.trim().toLowerCase() || "";
    const recentExercises = recentExerciseIds.map(getExercise).filter(Boolean).slice(0, 4);
    const filtered = exerciseCatalog.filter((exercise) => {
      const haystack = `${exercise.name} ${exercise.category}`.toLowerCase();
      return haystack.includes(keyword);
    });

    recentSection.hidden = keyword.length > 0 || recentExercises.length === 0;
    recentList.innerHTML = recentExercises.map((exercise) => `
      <button class="exercise-chip" type="button" data-select-exercise="${exercise.id}">
        ${exerciseIcon(exercise.name)}
        <span>${escapeHtml(exercise.name)}</span>
      </button>
    `).join("");

    exerciseList.innerHTML = filtered.length ? filtered.map((exercise) => `
      <button class="exercise-option" type="button" data-select-exercise="${exercise.id}">
        <span class="exercise-avatar">${exerciseIcon(exercise.name)}</span>
        <span>
          <strong>${escapeHtml(exercise.name)}</strong>
          <small>${escapeHtml(exercise.category)} · 기본 ${exercise.weight ? `${exercise.weight}kg` : "맨몸"} · ${exercise.reps}${exercise.id === "plank" ? "초" : "회"}</small>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6Z"/></svg>
      </button>
    `).join("") : `
      <div class="exercise-empty">검색 결과가 없어요.</div>
    `;
  }

  function openPicker() {
    picker.classList.add("show");
    picker.setAttribute("aria-hidden", "false");
    renderExercisePicker();
    window.setTimeout(() => search?.focus(), 80);
  }

  function closePicker() {
    picker.classList.remove("show");
    picker.setAttribute("aria-hidden", "true");
    if (search) {
      search.value = "";
    }
  }

  function addExercise(id) {
    const exercise = getExercise(id);
    workouts.unshift({
      id: `${exercise.id}-${Date.now()}`,
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      sets: makeSets(exercise)
    });
    workouts = workouts.slice(0, 12);
    recentExerciseIds = [exercise.id, ...recentExerciseIds.filter((recentId) => recentId !== exercise.id)].slice(0, 6);
    saveWorkouts();
    saveRecentExercises();
    renderLogs();
    notifyWorkoutsChanged();
    closePicker();
    showToast(`${exercise.name}을 추가했어요.`);
  }

  document.querySelectorAll("[data-open-exercise-picker]").forEach((button) => {
    button.addEventListener("click", openPicker);
  });

  picker.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-exercise-picker]");
    const exerciseButton = event.target.closest("[data-select-exercise]");

    if (closeButton) {
      closePicker();
    }

    if (exerciseButton) {
      addExercise(exerciseButton.dataset.selectExercise);
    }
  });

  search?.addEventListener("input", renderExercisePicker);

  document.querySelectorAll("[data-start-rest]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.startRest;
      startRestTimer(value === "settings" ? getRestSeconds() : Number(value));
      showToast("휴식 타이머를 시작했어요.");
    });
  });

  document.querySelector("[data-reset-rest]")?.addEventListener("click", () => {
    stopRestTimer("휴식 타이머를 멈췄어요.");
  });

  noteInput?.addEventListener("input", () => {
    writeJson("gmymateWorkoutNote", noteInput.value);
  });

  finishButton?.addEventListener("click", finishWorkout);

  window.addEventListener("gmymate:settings-changed", () => {
    renderLogs();
    renderRestTimer();
  });

  list.addEventListener("click", (event) => {
    const addSetButton = event.target.closest("[data-add-set]");
    const removeSetButton = event.target.closest("[data-remove-set]");
    const removeWorkoutButton = event.target.closest("[data-remove-workout]");
    const toggleSetButton = event.target.closest("[data-toggle-set]");
    const adjustSetButton = event.target.closest("[data-adjust-set]");
    const openPickerButton = event.target.closest("[data-open-exercise-picker]");

    if (openPickerButton) {
      openPicker();
      return;
    }

    if (adjustSetButton) {
      const [workoutId, indexValue, field, amountValue] = adjustSetButton.dataset.adjustSet.split(":");
      const workout = workouts.find((item) => item.id === workoutId);
      const set = workout?.sets[Number(indexValue)];
      const amount = Number(amountValue);

      if (set && Number.isFinite(amount) && ["weight", "reps"].includes(field)) {
        const currentValue = Number(set[field]) || 0;
        const nextValue = currentValue + amount;
        set[field] = field === "weight" ? Math.max(0, Number(nextValue.toFixed(1))) : Math.max(1, Math.round(nextValue));
        saveWorkouts();
        renderLogs();
        notifyWorkoutsChanged();
      }
      return;
    }

    if (addSetButton) {
      const workout = workouts.find((item) => item.id === addSetButton.dataset.addSet);
      const lastSet = workout?.sets.at(-1) || { weight: 0, reps: 10, done: false };
      workout?.sets.push({ ...lastSet, done: false });
      saveWorkouts();
      renderLogs();
      notifyWorkoutsChanged();
      return;
    }

    if (removeSetButton) {
      const workout = workouts.find((item) => item.id === removeSetButton.dataset.removeSet);
      if (workout && workout.sets.length > 1) {
        workout.sets.pop();
        saveWorkouts();
        renderLogs();
        notifyWorkoutsChanged();
      }
      return;
    }

    if (removeWorkoutButton) {
      workouts = workouts.filter((item) => item.id !== removeWorkoutButton.dataset.removeWorkout);
      saveWorkouts();
      renderLogs();
      notifyWorkoutsChanged();
      showToast("운동을 지웠어요.");
      return;
    }

    if (toggleSetButton) {
      const [workoutId, indexValue] = toggleSetButton.dataset.toggleSet.split(":");
      const workout = workouts.find((item) => item.id === workoutId);
      const set = workout?.sets[Number(indexValue)];

      if (set) {
        set.done = !set.done;
        saveWorkouts();
        renderLogs();
        notifyWorkoutsChanged();

        if (set.done) {
          startRestTimer();
        }

        showToast(set.done ? "세트 완료!" : "완료를 해제했어요.");
      }
    }
  });

  list.addEventListener("change", (event) => {
    const input = event.target.closest(".set-field");

    if (!input) {
      return;
    }

    const card = input.closest("[data-workout-id]");
    const row = input.closest("[data-set-index]");
    const workout = workouts.find((item) => item.id === card?.dataset.workoutId);
    const set = workout?.sets[Number(row?.dataset.setIndex)];

    if (!set) {
      return;
    }

    set[input.dataset.field] = Number(input.value) || 0;
    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
  });

  clearButton?.addEventListener("click", () => {
    workouts = [];
    writeJson("gmymateWorkoutLogsV2", workouts);
    writeJson("gmymateWorkoutLogs", []);
    writeJson("gmymateWorkoutNote", "");
    if (noteInput) {
      noteInput.value = "";
    }
    stopRestTimer();
    renderLogs();
    notifyWorkoutsChanged();
    showToast("오늘 기록을 비웠어요.");
  });

  renderLogs();
  renderRestTimer();
}

app.setupWorkoutLog = setupWorkoutLog;
})(window.Gmymate = window.Gmymate || {});
