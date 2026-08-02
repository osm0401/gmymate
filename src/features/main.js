(function attachMain(app) {
const { escapeHtml, getWorkoutHistory, profileLabels, weeklyLabels, getProfile, readJson, setText, showToast, writeJson } = app;

const DEFAULT_SETTINGS = {
  weightStepKg: 1,
  restSeconds: 90,
  largeTouch: false,
  easyWords: true,
  workoutAlert: false,
  beginnerMode: true
};

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function setupMain() {
  const main = document.querySelector(".main-screen");

  if (!main) {
    return;
  }

  setupProfile();
  window.addEventListener("gmymate:profile-loaded", setupProfile);
  setupNavigation();
  setupHabits();
  setupSettings();
  renderAppStats();

  window.addEventListener("gmymate:workouts-changed", renderAppStats);
  window.addEventListener("gmymate:settings-changed", renderAppStats);
}

function setupProfile() {
  const profile = getProfile();
  setText("currentWeight", profile.weight ? `${profile.weight} kg` : "-- kg");
  setText("targetWeight", profile.targetWeight ? `${profile.targetWeight} kg` : "-- kg");
  setText("weeklyWorkout", profile.weeklyWorkout ? weeklyLabels[profile.weeklyWorkout] : "-- 회");
  setText("heightValue", profile.height ? `${profile.height} cm` : "-- cm");
  setText("ageValue", profile.age ? `${profile.age} 세` : "-- 세");
  setText("experienceValue", profileLabels[profile.experience] || "미입력");
  setText("goalValue", profileLabels[profile.goal] || "미입력");
}

function setupNavigation() {
  function activateTab(tabName) {
    document.querySelectorAll("[data-view]").forEach((view) => {
      view.classList.toggle("active", view.dataset.view === tabName);
    });

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === tabName);
      item.toggleAttribute("aria-current", item.dataset.tab === tabName);
    });

    window.dispatchEvent(new CustomEvent("gmymate:view-changed", { detail: { view: tabName } }));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-start-workout]").forEach((button) => {
    button.addEventListener("click", () => {
      activateTab("log");
      showToast("좋아요. 첫 세트부터 기록해볼게요.");
    });
  });
}

function setupHabits() {
  const savedHabits = readJson("gmymateHabits", {});

  document.querySelectorAll("[data-habit]").forEach((input) => {
    input.checked = Boolean(savedHabits[input.dataset.habit]);
    input.addEventListener("change", () => {
      savedHabits[input.dataset.habit] = input.checked;
      writeJson("gmymateHabits", savedHabits);
      app.cloudSync?.saveHabits(savedHabits);
      showToast(input.checked ? "작은 습관 완료!" : "체크를 해제했어요.");
    });
  });
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson("gmymateSettings", {}) };
}

function saveSettings(settings) {
  writeJson("gmymateSettings", settings);
  app.cloudSync?.saveSettings(settings);
  applySettings(settings);
  window.dispatchEvent(new CustomEvent("gmymate:settings-changed", { detail: settings }));
}

function applySettings(settings = getSettings()) {
  document.body.classList.toggle("large-touch-mode", Boolean(settings.largeTouch));
}

function setupSettings() {
  const settings = getSettings();
  const weightInput = document.querySelector("#weightStepSetting");
  const restInput = document.querySelector("#restTimerSetting");
  const largeTouchInput = document.querySelector("#largeTouchSetting");
  const easyWordsInput = document.querySelector("#easyWordsSetting");
  const workoutAlertInput = document.querySelector("#workoutAlertSetting");
  const beginnerModeInput = document.querySelector("#beginnerModeSetting");
  const exportButton = document.querySelector("[data-export-data]");
  const resetTodayButton = document.querySelector("[data-reset-today]");

  if (weightInput) {
    weightInput.value = settings.weightStepKg;
    const updateWeightStep = (shouldToast = false) => {
      if (weightInput.value === "") {
        return;
      }

      const nextSettings = getSettings();
      nextSettings.weightStepKg = Math.max(Number(weightInput.value) || DEFAULT_SETTINGS.weightStepKg, 0.5);
      saveSettings(nextSettings);

      if (shouldToast) {
        weightInput.value = nextSettings.weightStepKg;
        showToast(`무게 k를 ${nextSettings.weightStepKg}kg로 저장했어요.`);
      }
    };
    weightInput.addEventListener("input", () => updateWeightStep());
    weightInput.addEventListener("change", () => updateWeightStep(true));
  }

  if (restInput) {
    restInput.value = settings.restSeconds;
    const updateRestSeconds = (shouldToast = false) => {
      if (restInput.value === "") {
        return;
      }

      const nextSettings = getSettings();
      nextSettings.restSeconds = Math.min(Math.max(Number(restInput.value) || DEFAULT_SETTINGS.restSeconds, 15), 300);
      saveSettings(nextSettings);

      if (shouldToast) {
        restInput.value = nextSettings.restSeconds;
        showToast(`휴식 시간을 ${nextSettings.restSeconds}초로 저장했어요.`);
      }
    };
    restInput.addEventListener("input", () => updateRestSeconds());
    restInput.addEventListener("change", () => updateRestSeconds(true));
  }

  bindSettingToggle(largeTouchInput, "largeTouch");
  bindSettingToggle(easyWordsInput, "easyWords");
  bindWorkoutAlertToggle(workoutAlertInput);
  bindSettingToggle(beginnerModeInput, "beginnerMode");
  applySettings(settings);

  exportButton?.addEventListener("click", exportData);

  resetTodayButton?.addEventListener("click", () => {
    writeJson("gmymateWorkoutLogsV2", []);
    writeJson("gmymateWorkoutNote", "");
    localStorage.removeItem("gmymateActiveWorkoutV1");
    localStorage.removeItem("gmymateTimerState");
    window.dispatchEvent(new CustomEvent("gmymate:workouts-changed"));
    showToast("오늘 기록을 비웠어요.");
  });
}

