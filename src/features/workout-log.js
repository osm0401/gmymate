(function attachWorkoutLog(app) {
const {
  createSetsFromPrevious,
  exerciseCatalog,
  escapeHtml,
  findPreviousExerciseWorkout,
  getPreviousCompletedSets,
  readJson,
  showToast,
  writeJson
} = app;
const { formatNumber, formatTime, formatSavedTime, exerciseIcon } = app.workoutLogUtils;

function setupWorkoutLog() {
  const list = document.querySelector("#logList");
  const summary = document.querySelector("#workoutSummary");
  const picker = document.querySelector("#exercisePicker");
  const search = document.querySelector("#exerciseSearch");
  const exerciseList = document.querySelector("#exerciseList");
  const categoryList = document.querySelector("#exerciseCategoryList");
  const recentSection = document.querySelector("#recentExerciseSection");
  const recentList = document.querySelector("#recentExerciseList");
  const selectionCount = document.querySelector("#exerciseSelectionCount");
  const addSelectedButton = document.querySelector("[data-add-selected-exercises]");
  const replacementPicker = document.querySelector("#exerciseReplacementPicker");
  const replacementSearch = document.querySelector("#replacementExerciseSearch");
  const replacementList = document.querySelector("#replacementExerciseList");
  const replacementTitle = document.querySelector("#replacementPickerTitle");
  const replacementCategoryLabel = document.querySelector("#replacementCategoryLabel");
  const clearButton = document.querySelector("[data-clear-logs]");
  const noteInput = document.querySelector("#workoutNote");
  const finishButton = document.querySelector("[data-finish-workout]");
  const recoveryBanner = document.querySelector("#workoutRecoveryBanner");
  const recoveryTitle = document.querySelector("#workoutRecoveryTitle");
  const recoveryDetail = document.querySelector("#workoutRecoveryDetail");
  const saveStatus = document.querySelector("#workoutSaveStatus");
  const timerDock = document.querySelector("#workoutTimerDock");
  const timerModeLabel = document.querySelector("#timerModeLabel");
  const timerDisplay = document.querySelector("#restTimerDisplay");
  const timerBar = document.querySelector("#restTimerBar");
  const restStatus = document.querySelector("#restStatus");
  const addRestButton = document.querySelector("[data-add-rest]");
  const skipRestButton = document.querySelector("[data-skip-rest]");
  const nextSetButton = document.querySelector("[data-open-next-set]");
  const editor = document.querySelector("#setEditor");
  const editorExercise = document.querySelector("#setEditorExercise");
  const editorTitle = document.querySelector("#setEditorTitle");
  const editorWeight = document.querySelector("#setEditorWeight");
  const editorReps = document.querySelector("#setEditorReps");
  const editorUnit = document.querySelector("#setEditorUnit");
  const weightAdjustGrid = document.querySelector("#weightAdjustGrid");
  const previousSetSuggestion = document.querySelector("#previousSetSuggestion");
  const previousSetValue = document.querySelector("#previousSetValue");
  const completeSetButton = document.querySelector("[data-complete-active-set]");

  if (!list || !picker || !exerciseList || !recentList || !editor) {
    return;
  }

  let workouts = normalizeWorkouts(readJson("gmymateWorkoutLogsV2", []));
  let recentExerciseIds = readJson("gmymateRecentExercises", ["bench-press", "squat", "lat-pulldown"]);
  const oldLogs = readJson("gmymateWorkoutLogs", []);
  const selectedExerciseIds = new Set();
  let selectedCategory = "전체";
  let activeEditor = null;
  let replacementWorkoutId = null;
  let dragState = null;
  let timerIntervalId = null;
  let restCompletionTimeoutId = null;
  let audioContext = null;
  let timerState = restoreTimerState();
  let activeWorkoutMeta = readJson("gmymateActiveWorkoutV1", {});
  let showRecoveryBanner = Boolean(workouts.length && activeWorkoutMeta.updatedAt);

  if (noteInput) {
    noteInput.value = readJson("gmymateWorkoutNote", "");
  }

  if (workouts.length === 0 && oldLogs.length > 0) {
    workouts = oldLogs.map((log, index) => {
      const exercise = exerciseCatalog.find((item) => item.name === log.exercise) || exerciseCatalog[0];
      const setCount = Math.max(Number(log.sets) || 1, 1);

      return {
        id: `migrated-${Date.now()}-${index}`,
        exerciseId: exercise.id,
        name: log.exercise || exercise.name,
        category: exercise.category,
        restSeconds: getRestSeconds(),
        sets: Array.from({ length: setCount }, () => ({
          weight: Number(log.weight) || exercise.weight,
          reps: Number(log.reps) || exercise.reps,
          done: false
        }))
      };
    });
    saveWorkouts();
  }

  function normalizeWorkouts(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((workout, workoutIndex) => {
      const exercise = exerciseCatalog.find((item) => item.id === workout.exerciseId) || exerciseCatalog[0];
      const sets = Array.isArray(workout.sets) && workout.sets.length ? workout.sets : makeSets(exercise);

      return {
        id: workout.id || `${exercise.id}-${Date.now()}-${workoutIndex}`,
        exerciseId: workout.exerciseId || exercise.id,
        name: workout.name || exercise.name,
        category: workout.category || exercise.category,
        restSeconds: getWorkoutRestSeconds(workout),
        sets: sets.map((set) => ({
          weight: Math.max(Number(set.weight) || 0, 0),
          reps: Math.max(Math.round(Number(set.reps) || exercise.reps || 1), 1),
          done: Boolean(set.done)
        }))
      };
    });
  }

  function saveWorkouts(syncCloud = true) {
    writeJson("gmymateWorkoutLogsV2", workouts);

    if (workouts.length) {
      activeWorkoutMeta = {
        startedAt: Number(activeWorkoutMeta.startedAt) || Date.now(),
        updatedAt: Date.now(),
        exerciseCount: workouts.length,
        completedSets: getWorkoutStats().doneSets
      };
      writeJson("gmymateActiveWorkoutV1", activeWorkoutMeta);
    } else {
      activeWorkoutMeta = {};
      localStorage.removeItem("gmymateActiveWorkoutV1");
    }

    if (syncCloud) {
      app.cloudSync?.scheduleActiveWorkout({
        workouts,
        note: noteInput?.value.trim() || "",
        meta: activeWorkoutMeta
      });
    }

    renderSaveStatus();
  }

  function saveRecentExercises() {
    writeJson("gmymateRecentExercises", recentExerciseIds);
  }

  function notifyWorkoutsChanged() {
    window.dispatchEvent(new CustomEvent("gmymate:workouts-changed", { detail: { source: "workout-log" } }));
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

  function getUnit(exerciseId) {
    return getExercise(exerciseId).unit || "회";
  }

  function makeSets(exercise) {
    return createSetsFromPrevious(exercise, exercise.sets);
  }

  function getWeightStep() {
    const step = Number(getSettings().weightStepKg);
    return step > 0 ? step : 1;
  }

  function getRestSeconds() {
    const seconds = Number(getSettings().restSeconds);
    return seconds > 0 ? seconds : 90;
  }

  function getWorkoutRestSeconds(workout) {
    const seconds = Number(workout?.restSeconds);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return getRestSeconds();
    }

    return Math.min(Math.max(Math.round(seconds), 15), 600);
  }

  function renderSaveStatus() {
    if (!saveStatus) {
      return;
    }

    saveStatus.textContent = workouts.length && activeWorkoutMeta.updatedAt
      ? `자동 저장됨 · ${formatSavedTime(activeWorkoutMeta.updatedAt)}`
      : "자동 저장 준비";
  }

  function renderRecoveryBanner() {
    if (!recoveryBanner) {
      return;
    }

    const stats = getWorkoutStats();
    const remaining = Math.max(stats.totalSets - stats.doneSets, 0);
    recoveryBanner.hidden = !showRecoveryBanner || workouts.length === 0;

    if (!recoveryBanner.hidden) {
      recoveryTitle.textContent = "이전 운동을 복구했어요.";
      recoveryDetail.textContent = `${workouts.length}개 운동 · 남은 세트 ${remaining}개 · ${formatSavedTime(activeWorkoutMeta.updatedAt)} 저장`;
    }
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

    if (summary) {
      summary.textContent = workouts.length ? `운동 ${workouts.length}개 · ${doneSets}/${totalSets}세트` : "운동 0개";
    }

    if (progress) {
      progress.textContent = `${doneSets}/${totalSets}`;
    }

    if (volumeElement) {
      volumeElement.textContent = `${Math.round(volume).toLocaleString("ko-KR")}kg`;
    }
  }

  function restoreTimerState() {
    const saved = readJson("gmymateTimerState", {});
    const mode = ["set", "rest"].includes(saved.mode) ? saved.mode : "idle";
    const restored = {
      mode,
      setStartedAt: Number(saved.setStartedAt) || 0,
      restEndsAt: Number(saved.restEndsAt) || 0,
      restTotalSeconds: Number(saved.restTotalSeconds) || getRestSeconds()
    };

    if (restored.mode === "set" && !restored.setStartedAt) {
      restored.setStartedAt = Date.now();
    }

    return restored;
  }

  function saveTimerState() {
    writeJson("gmymateTimerState", timerState);
  }

  function ensureTimerInterval() {
    window.clearInterval(timerIntervalId);
    window.clearTimeout(restCompletionTimeoutId);
    timerIntervalId = timerState.mode === "idle" ? null : window.setInterval(renderTimer, 500);
    restCompletionTimeoutId = null;

    if (timerState.mode === "rest") {
      const delay = Math.max(timerState.restEndsAt - Date.now(), 0);
      restCompletionTimeoutId = window.setTimeout(finishRest, delay);
    }
  }

  function startSetTimer() {
    timerState = {
      mode: "set",
      setStartedAt: Date.now(),
      restEndsAt: 0,
      restTotalSeconds: getRestSeconds()
    };
    saveTimerState();
    ensureTimerInterval();
    renderTimer();
  }

  function startRestTimer(seconds = getRestSeconds()) {
    const total = Math.max(Math.round(Number(seconds) || getRestSeconds()), 1);
    primeRestAlert();
    timerState = {
      mode: "rest",
      setStartedAt: 0,
      restEndsAt: Date.now() + total * 1000,
      restTotalSeconds: total
    };
    saveTimerState();
    ensureTimerInterval();
    renderTimer();
  }

  function stopTimer() {
    window.clearInterval(timerIntervalId);
    window.clearTimeout(restCompletionTimeoutId);
    timerIntervalId = null;
    restCompletionTimeoutId = null;
    timerState = {
      mode: "idle",
      setStartedAt: 0,
      restEndsAt: 0,
      restTotalSeconds: getRestSeconds()
    };
    saveTimerState();
    renderTimer();
  }

  function finishRest() {
    if (timerState.mode !== "rest") {
      return;
    }

    const nextSet = getNextSetLabel();
    startSetTimer();
    timerDock?.classList.add("is-rest-complete");
    window.setTimeout(() => timerDock?.classList.remove("is-rest-complete"), 1400);

    if (getSettings().workoutAlert) {
      navigator.vibrate?.([180, 90, 180, 90, 240]);
      playRestCompleteSound();
      showRestCompleteNotification(nextSet);
    }

    showToast(nextSet ? `휴식 끝! ${nextSet}를 시작해요.` : "휴식 끝! 오늘 세트를 모두 완료했어요.");
  }

  function primeRestAlert() {
    if (!getSettings().workoutAlert) {
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    audioContext ||= new AudioContext();
    audioContext.resume?.();
  }

  function playRestCompleteSound() {
    if (!audioContext) {
      return;
    }

    try {
      const now = audioContext.currentTime;
      [0, 0.18].forEach((offset, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = index ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.17);
      });
    } catch {
      // The visual timer and vibration remain available if audio is blocked.
    }
  }

  function showRestCompleteNotification(nextSet) {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) {
      return;
    }

    try {
      new Notification("GAINMUSCLE · 휴식 끝", {
        body: nextSet ? `${nextSet}를 시작할 차례예요.` : "오늘 세트를 모두 완료했어요.",
        tag: "gmymate-rest-complete"
      });
    } catch {
      // Some mobile browsers only allow notifications through a service worker.
    }
  }

  function getNextSetLabel() {
    for (const workout of workouts) {
      const setIndex = workout.sets.findIndex((set) => !set.done);
      if (setIndex >= 0) {
        return `${workout.name} ${setIndex + 1}세트`;
      }
    }
    return "";
  }

  function renderTimer() {
    let displaySeconds = 0;
    let progress = 0;

    if (timerState.mode === "rest") {
      displaySeconds = Math.max(Math.ceil((timerState.restEndsAt - Date.now()) / 1000), 0);

      if (displaySeconds <= 0) {
        finishRest();
        return;
      }

      progress = ((timerState.restTotalSeconds - displaySeconds) / timerState.restTotalSeconds) * 100;
    } else if (timerState.mode === "set") {
      displaySeconds = Math.max(Math.floor((Date.now() - timerState.setStartedAt) / 1000), 0);
    }

    if (timerDock) {
      timerDock.dataset.mode = timerState.mode;
    }

    if (timerModeLabel) {
      timerModeLabel.textContent = timerState.mode === "rest" ? "휴식" : timerState.mode === "set" ? "세트" : "준비";
    }

    if (timerDisplay) {
      timerDisplay.textContent = formatTime(displaySeconds);
    }

    if (timerBar) {
      timerBar.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
    }

    if (restStatus) {
      restStatus.textContent = timerState.mode === "rest" ? formatTime(displaySeconds) : timerState.mode === "set" ? "세트" : "대기";
    }

    if (addRestButton) {
      addRestButton.hidden = timerState.mode !== "rest";
    }

    if (skipRestButton) {
      skipRestButton.hidden = timerState.mode !== "rest";
    }

    if (nextSetButton) {
      nextSetButton.hidden = timerState.mode === "rest";
    }
  }

  function getSetSummary(workout, set) {
    const unit = getUnit(workout.exerciseId);
    const weightText = Number(set.weight) > 0 ? `${formatNumber(set.weight)}kg` : "맨몸";

    if (unit === "분") {
      return `${formatNumber(set.reps)}분`;
    }

    return `${weightText} × ${formatNumber(set.reps)}${unit}`;
  }

  function getPreviousSet(workout, setIndex) {
    const previousSets = getPreviousCompletedSets(workout.exerciseId);
    return previousSets[setIndex] || previousSets.at(-1) || null;
  }

  function getPreviousWorkoutLabel(workout) {
    const previous = findPreviousExerciseWorkout(workout.exerciseId);
    const previousSets = getPreviousCompletedSets(workout.exerciseId);

    if (!previous || !previousSets.length) {
      return "지난 기록 없음";
    }

    const date = new Date(previous.session.finishedAt || `${previous.session.dateKey}T12:00:00`);
    const dateLabel = Number.isNaN(date.getTime()) ? "최근" : `${date.getMonth() + 1}/${date.getDate()}`;
    return `지난 ${dateLabel} · ${getSetSummary(workout, previousSets[0])}`;
  }

  function renderLogs() {
    renderWorkoutMetrics();
    renderRecoveryBanner();
    renderSaveStatus();

    if (workouts.length === 0) {
      list.innerHTML = `
        <button class="empty-log-card" type="button" data-open-exercise-picker>
          <strong>아직 기록이 없어요.</strong>
          <span>운동 추가를 눌러 오늘 할 운동을 골라보세요.</span>
        </button>
      `;
      return;
    }

    list.innerHTML = workouts.map((workout) => {
      const doneSets = workout.sets.filter((set) => set.done).length;

      return `
        <article class="exercise-log-card" data-workout-id="${escapeHtml(workout.id)}">
          <header class="exercise-card-header compact">
            <button class="drag-handle" type="button" data-drag-workout="${escapeHtml(workout.id)}" aria-label="${escapeHtml(workout.name)} 순서 변경. 위아래 방향키 사용 가능">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8v2H8zm0 4h8v2H8zm0 4h8v2H8z"/></svg>
            </button>
            <div class="exercise-avatar compact-avatar">${exerciseIcon(workout.name)}</div>
            <div class="exercise-title-block">
              <strong>${escapeHtml(workout.name)}</strong>
              <span>${escapeHtml(workout.category)} · ${doneSets}/${workout.sets.length} 완료</span>
            </div>
            <div class="compact-card-actions">
              <div class="set-count-control" aria-label="${escapeHtml(workout.name)} 세트 수">
                <button type="button" data-remove-set="${escapeHtml(workout.id)}" aria-label="세트 줄이기" ${workout.sets.length <= 1 ? "disabled" : ""}>−</button>
                <strong>${workout.sets.length}</strong>
                <button type="button" data-add-set="${escapeHtml(workout.id)}" aria-label="세트 추가">+</button>
              </div>
              <button class="delete-workout-button" type="button" data-remove-workout="${escapeHtml(workout.id)}" aria-label="${escapeHtml(workout.name)} 삭제">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10l-.6 14H7.6Zm2-3h6l1 2H8Zm1 6v8h2V9Zm4 0v8h2V9Z"/></svg>
              </button>
            </div>
          </header>

          <div class="exercise-card-context">
            <span>${escapeHtml(getPreviousWorkoutLabel(workout))}</span>
            <button type="button" data-replace-workout="${escapeHtml(workout.id)}" ${doneSets ? "disabled" : ""} title="${doneSets ? "완료한 세트가 있어 바꿀 수 없어요." : "같은 부위의 다른 운동으로 바꾸기"}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10.2l-2.6-2.6L16 3l5 5-5 5-1.4-1.4L17.2 9H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5Zm10 10H6.8l2.6 2.6L8 21l-5-5 5-5 1.4 1.4L6.8 15H17a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5Z"/></svg>
              바꾸기
            </button>
          </div>

          <div class="set-summary-list">
            ${workout.sets.map((set, index) => {
              const previousSet = getPreviousSet(workout, index);
              return `
              <div class="set-summary-row ${set.done ? "is-done" : ""}">
                <button class="set-summary-edit" type="button" data-edit-set="${escapeHtml(workout.id)}:${index}" aria-label="${escapeHtml(workout.name)} ${index + 1}세트 수정, ${escapeHtml(getSetSummary(workout, set))}">
                  <span class="set-number">${index + 1}</span>
                  <span class="set-summary-value">
                    <strong>${escapeHtml(getSetSummary(workout, set))}</strong>
                    <small>${set.done ? "완료됨" : previousSet ? `지난 ${escapeHtml(getSetSummary(workout, previousSet))}` : "눌러서 수정"}</small>
                  </span>
                </button>
                <button class="set-summary-check" type="button" data-toggle-set="${escapeHtml(workout.id)}:${index}" aria-pressed="${set.done}" aria-label="${escapeHtml(workout.name)} ${index + 1}세트 ${set.done ? "완료 해제" : "완료"}">
                  <span aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="m9.7 15.5 7-7 1.4 1.4-8.4 8.4-4.1-4.1L7 12.8Z"/></svg>
                  </span>
                </button>
              </div>
            `;
            }).join("")}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderExercisePicker() {
    const keyword = search?.value.trim().toLowerCase() || "";
    const categories = ["전체", ...new Set(exerciseCatalog.map((exercise) => exercise.category))];
    const addedIds = new Set(workouts.map((workout) => workout.exerciseId));
    const recentExercises = recentExerciseIds.map(getExercise).filter((exercise) => !addedIds.has(exercise.id)).slice(0, 5);
    const filtered = exerciseCatalog.filter((exercise) => {
      const matchesCategory = selectedCategory === "전체" || exercise.category === selectedCategory;
      const haystack = `${exercise.name} ${exercise.category}`.toLowerCase();
      return matchesCategory && haystack.includes(keyword);
    });

    if (categoryList) {
      categoryList.innerHTML = categories.map((category) => `
        <button type="button" data-filter-category="${escapeHtml(category)}" aria-pressed="${category === selectedCategory}">${escapeHtml(category)}</button>
      `).join("");
    }

    recentSection.hidden = keyword.length > 0 || recentExercises.length === 0;
    recentList.innerHTML = recentExercises.map((exercise) => {
      const selected = selectedExerciseIds.has(exercise.id);
      return `
        <button class="exercise-chip ${selected ? "selected" : ""}" type="button" data-select-exercise="${exercise.id}" aria-pressed="${selected}">
          ${exerciseIcon(exercise.name)}
          <span>${escapeHtml(exercise.name)}</span>
        </button>
      `;
    }).join("");

    exerciseList.innerHTML = filtered.length ? filtered.map((exercise) => {
      const selected = selectedExerciseIds.has(exercise.id);
      const added = addedIds.has(exercise.id);
      const unit = exercise.unit || "회";
      return `
        <button class="exercise-option ${selected ? "selected" : ""} ${added ? "already-added" : ""}" type="button" data-select-exercise="${exercise.id}" aria-pressed="${selected}" ${added ? "disabled" : ""}>
          <span class="exercise-avatar">${exerciseIcon(exercise.name)}</span>
          <span>
            <strong>${escapeHtml(exercise.name)}</strong>
            <small>${escapeHtml(exercise.category)} · ${exercise.weight ? `${exercise.weight}kg · ` : ""}${exercise.reps}${unit}</small>
          </span>
          <span class="exercise-select-check" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="m9.7 15.5 7-7 1.4 1.4-8.4 8.4-4.1-4.1L7 12.8Z"/></svg>
          </span>
        </button>
      `;
    }).join("") : `<div class="exercise-empty">검색 결과가 없어요.</div>`;

    if (selectionCount) {
      selectionCount.textContent = `${selectedExerciseIds.size}개 선택`;
    }

    if (addSelectedButton) {
      addSelectedButton.disabled = selectedExerciseIds.size === 0;
      addSelectedButton.textContent = selectedExerciseIds.size ? `${selectedExerciseIds.size}개 운동 추가` : "선택한 운동 추가";
    }
  }

  function openPicker() {
    selectedExerciseIds.clear();
    selectedCategory = "전체";
    picker.classList.add("show");
    picker.setAttribute("aria-hidden", "false");
    renderExercisePicker();
    window.setTimeout(() => search?.focus(), 80);
  }

  function closePicker() {
    picker.classList.remove("show");
    picker.setAttribute("aria-hidden", "true");
    selectedExerciseIds.clear();
    selectedCategory = "전체";
    if (search) {
      search.value = "";
    }
  }

  function toggleExerciseSelection(id) {
    if (workouts.some((workout) => workout.exerciseId === id)) {
      return;
    }

    if (selectedExerciseIds.has(id)) {
      selectedExerciseIds.delete(id);
    } else {
      selectedExerciseIds.add(id);
    }
    renderExercisePicker();
  }

  function addSelectedExercises() {
    const availableSlots = Math.max(12 - workouts.length, 0);
    const ids = [...selectedExerciseIds].slice(0, availableSlots);

    if (!ids.length) {
      showToast(availableSlots ? "추가할 운동을 선택해요." : "운동은 최대 12개까지 기록할 수 있어요.");
      return;
    }

    const addedAt = Date.now();
    const wasEmpty = workouts.length === 0;
    ids.forEach((id, index) => {
      const exercise = getExercise(id);
      workouts.push({
        id: `${exercise.id}-${addedAt}-${index}`,
        exerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        restSeconds: getRestSeconds(),
        sets: makeSets(exercise)
      });
    });

    recentExerciseIds = [...ids.reverse(), ...recentExerciseIds.filter((id) => !selectedExerciseIds.has(id))].slice(0, 8);
    showRecoveryBanner = false;
    saveWorkouts();
    saveRecentExercises();
    renderLogs();
    notifyWorkoutsChanged();
    closePicker();
    if (wasEmpty && timerState.mode === "idle") {
      startSetTimer();
    }
    showToast(`${ids.length}개 운동을 추가했어요.`);
  }

  function openReplacementPicker(workoutId) {
    const workout = workouts.find((item) => item.id === workoutId);

    if (!workout) {
      return;
    }

    if (workout.sets.some((set) => set.done)) {
      showToast("완료한 세트가 있는 운동은 바꿀 수 없어요.");
      return;
    }

    replacementWorkoutId = workoutId;
    replacementSearch.value = "";
    replacementTitle.textContent = `${workout.name} 바꾸기`;
    replacementCategoryLabel.textContent = `${workout.category} 대체 운동`;
    replacementPicker.classList.add("show");
    replacementPicker.setAttribute("aria-hidden", "false");
    renderReplacementPicker();
    window.setTimeout(() => replacementSearch?.focus(), 80);
  }

  function closeReplacementPicker() {
    replacementPicker?.classList.remove("show");
    replacementPicker?.setAttribute("aria-hidden", "true");
    replacementWorkoutId = null;

    if (replacementSearch) {
      replacementSearch.value = "";
    }
  }

  function renderReplacementPicker() {
    const workout = workouts.find((item) => item.id === replacementWorkoutId);

    if (!workout || !replacementList) {
      return;
    }

    const keyword = replacementSearch?.value.trim().toLowerCase() || "";
    const occupiedExerciseIds = new Set(workouts
      .filter((item) => item.id !== workout.id)
      .map((item) => item.exerciseId));
    const candidates = exerciseCatalog
      .filter((exercise) => exercise.id !== workout.exerciseId && !occupiedExerciseIds.has(exercise.id))
      .filter((exercise) => `${exercise.name} ${exercise.category}`.toLowerCase().includes(keyword))
      .sort((left, right) => Number(right.category === workout.category) - Number(left.category === workout.category));

    replacementList.innerHTML = candidates.length ? candidates.map((exercise) => {
      const sameCategory = exercise.category === workout.category;
      return `
        <button class="exercise-option replacement-option" type="button" data-replacement-exercise="${escapeHtml(exercise.id)}">
          <span class="exercise-avatar">${exerciseIcon(exercise.name)}</span>
          <span>
            <strong>${escapeHtml(exercise.name)}</strong>
            <small>${sameCategory ? "같은 부위 · " : ""}${escapeHtml(exercise.category)} · ${escapeHtml(getPreviousWorkoutLabel(exercise))}</small>
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10.2l-2.6-2.6L16 3l5 5-5 5-1.4-1.4L17.2 9H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5Zm10 10H6.8l2.6 2.6L8 21l-5-5 5-5 1.4 1.4L6.8 15H17a3 3 0 0 0 3-3v-1h2v1a5 5 0 0 1-5 5Z"/></svg>
        </button>
      `;
    }).join("") : `<div class="exercise-empty">바꿀 수 있는 운동이 없어요.</div>`;
  }

  function replaceWorkout(exerciseId) {
    const workoutIndex = workouts.findIndex((item) => item.id === replacementWorkoutId);
    const current = workouts[workoutIndex];
    const exercise = getExercise(exerciseId);

    if (!current || current.sets.some((set) => set.done)) {
      showToast("완료한 세트가 있는 운동은 바꿀 수 없어요.");
      closeReplacementPicker();
      return;
    }

    workouts[workoutIndex] = {
      id: current.id,
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      restSeconds: getWorkoutRestSeconds(current),
      sets: createSetsFromPrevious(exercise, current.sets.length)
    };
    recentExerciseIds = [exercise.id, ...recentExerciseIds.filter((id) => id !== exercise.id)].slice(0, 8);
    saveWorkouts();
    saveRecentExercises();
    renderLogs();
    notifyWorkoutsChanged();
    closeReplacementPicker();
    showToast(`운동을 바꿨어요: ${exercise.name}`);
  }

  function openSetEditor(workoutId, setIndex) {
    const workout = workouts.find((item) => item.id === workoutId);
    const set = workout?.sets[setIndex];

    if (!workout || !set) {
      return;
    }

    activeEditor = { workoutId, setIndex };
    editorExercise.textContent = workout.name;
    editorTitle.textContent = `${setIndex + 1}세트 수정`;
    editorWeight.value = formatNumber(set.weight);
    editorReps.value = formatNumber(set.reps);
    editorUnit.textContent = getUnit(workout.exerciseId);
    const previousSet = getPreviousSet(workout, setIndex);
    previousSetSuggestion.hidden = !previousSet;
    if (previousSet) {
      previousSetValue.textContent = getSetSummary(workout, previousSet);
    }
    completeSetButton.textContent = set.done ? "완료 해제" : "세트 완료";
    completeSetButton.classList.toggle("is-done", set.done);
    renderWeightAdjustButtons();
    editor.classList.add("show");
    editor.setAttribute("aria-hidden", "false");
    window.setTimeout(() => editorWeight.focus(), 80);
  }

  function closeSetEditor() {
    editor.classList.remove("show");
    editor.setAttribute("aria-hidden", "true");
    activeEditor = null;
  }

  function applyPreviousSet() {
    const { workout, set } = getActiveSet();

    if (!workout || !set) {
      return;
    }

    const previousSet = getPreviousSet(workout, activeEditor.setIndex);
    if (!previousSet) {
      return;
    }

    set.weight = Math.max(Number(previousSet.weight) || 0, 0);
    set.reps = Math.max(Math.round(Number(previousSet.reps) || 1), 1);
    editorWeight.value = formatNumber(set.weight);
    editorReps.value = formatNumber(set.reps);
    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
    showToast("지난 세트 기록을 적용했어요.");
  }

  function getActiveSet() {
    if (!activeEditor) {
      return {};
    }
    const workout = workouts.find((item) => item.id === activeEditor.workoutId);
    return { workout, set: workout?.sets[activeEditor.setIndex] };
  }

  function renderWeightAdjustButtons() {
    if (!weightAdjustGrid) {
      return;
    }
    const step = getWeightStep();
    const bigStep = step * 5;
    const options = [-bigStep, -step, step, bigStep];
    weightAdjustGrid.innerHTML = options.map((amount) => `
      <button type="button" data-editor-adjust="weight:${amount}">${amount > 0 ? "+" : ""}${formatNumber(amount)}</button>
    `).join("");
  }

  function saveEditorValue(field, value) {
    const { set } = getActiveSet();

    if (!set) {
      return;
    }

    const number = Number(value);
    set[field] = field === "weight"
      ? Math.max(Number.isFinite(number) ? Number(number.toFixed(1)) : 0, 0)
      : Math.max(Number.isFinite(number) ? Math.round(number) : 1, 1);
    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
  }

  function adjustEditorValue(field, amount) {
    const { set } = getActiveSet();

    if (!set) {
      return;
    }

    const nextValue = (Number(set[field]) || 0) + amount;
    saveEditorValue(field, nextValue);
    if (field === "weight") {
      editorWeight.value = formatNumber(Math.max(nextValue, 0));
    } else {
      editorReps.value = formatNumber(Math.max(Math.round(nextValue), 1));
    }
  }

  function toggleSetCompletion(workout, set, closeEditor = false) {
    if (!workout || !set) {
      return;
    }

    const wasDone = set.done;
    set.done = !set.done;
    saveWorkouts();
    if (closeEditor) {
      closeSetEditor();
    }
    renderLogs();
    notifyWorkoutsChanged();

    if (!wasDone && set.done) {
      const restSeconds = getWorkoutRestSeconds(workout);
      startRestTimer(restSeconds);
      showToast(`세트 완료! ${restSeconds}초 휴식을 시작해요.`);
    } else {
      showToast("완료를 해제했어요.");
    }
  }

  function completeActiveSet() {
    const { workout, set } = getActiveSet();
    toggleSetCompletion(workout, set, true);
  }

  function toggleSetFromSummary(workoutId, setIndex) {
    const workout = workouts.find((item) => item.id === workoutId);
    toggleSetCompletion(workout, workout?.sets[setIndex]);
  }

  function openNextSet() {
    for (const workout of workouts) {
      const setIndex = workout.sets.findIndex((set) => !set.done);
      if (setIndex >= 0) {
        document.querySelector(`[data-workout-id="${CSS.escape(workout.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        openSetEditor(workout.id, setIndex);
        return;
      }
    }
    showToast(workouts.length ? "오늘 세트를 모두 완료했어요." : "먼저 운동을 추가해요.");
  }

  function addSet(workoutId) {
    const workout = workouts.find((item) => item.id === workoutId);
    const lastSet = workout?.sets.at(-1) || { weight: 0, reps: 10, done: false };

    if (!workout || workout.sets.length >= 20) {
      return;
    }

    workout.sets.push({ ...lastSet, done: false });
    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
  }

  function removeSet(workoutId) {
    const workout = workouts.find((item) => item.id === workoutId);

    if (!workout || workout.sets.length <= 1) {
      showToast("세트는 최소 1개가 필요해요.");
      return;
    }

    workout.sets.pop();
    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
  }

  function reorderWorkout(workoutId, direction) {
    const index = workouts.findIndex((workout) => workout.id === workoutId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= workouts.length) {
      return;
    }

    [workouts[index], workouts[nextIndex]] = [workouts[nextIndex], workouts[index]];
    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
  }

  function finishPointerReorder() {
    if (!dragState) {
      return;
    }

    const orderedIds = [...list.querySelectorAll("[data-workout-id]")].map((card) => card.dataset.workoutId);
    const orderChanged = orderedIds.join("|") !== dragState.initialOrder;
    workouts = orderedIds.map((id) => workouts.find((workout) => workout.id === id)).filter(Boolean);
    dragState.card.classList.remove("is-dragging");
    dragState = null;

    if (!orderChanged) {
      return;
    }

    saveWorkouts();
    renderLogs();
    notifyWorkoutsChanged();
    showToast("운동 순서를 바꿨어요.");
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

    const session = {
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
    };

    history.unshift(session);

    writeJson("gmymateWorkoutHistory", history.slice(0, 80));
    workouts = [];
    showRecoveryBanner = false;
    saveWorkouts(false);
    writeJson("gmymateWorkoutNote", "");
    if (noteInput) {
      noteInput.value = "";
    }
    stopTimer();
    renderLogs();
    notifyWorkoutsChanged();
    app.cloudSync?.completeWorkout(session);
    showToast("운동 기록을 저장했어요.");
  }

  document.querySelectorAll("[data-open-exercise-picker]").forEach((button) => {
    button.addEventListener("click", openPicker);
  });

  picker.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-exercise-picker]");
    const exerciseButton = event.target.closest("[data-select-exercise]");
    const categoryButton = event.target.closest("[data-filter-category]");
    const addButton = event.target.closest("[data-add-selected-exercises]");

    if (closeButton) {
      closePicker();
      return;
    }

    if (exerciseButton) {
      toggleExerciseSelection(exerciseButton.dataset.selectExercise);
      return;
    }

    if (categoryButton) {
      selectedCategory = categoryButton.dataset.filterCategory;
      renderExercisePicker();
      return;
    }

    if (addButton) {
      addSelectedExercises();
    }
  });

  search?.addEventListener("input", renderExercisePicker);

  replacementPicker?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-replacement-picker]")) {
      closeReplacementPicker();
      return;
    }

    const replacementButton = event.target.closest("[data-replacement-exercise]");
    if (replacementButton) {
      replaceWorkout(replacementButton.dataset.replacementExercise);
    }
  });
  replacementSearch?.addEventListener("input", renderReplacementPicker);

  editor.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-set-editor]")) {
      closeSetEditor();
      return;
    }

    const adjustButton = event.target.closest("[data-editor-adjust]");
    if (adjustButton) {
      const [field, amountValue] = adjustButton.dataset.editorAdjust.split(":");
      adjustEditorValue(field, Number(amountValue));
    }
  });

  editorWeight?.addEventListener("change", () => saveEditorValue("weight", editorWeight.value));
  editorReps?.addEventListener("change", () => saveEditorValue("reps", editorReps.value));
  previousSetSuggestion?.addEventListener("click", applyPreviousSet);
  completeSetButton?.addEventListener("click", completeActiveSet);

  addRestButton?.addEventListener("click", () => {
    if (timerState.mode !== "rest") {
      return;
    }
    timerState.restEndsAt += 15000;
    timerState.restTotalSeconds += 15;
    saveTimerState();
    renderTimer();
    showToast("휴식에 15초를 더했어요.");
  });

  skipRestButton?.addEventListener("click", () => {
    startSetTimer();
    showToast("휴식을 건너뛰고 세트를 시작해요.");
  });

  nextSetButton?.addEventListener("click", openNextSet);
  noteInput?.addEventListener("input", () => {
    writeJson("gmymateWorkoutNote", noteInput.value);
    if (workouts.length) {
      saveWorkouts();
    }
  });
  finishButton?.addEventListener("click", finishWorkout);
  recoveryBanner?.addEventListener("click", (event) => {
    if (event.target.closest("[data-dismiss-recovery]")) {
      showRecoveryBanner = false;
      renderRecoveryBanner();
    }
  });

  list.addEventListener("click", (event) => {
    const openPickerButton = event.target.closest("[data-open-exercise-picker]");
    const toggleSetButton = event.target.closest("[data-toggle-set]");
    const editSetButton = event.target.closest("[data-edit-set]");
    const addSetButton = event.target.closest("[data-add-set]");
    const removeSetButton = event.target.closest("[data-remove-set]");
    const replaceWorkoutButton = event.target.closest("[data-replace-workout]");
    const removeWorkoutButton = event.target.closest("[data-remove-workout]");

    if (openPickerButton) {
      openPicker();
      return;
    }

    if (toggleSetButton) {
      const [workoutId, indexValue] = toggleSetButton.dataset.toggleSet.split(":");
      toggleSetFromSummary(workoutId, Number(indexValue));
      return;
    }

    if (editSetButton) {
      const [workoutId, indexValue] = editSetButton.dataset.editSet.split(":");
      openSetEditor(workoutId, Number(indexValue));
      return;
    }

    if (addSetButton) {
      addSet(addSetButton.dataset.addSet);
      return;
    }

    if (removeSetButton) {
      removeSet(removeSetButton.dataset.removeSet);
      return;
    }

    if (replaceWorkoutButton) {
      openReplacementPicker(replaceWorkoutButton.dataset.replaceWorkout);
      return;
    }

    if (removeWorkoutButton) {
      workouts = workouts.filter((item) => item.id !== removeWorkoutButton.dataset.removeWorkout);
      saveWorkouts();
      if (!workouts.length) {
        stopTimer();
      }
      renderLogs();
      notifyWorkoutsChanged();
      showToast("운동을 지웠어요.");
    }
  });

  list.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-drag-workout]");

    if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    reorderWorkout(handle.dataset.dragWorkout, event.key === "ArrowUp" ? -1 : 1);
  });

  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-drag-workout]");
    const card = handle?.closest("[data-workout-id]");

    if (!handle || !card) {
      return;
    }

    handle.setPointerCapture?.(event.pointerId);
    dragState = {
      handle,
      card,
      pointerId: event.pointerId,
      initialOrder: workouts.map((workout) => workout.id).join("|")
    };
    card.classList.add("is-dragging");
  });

  list.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const targetCard = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-workout-id]");
    if (!targetCard || targetCard === dragState.card) {
      return;
    }

    const targetRect = targetCard.getBoundingClientRect();
    if (event.clientY < targetRect.top + targetRect.height / 2) {
      targetCard.before(dragState.card);
    } else {
      targetCard.after(dragState.card);
    }
  });

  list.addEventListener("pointerup", finishPointerReorder);
  list.addEventListener("pointercancel", finishPointerReorder);

  clearButton?.addEventListener("click", () => {
    workouts = [];
    showRecoveryBanner = false;
    saveWorkouts();
    writeJson("gmymateWorkoutLogs", []);
    writeJson("gmymateWorkoutNote", "");
    if (noteInput) {
      noteInput.value = "";
    }
    stopTimer();
    renderLogs();
    notifyWorkoutsChanged();
    showToast("오늘 기록을 비웠어요.");
  });

  window.addEventListener("gmymate:view-changed", (event) => {
    if (event.detail?.view === "log" && workouts.length && timerState.mode === "idle") {
      startSetTimer();
    }
  });

  window.addEventListener("gmymate:settings-changed", () => {
    renderWeightAdjustButtons();
    renderTimer();
  });

  window.addEventListener("gmymate:workouts-changed", (event) => {
    if (event.detail?.source === "workout-log") {
      return;
    }
    workouts = normalizeWorkouts(readJson("gmymateWorkoutLogsV2", []));
    showRecoveryBanner = false;
    saveWorkouts();
    if (!workouts.length) {
      stopTimer();
    }
    renderLogs();
  });

  window.addEventListener("pagehide", () => {
    if (workouts.length) {
      saveWorkouts(false);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && workouts.length) {
      saveWorkouts(false);
    }
    if (!document.hidden) {
      renderTimer();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (editor.classList.contains("show")) {
      closeSetEditor();
    } else if (replacementPicker?.classList.contains("show")) {
      closeReplacementPicker();
    } else if (picker.classList.contains("show")) {
      closePicker();
    }
  });

  if (workouts.length && !activeWorkoutMeta.updatedAt) {
    saveWorkouts();
  }
  renderLogs();
  renderTimer();
  ensureTimerInterval();
}

app.setupWorkoutLog = setupWorkoutLog;
})(window.Gmymate = window.Gmymate || {});
