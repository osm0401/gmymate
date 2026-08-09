import { exerciseCatalog } from "../core/data.js";
import { partIcon } from "../core/part-icons.js";
import { escapeHtml, getDateKey, getWorkoutStats, readJson, setText, showToast, writeJson } from "../core/storage.js";

export function setupWorkoutLog() {
  const list = document.querySelector("#logList");
  const summary = document.querySelector("#workoutSummary");
  const picker = document.querySelector("#exercisePicker");
  const search = document.querySelector("#exerciseSearch");
  const exerciseList = document.querySelector("#exerciseList");
  const recentSection = document.querySelector("#recentExerciseSection");
  const recentList = document.querySelector("#recentExerciseList");
  const categoryFilterHost = document.querySelector("#exerciseCategoryFilters");
  const clearButton = document.querySelector("[data-clear-logs]");
  const noteInput = document.querySelector("#workoutNote");
  const finishButton = document.querySelector("[data-finish-workout]");
  const restTimerDisplay = document.querySelector("#restTimerDisplay");
  const restTimerBar = document.querySelector("#restTimerBar");
  const restTimerCard = document.querySelector(".rest-timer-card");
  const restStatus = document.querySelector("#restStatus");

  if (!list || !picker || !exerciseList || !recentList) {
    return;
  }

  let workouts = readJson("gmymateWorkoutLogsV2", []);
  let recentExerciseIds = readJson("gmymateRecentExercises", ["squat", "lat-pulldown", "chest-press"]);
  let activeCategory = "전체";
  const categories = ["전체", ...new Set(exerciseCatalog.map((exercise) => exercise.category))];
  const oldLogs = readJson("gmymateWorkoutLogs", []);
  let restIntervalId = null;
  let restTotalSeconds = 0;
  let restRemainingSeconds = 0;
  const cardioTimers = new Map();

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

  function getExerciseSessions(exerciseId) {
    return readJson("gmymateWorkoutHistory", [])
      .map((session) => ({
        dateKey: session.dateKey,
        workout: (session.workouts || []).find((item) => item.exerciseId === exerciseId)
      }))
      .filter((entry) => entry.workout)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }

  function getLastDoneSet(exerciseId) {
    const lastSession = getExerciseSessions(exerciseId)[0];
    return lastSession?.workout.sets.find((set) => set.done) || null;
  }

  function makeSets(exercise) {
    const lastDoneSet = getLastDoneSet(exercise.id);
    const weight = lastDoneSet ? Number(lastDoneSet.weight) : exercise.weight;
    const reps = lastDoneSet ? Number(lastDoneSet.reps) : exercise.reps;

    return Array.from({ length: exercise.sets }, () => ({ weight, reps, done: false, type: "normal" }));
  }

  function estimate1RM(weight, reps) {
    return weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;
  }

  function getBest1RMText(workout) {
    const doneSets = workout.sets.filter((set) => set.done && Number(set.weight) > 0);

    if (doneSets.length === 0) {
      return "";
    }

    const best = Math.max(...doneSets.map((set) => estimate1RM(Number(set.weight), Number(set.reps))));
    return ` · 예상 1RM ${Math.round(best)}kg`;
  }

  function playBeep() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.frequency.value = 880;
      gain.gain.value = 0.1;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    } catch {
      // audio unavailable — silently skip
    }
  }

  function isPersonalRecord(workout, set) {
    const usesWeight = Number(set.weight) > 0;
    const currentValue = usesWeight ? Number(set.weight) : Number(set.reps);

    if (currentValue <= 0) {
      return false;
    }

    const history = readJson("gmymateWorkoutHistory", []);
    let bestPastValue = 0;

    history.forEach((session) => {
      (session.workouts || [])
        .filter((historyWorkout) => historyWorkout.exerciseId === workout.exerciseId)
        .forEach((historyWorkout) => {
          historyWorkout.sets.forEach((historySet) => {
            if (!historySet.done) {
              return;
            }

            const historyValue = usesWeight ? Number(historySet.weight) : Number(historySet.reps);
            bestPastValue = Math.max(bestPastValue, historyValue);
          });
        });
    });

    return currentValue > bestPastValue;
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

  function repsUnit(exerciseId) {
    if (exerciseId === "plank") {
      return "초";
    }

    if (exerciseId === "cycle") {
      return "분";
    }

    return "회";
  }

  function getLastText(workout) {
    const lastDoneSet = getLastDoneSet(workout.exerciseId);

    if (!lastDoneSet) {
      return `처음 도전하는 운동이에요${getBest1RMText(workout)}`;
    }

    const weightText = Number(lastDoneSet.weight) > 0 ? `${lastDoneSet.weight}kg` : "맨몸";
    return `지난번 ${weightText} · ${lastDoneSet.reps}${repsUnit(workout.exerciseId)}${getBest1RMText(workout)}`;
  }

  function setSummary() {
    if (!summary) {
      return;
    }

    const { doneSets, totalSets } = getWorkoutStats(workouts);
    summary.textContent = workouts.length ? `운동 ${workouts.length}개 · ${doneSets}/${totalSets}세트` : "운동 0개";
  }

  function renderWorkoutMetrics() {
    const { doneSets, totalSets, volume } = getWorkoutStats(workouts);
    const ring = document.querySelector("#workoutProgressRing");
    const percent = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

    /* setText를 거쳐야 값이 바뀔 때 .value-pop 연출이 붙는다. */
    setText("workoutProgress", `${doneSets}/${totalSets}`);
    setText("workoutVolume", `${Math.round(volume).toLocaleString("ko-KR")}kg`);
    setText("workoutProgressPct", `${percent}%`);

    if (ring) {
      ring.style.setProperty("--pct", String(percent));
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

    /* 쉬는 중이 아닐 땐 한 줄로 접어서 상시 차지하는 높이를 줄인다. */
    restTimerCard?.classList.toggle("is-idle", !restIntervalId);
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
        navigator.vibrate?.(200);
        stopRestTimer("휴식 끝! 다음 세트 가요.");
      }
    }, 1000);
    renderRestTimer();
  }

  /* 첫 세트를 체크한 시각을 운동 시작으로 본다. 운동만 추가해두고 나중에
     시작하는 경우가 많아서 "추가한 시각"으로 잡으면 소요 시간이 부풀려진다. */
  function markWorkoutStarted() {
    if (!readJson("gmymateWorkoutStartedAt", null)) {
      writeJson("gmymateWorkoutStartedAt", new Date().toISOString());
    }
  }

  function getElapsedMinutes() {
    const startedAt = readJson("gmymateWorkoutStartedAt", null);

    if (!startedAt) {
      return 0;
    }

    const minutes = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
    return minutes > 0 && minutes < 60 * 12 ? minutes : 0;
  }

  function finishWorkout() {
    const stats = getWorkoutStats(workouts);

    if (stats.totalSets === 0) {
      showToast("먼저 운동을 추가해요.");
      return;
    }

    const now = new Date();
    const history = readJson("gmymateWorkoutHistory", []);
    const note = noteInput?.value.trim() || "";
    const playedTracks = readJson("gmymateTodayPlayedTracks", []);
    const durationMinutes = getElapsedMinutes();

    history.unshift({
      id: `session-${Date.now()}`,
      title: workouts.map((workout) => workout.name).slice(0, 2).join(", ") || "운동 기록",
      dateKey: getDateKey(now),
      finishedAt: now.toISOString(),
      exerciseCount: workouts.length,
      doneSets: stats.doneSets,
      totalSets: stats.totalSets,
      volume: Math.round(stats.volume),
      durationMinutes,
      note,
      playedTracks,
      workouts
    });

    writeJson("gmymateWorkoutHistory", history.slice(0, 80));
    writeJson("gmymateTodayPlayedTracks", []);
    writeJson("gmymateWorkoutStartedAt", null);
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

  function formatSeconds(totalSeconds) {
    const clamped = Math.max(totalSeconds, 0);
    const minutes = String(Math.floor(clamped / 60)).padStart(2, "0");
    const seconds = String(clamped % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function renderCardioTimer(workout) {
    if (workout.exerciseId !== "cycle") {
      return "";
    }

    const active = cardioTimers.get(workout.id);
    const remaining = active ? active.remainingSeconds : Number(workout.sets[0]?.reps || 0) * 60;

    return `
      <div class="cardio-timer-row">
        <strong data-cardio-display="${escapeHtml(workout.id)}">${formatSeconds(remaining)}</strong>
        <button type="button" data-cardio-toggle="${escapeHtml(workout.id)}">${active ? "정지" : "타이머 시작"}</button>
      </div>
    `;
  }

  function toggleCardioTimer(workoutId) {
    const existing = cardioTimers.get(workoutId);

    if (existing) {
      window.clearInterval(existing.intervalId);
      cardioTimers.delete(workoutId);
      renderLogs();
      return;
    }

    const workout = workouts.find((item) => item.id === workoutId);
    const totalSeconds = Math.max(Number(workout?.sets[0]?.reps || 0) * 60, 60);
    const timer = { remainingSeconds: totalSeconds };

    timer.intervalId = window.setInterval(() => {
      timer.remainingSeconds -= 1;
      const display = document.querySelector(`[data-cardio-display="${workoutId}"]`);

      if (display) {
        display.textContent = formatSeconds(timer.remainingSeconds);
      }

      if (timer.remainingSeconds <= 0) {
        window.clearInterval(timer.intervalId);
        cardioTimers.delete(workoutId);
        navigator.vibrate?.(200);

        const finishedWorkout = workouts.find((item) => item.id === workoutId);
        if (finishedWorkout?.sets[0]) {
          finishedWorkout.sets[0].done = true;
          saveWorkouts();
          notifyWorkoutsChanged();
        }

        renderLogs();
        showToast("유산소 완료!");
      }
    }, 1000);

    cardioTimers.set(workoutId, timer);
    renderLogs();
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

    list.innerHTML = workouts.map((workout, workoutIndex) => `
      <article class="exercise-log-card" data-workout-id="${escapeHtml(workout.id)}">
        <header class="exercise-card-header">
          <div class="exercise-card-top">
            <div class="exercise-avatar">${partIcon(workout.category)}</div>
            <div class="exercise-title-block">
              <strong>${escapeHtml(workout.name)}</strong>
              <span>${escapeHtml(getLastText(workout))}</span>
              ${workout.supersetWith ? `<span class="superset-badge">🔗 슈퍼세트</span>` : ""}
            </div>
          </div>
          <div class="exercise-actions">
            <button class="icon-button" type="button" data-move-workout="${escapeHtml(workout.id)}:up" aria-label="위로 이동" ${workoutIndex === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-button" type="button" data-move-workout="${escapeHtml(workout.id)}:down" aria-label="아래로 이동" ${workoutIndex === workouts.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-button" type="button" data-toggle-superset="${escapeHtml(workout.id)}" aria-label="슈퍼세트로 묶기">🔗</button>
            <button class="icon-button" type="button" data-add-set="${escapeHtml(workout.id)}" aria-label="세트 추가">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
            </button>
            <button class="icon-button" type="button" data-remove-workout="${escapeHtml(workout.id)}" aria-label="운동 삭제">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h10l-.6 14H7.6Zm2-3h6l1 2H8Zm1 6v8h2V9Zm4 0v8h2V9Z"/></svg>
            </button>
          </div>
        </header>

        ${renderCardioTimer(workout)}

        <div class="set-count-row">
          <button type="button" data-remove-set="${escapeHtml(workout.id)}">-</button>
          <strong>${workout.sets.length}</strong>
          <button type="button" data-add-set="${escapeHtml(workout.id)}">+</button>
        </div>

        <div class="set-row-list">
          ${workout.sets.map((set, index) => `
            <div class="set-row ${set.done ? "is-done" : ""}" data-set-index="${index}">
              <button type="button" class="set-number ${set.type === "drop" ? "is-drop" : ""}" data-toggle-set-type="${escapeHtml(workout.id)}:${index}" aria-label="${index + 1}세트 종류(탭하면 드롭세트로 전환)">${set.type === "drop" ? "D" : index + 1}</button>
              <div class="set-input-control weight-control">
                <input class="set-field" data-field="weight" type="number" min="0" step="${escapeHtml(weightStep)}" value="${escapeHtml(set.weight)}" aria-label="${index + 1}세트 무게">
                <span class="set-label">무게</span>
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
                <span class="set-label">횟수</span>
                <span class="set-quick-buttons" aria-label="${index + 1}세트 횟수 빠른 추가">
                  <button class="set-quick-button" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:reps:1" aria-label="${index + 1}세트 횟수 1회 추가">+1</button>
                  <button class="set-quick-button" type="button" data-adjust-set="${escapeHtml(workout.id)}:${index}:reps:5" aria-label="${index + 1}세트 횟수 5회 추가">+5</button>
                </span>
                <span class="set-unit">${repsUnit(workout.exerciseId)}</span>
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

  function renderCategoryFilters() {
    if (!categoryFilterHost) {
      return;
    }

    categoryFilterHost.innerHTML = categories.map((category) => `
      <button type="button" class="${category === activeCategory ? "active" : ""}" data-category-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>
    `).join("");
  }

  function renderExercisePicker() {
    const keyword = search?.value.trim().toLowerCase() || "";
    const recentExercises = recentExerciseIds.map(getExercise).filter(Boolean).slice(0, 4);
    const filtered = exerciseCatalog.filter((exercise) => {
      if (activeCategory !== "전체" && exercise.category !== activeCategory) {
        return false;
      }

      const haystack = `${exercise.name} ${exercise.category}`.toLowerCase();
      return haystack.includes(keyword);
    });

    recentSection.hidden = keyword.length > 0 || recentExercises.length === 0;
    recentList.innerHTML = recentExercises.map((exercise) => `
      <button class="exercise-chip" type="button" data-select-exercise="${exercise.id}">
        ${partIcon(exercise.category)}
        <span>${escapeHtml(exercise.name)}</span>
      </button>
    `).join("");

    exerciseList.innerHTML = filtered.length ? filtered.map((exercise) => `
      <button class="exercise-option" type="button" data-select-exercise="${exercise.id}">
        <span class="exercise-avatar">${partIcon(exercise.category)}</span>
        <span>
          <strong>${escapeHtml(exercise.name)}</strong>
          <small>${escapeHtml(exercise.category)} · 기본 ${exercise.weight ? `${exercise.weight}kg` : "맨몸"} · ${exercise.reps}${repsUnit(exercise.id)}</small>
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

  function getOverloadHint(exercise) {
    const lastDoneSet = getLastDoneSet(exercise.id);

    if (!lastDoneSet || Number(lastDoneSet.weight) <= 0) {
      return null;
    }

    const suggested = Number(lastDoneSet.weight) + getWeightStep();
    return `${exercise.name} 추가! 지난번 ${lastDoneSet.weight}kg 했으니 ${formatIncrement(suggested)}kg 어때요?`;
  }

  function addExercise(id) {
    const exercise = getExercise(id);
    const overloadHint = getOverloadHint(exercise);
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
    showToast(overloadHint || `${exercise.name}을 추가했어요.`);
  }

  function startRoutine(ids) {
    const existingIds = new Set(workouts.map((workout) => workout.exerciseId));
    const toAdd = ids.filter((id) => exerciseCatalog.some((exercise) => exercise.id === id) && !existingIds.has(id));

    if (toAdd.length === 0) {
      showToast(ids.length ? "이미 오늘 기록에 있어요." : "루틴 정보를 찾을 수 없어요.");
      return;
    }

    toAdd.forEach((id) => {
      const exercise = getExercise(id);
      workouts.unshift({
        id: `${exercise.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        exerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        sets: makeSets(exercise)
      });
      recentExerciseIds = [exercise.id, ...recentExerciseIds.filter((recentId) => recentId !== exercise.id)].slice(0, 6);
    });

    workouts = workouts.slice(0, 12);
    saveWorkouts();
    saveRecentExercises();
    renderLogs();
    notifyWorkoutsChanged();
    showToast(`루틴 운동 ${toAdd.length}개를 추가했어요.`);
  }

  window.addEventListener("gmymate:start-routine", (event) => {
    startRoutine(event.detail?.ids || []);
  });

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

  categoryFilterHost?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category-filter]");

    if (!button) {
      return;
    }

    activeCategory = button.dataset.categoryFilter;
    renderCategoryFilters();
    renderExercisePicker();
  });

  renderCategoryFilters();

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
    const moveWorkoutButton = event.target.closest("[data-move-workout]");
    const toggleSupersetButton = event.target.closest("[data-toggle-superset]");
    const toggleSetTypeButton = event.target.closest("[data-toggle-set-type]");
    const cardioToggleButton = event.target.closest("[data-cardio-toggle]");

    if (openPickerButton) {
      openPicker();
      return;
    }

    if (cardioToggleButton) {
      toggleCardioTimer(cardioToggleButton.dataset.cardioToggle);
      return;
    }

    if (toggleSetTypeButton) {
      const [workoutId, indexValue] = toggleSetTypeButton.dataset.toggleSetType.split(":");
      const workout = workouts.find((item) => item.id === workoutId);
      const set = workout?.sets[Number(indexValue)];

      if (set) {
        set.type = set.type === "drop" ? "normal" : "drop";
        saveWorkouts();
        renderLogs();
      }
      return;
    }

    if (moveWorkoutButton) {
      const [workoutId, direction] = moveWorkoutButton.dataset.moveWorkout.split(":");
      const index = workouts.findIndex((item) => item.id === workoutId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (index >= 0 && targetIndex >= 0 && targetIndex < workouts.length) {
        [workouts[index], workouts[targetIndex]] = [workouts[targetIndex], workouts[index]];
        saveWorkouts();
        renderLogs();
      }
      return;
    }

    if (toggleSupersetButton) {
      const workoutId = toggleSupersetButton.dataset.toggleSuperset;
      const index = workouts.findIndex((item) => item.id === workoutId);
      const workout = workouts[index];

      if (workout.supersetWith) {
        const partner = workouts.find((item) => item.id === workout.supersetWith);
        if (partner) {
          partner.supersetWith = null;
        }
        workout.supersetWith = null;
        showToast("슈퍼세트 연결을 풀었어요.");
      } else {
        const next = workouts[index + 1];

        if (!next) {
          showToast("묶을 다음 운동이 없어요.");
          return;
        }

        workout.supersetWith = next.id;
        next.supersetWith = workout.id;
        showToast(`${workout.name} + ${next.name} 슈퍼세트로 묶었어요.`);
      }

      saveWorkouts();
      renderLogs();
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
        const isPr = !set.done && isPersonalRecord(workout, set);
        set.done = !set.done;
        saveWorkouts();
        renderLogs();
        notifyWorkoutsChanged();

        if (set.done) {
          markWorkoutStarted();
          startRestTimer();
          playBeep();
        }

        if (isPr) {
          showToast(`🎉 ${workout.name} 개인 기록!`);
        } else {
          showToast(set.done ? "세트 완료!" : "완료를 해제했어요.");
        }
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