function bindWorkoutAlertToggle(input) {
  if (!input) {
    return;
  }

  input.checked = Boolean(getSettings().workoutAlert);
  input.addEventListener("change", async () => {
    const nextSettings = getSettings();
    nextSettings.workoutAlert = input.checked;

    if (input.checked && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Sound and vibration still work when notification permission is unavailable.
      }
    }

    saveSettings(nextSettings);
    const browserNoticeReady = "Notification" in window && Notification.permission === "granted";
    showToast(input.checked
      ? browserNoticeReady ? "휴식 종료 소리, 진동, 알림을 켰어요." : "휴식 종료 소리와 진동을 켰어요."
      : "휴식 종료 알림을 껐어요.");
  });
}

function bindSettingToggle(input, key) {
  if (!input) {
    return;
  }

  input.checked = Boolean(getSettings()[key]);
  input.addEventListener("change", () => {
    const nextSettings = getSettings();
    nextSettings[key] = input.checked;
    saveSettings(nextSettings);
    showToast(input.checked ? "설정을 켰어요." : "설정을 껐어요.");
  });
}

async function exportData() {
  const data = {
    profile: readJson("gmymateProfile", {}),
    today: readJson("gmymateWorkoutLogsV2", []),
    history: readJson("gmymateWorkoutHistory", []),
    settings: getSettings(),
    habits: readJson("gmymateHabits", {}),
    activeWorkout: readJson("gmymateActiveWorkoutV1", null),
    exportedAt: new Date().toISOString()
  };
  const text = JSON.stringify(data, null, 2);

  try {
    await navigator.clipboard.writeText(text);
    showToast("데이터를 복사했어요.");
  } catch {
    showToast("복사 권한이 필요해요.");
  }
}

function renderAppStats() {
  const todayWorkouts = readJson("gmymateWorkoutLogsV2", []);
  const history = getWorkoutHistory();
  const todayStats = getWorkoutStats(todayWorkouts);
  const dateKeys = getCompletedDateKeys(history, todayStats.doneSets > 0);
  const streak = getStreak(dateKeys);
  const monthCount = getMonthCount(dateKeys);

  setText("homeDoneSets", `${todayStats.doneSets}/${todayStats.totalSets}`);
  setText("homeVolume", `${formatNumber(todayStats.volume)}kg`);
  setText("homeStreak", `${streak}일`);
  setText("calendarStreak", `${streak}일`);
  setText("calendarMonthCount", `${monthCount}일`);
  setText("calendarTotalSessions", `${history.length}회`);
  setText("monthWorkoutLabel", `운동한 날 ${monthCount}일`);

  renderWeekStrip(dateKeys);
  renderMonthGrid(dateKeys);
  renderProgressDashboard(history);
  renderHistory(history);
}

