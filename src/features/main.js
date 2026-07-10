import { profileLabels, weeklyLabels } from "../core/data.js";
import { getProfile, readJson, setText, showToast, writeJson } from "../core/storage.js";

const DEFAULT_SETTINGS = {
  weightStepKg: 1,
  restSeconds: 90,
  largeTouch: false,
  easyWords: true,
  workoutAlert: false,
  beginnerMode: true
};

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

export function setupMain() {
  const main = document.querySelector(".main-screen");

  if (!main) {
    return;
  }

  setupProfile();
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
      showToast(input.checked ? "작은 습관 완료!" : "체크를 해제했어요.");
    });
  });
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson("gmymateSettings", {}) };
}

function saveSettings(settings) {
  writeJson("gmymateSettings", settings);
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
  bindSettingToggle(workoutAlertInput, "workoutAlert");
  bindSettingToggle(beginnerModeInput, "beginnerMode");
  applySettings(settings);

  exportButton?.addEventListener("click", exportData);

  resetTodayButton?.addEventListener("click", () => {
    writeJson("gmymateWorkoutLogsV2", []);
    writeJson("gmymateWorkoutNote", "");
    window.dispatchEvent(new CustomEvent("gmymate:workouts-changed"));
    showToast("오늘 기록을 비웠어요.");
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
  const history = readJson("gmymateWorkoutHistory", []);
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
  renderHistory(history);
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
        <strong>${session.title || "운동 기록"}</strong>
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