function renderProgressDashboard(history) {
  const recentSessions = getSessionsSince(history, 6);
  const recentTotals = recentSessions.reduce((totals, session) => {
    totals.sets += Number(session.doneSets) || countCompletedSets(session);
    totals.volume += Number(session.volume) || calculateSessionVolume(session);
    return totals;
  }, { sets: 0, volume: 0 });
  const weeklyBuckets = getWeeklyVolumeBuckets(history, 6);
  const currentWeek = weeklyBuckets.at(-1)?.volume || 0;
  const previousWeek = weeklyBuckets.at(-2)?.volume || 0;

  setText("progressWeekSessions", `${recentSessions.length}회`);
  setText("progressWeekSets", `${recentTotals.sets}세트`);
  setText("progressWeekVolume", `${formatCompactNumber(recentTotals.volume)}kg`);
  setText("progressTrendLabel", formatVolumeTrend(currentWeek, previousWeek));

  renderWeeklyVolumeChart(weeklyBuckets);
  renderExerciseProgress(history);
}

function getSessionsSince(history, daysAgo) {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - daysAgo);
  return history.filter((session) => getSessionDate(session) >= threshold);
}

function getSessionDate(session) {
  const value = session.finishedAt || (session.dateKey ? `${session.dateKey}T12:00:00` : "");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function countCompletedSets(session) {
  return (session.workouts || []).reduce((total, workout) => (
    total + (workout.sets || []).filter((set) => set.done).length
  ), 0);
}

function calculateSessionVolume(session) {
  return (session.workouts || []).reduce((total, workout) => total + (workout.sets || []).reduce((sum, set) => (
    set.done ? sum + (Number(set.weight) || 0) * (Number(set.reps) || 0) : sum
  ), 0), 0);
}

function getWeekStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function getWeeklyVolumeBuckets(history, count) {
  const currentStart = getWeekStart(new Date());
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = new Date(currentStart);
    start.setDate(currentStart.getDate() - ((count - 1 - index) * 7));
    return {
      key: getDateKey(start),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      volume: 0
    };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  history.forEach((session) => {
    const bucket = bucketMap.get(getDateKey(getWeekStart(getSessionDate(session))));
    if (bucket) {
      bucket.volume += Number(session.volume) || calculateSessionVolume(session);
    }
  });

  return buckets;
}

function formatVolumeTrend(current, previous) {
  if (!current && !previous) {
    return "첫 기록을 기다려요";
  }

  if (!previous) {
    return "이번 주 첫 기록";
  }

  const percentage = Math.round(((current - previous) / previous) * 100);
  if (percentage === 0) {
    return "지난주와 같아요";
  }
  return `지난주보다 ${percentage > 0 ? "+" : ""}${percentage}%`;
}

function renderWeeklyVolumeChart(buckets) {
  const chart = document.querySelector("#weeklyVolumeChart");

  if (!chart) {
    return;
  }

  const maximum = Math.max(...buckets.map((bucket) => bucket.volume), 1);
  chart.innerHTML = buckets.map((bucket, index) => {
    const height = bucket.volume ? Math.max(Math.round((bucket.volume / maximum) * 100), 8) : 3;
    const label = `${bucket.label} 주, ${formatNumber(bucket.volume)}kg`;
    return `
      <div class="weekly-volume-column ${index === buckets.length - 1 ? "is-current" : ""}" aria-label="${label}">
        <span class="weekly-volume-value">${bucket.volume ? formatCompactNumber(bucket.volume) : "-"}</span>
        <span class="weekly-volume-bar"><i style="height: ${height}%"></i></span>
        <span class="weekly-volume-label">${bucket.label}</span>
      </div>
    `;
  }).join("");
}

function renderExerciseProgress(history) {
  const list = document.querySelector("#exerciseProgressList");

  if (!list) {
    return;
  }

  const progress = collectExerciseProgress(history).slice(0, 5);
  if (!progress.length) {
    list.innerHTML = `<p class="empty-progress">운동을 완료하면 종목별 변화가 여기에 보여요.</p>`;
    return;
  }

  list.innerHTML = progress.map((item) => {
    const change = getPerformanceChange(item.latest, item.previous);
    return `
      <article class="exercise-progress-row">
        <span class="progress-exercise-mark" aria-hidden="true">${escapeHtml(item.name.slice(0, 1))}</span>
        <span class="exercise-progress-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.latest.label)} · ${formatHistoryDate(item.latest.finishedAt)}</small>
        </span>
        <span class="exercise-progress-change ${change.tone}">${change.label}</span>
      </article>
    `;
  }).join("");
}

function collectExerciseProgress(history) {
  const records = new Map();
  [...history].reverse().forEach((session) => {
    (session.workouts || []).forEach((workout) => {
      const completedSets = (workout.sets || []).filter((set) => set.done);
      const performance = getBestPerformance(completedSets, workout.exerciseId);

      if (!performance) {
        return;
      }

      const record = records.get(workout.exerciseId) || {
        exerciseId: workout.exerciseId,
        name: workout.name || "운동",
        previous: null,
        latest: null
      };
      record.previous = record.latest;
      record.latest = { ...performance, finishedAt: session.finishedAt || session.dateKey };
      record.name = workout.name || record.name;
      records.set(workout.exerciseId, record);
    });
  });

  return [...records.values()]
    .filter((record) => record.latest)
    .sort((left, right) => new Date(right.latest.finishedAt) - new Date(left.latest.finishedAt));
}

function getBestPerformance(sets, exerciseId) {
  if (!sets.length) {
    return null;
  }

  const weightedSets = sets.filter((set) => Number(set.weight) > 0);
  if (weightedSets.length) {
    const best = weightedSets.reduce((current, set) => {
      const score = Number(set.weight) * (1 + (Number(set.reps) || 0) / 30);
      return !current || score > current.score ? { set, score } : current;
    }, null);
    return {
      score: best.score,
      label: `${formatNumber(best.set.weight)}kg × ${formatNumber(best.set.reps)}회`
    };
  }

  const best = sets.reduce((current, set) => Number(set.reps) > Number(current.reps) ? set : current, sets[0]);
  const unit = exerciseId === "plank" ? "초" : exerciseId && ["treadmill", "cycling", "stair-climber", "rowing-machine"].includes(exerciseId) ? "분" : "회";
  return { score: Number(best.reps) || 0, label: `${formatNumber(best.reps)}${unit}` };
}

function getPerformanceChange(latest, previous) {
  if (!previous || !previous.score) {
    return { label: "첫 기록", tone: "is-new" };
  }

  const percentage = Math.round(((latest.score - previous.score) / previous.score) * 100);
  if (percentage > 0) {
    return { label: `+${percentage}%`, tone: "is-up" };
  }
  if (percentage < 0) {
    return { label: `${percentage}%`, tone: "is-down" };
  }
  return { label: "유지", tone: "is-steady" };
}

function formatCompactNumber(value) {
  const number = Math.round(Number(value) || 0);
  if (number >= 10000) {
    return `${(number / 1000).toFixed(number >= 100000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return number.toLocaleString("ko-KR");
}

function getWorkoutStats(workouts) {
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

function getCompletedDateKeys(history, includeToday) {
  const keys = new Set(history.map((session) => session.dateKey).filter(Boolean));

  if (includeToday) {
    keys.add(getDateKey(new Date()));
  }

  return keys;
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStreak(dateKeys) {
  let streak = 0;
  const date = new Date();

  while (dateKeys.has(getDateKey(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function getMonthCount(dateKeys) {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return [...dateKeys].filter((key) => key.startsWith(monthPrefix)).length;
}

function renderWeekStrip(dateKeys) {
  const weekStrip = document.querySelector("#weekStrip");

  if (!weekStrip) {
    return;
  }

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  weekStrip.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const key = getDateKey(date);
    const classes = [
      dateKeys.has(key) ? "done" : "",
      key === getDateKey(today) ? "today" : ""
    ].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" aria-label="${key}">${dayLabels[date.getDay()]}</button>`;
  }).join("");
}

function renderMonthGrid(dateKeys) {
  const grid = document.querySelector("#calendarGrid");

  if (!grid) {
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(now);
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push("<span></span>");
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const key = getDateKey(new Date(year, month, day));
    const classes = [
      dateKeys.has(key) ? "checked" : "",
      key === todayKey ? "today" : ""
    ].filter(Boolean).join(" ");
    cells.push(`<span class="${classes}" aria-label="${key}">${day}</span>`);
  }

  grid.innerHTML = cells.join("");
}

function renderHistory(history) {
  const list = document.querySelector("#historyList");

  if (!list) {
    return;
  }

  if (history.length === 0) {
    list.innerHTML = `<p class="empty-history">아직 완료한 운동이 없어요.</p>`;
    return;
  }

  list.innerHTML = history.slice(0, 6).map((session) => `
    <article class="history-card">
      <div>
        <strong>${escapeHtml(session.title || "운동 기록")}</strong>
        <span>${formatHistoryDate(session.finishedAt)} · ${session.exerciseCount || 0}개 운동</span>
      </div>
      <div>
        <strong>${session.doneSets || 0}/${session.totalSets || 0}</strong>
        <span>${formatNumber(session.volume || 0)}kg</span>
      </div>
    </article>
  `).join("");
}

function formatHistoryDate(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString("ko-KR");
}

app.setupMain = setupMain;
})(window.Gmymate = window.Gmymate || {});
