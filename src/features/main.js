import { profileLabels, weeklyLabels } from "../core/data.js";
import { escapeHtml, getDateKey, getProfile, getWorkoutStats, readJson, setText, showToast, writeJson } from "../core/storage.js";
import { logout } from "../core/auth.js";

const DEFAULT_SETTINGS = {
  weightStepKg: 1,
  restSeconds: 90,
  largeTouch: false,
  easyWords: true,
  workoutAlert: false,
  beginnerMode: true,
  theme: "system"
};

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

let wakeLock = null;
let wakeLockWanted = false;

async function requestWakeLock() {
  wakeLockWanted = true;

  if (wakeLock || !navigator.wakeLock) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    // wake lock unavailable (e.g. low battery) — ignore
  }
}

function releaseWakeLock() {
  wakeLockWanted = false;
  wakeLock?.release();
  wakeLock = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && wakeLockWanted) {
    requestWakeLock();
  }
});

export function setupMain(user = null) {
  const main = document.querySelector(".main-screen");

  if (!main) {
    return;
  }

  renderGreeting(user?.username);
  setupProfile();
  setupNavigation();
  setupHabits();
  setupSettings();
  renderAppStats();

  window.addEventListener("gmymate:workouts-changed", renderAppStats);
  window.addEventListener("gmymate:settings-changed", renderAppStats);
  window.addEventListener("gmymate:data-changed", (event) => {
    if (event.detail?.key === "gmymateProfile") {
      setupProfile();
      renderAppStats();
    }
  });
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

    if (tabName === "log") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  /* 위임으로 처리해야 내 루틴처럼 나중에 그려지는 카드도 동작한다. */
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-start-workout]");

    if (button) {
      const ids = (button.dataset.routine || "").split(",").map((id) => id.trim()).filter(Boolean);

      if (ids.length) {
        window.dispatchEvent(new CustomEvent("gmymate:start-routine", { detail: { ids } }));

        if (button.dataset.bpm) {
          sessionStorage.setItem("gmymatePendingBpm", button.dataset.bpm);
        }
      } else {
        showToast("좋아요. 첫 세트부터 기록해볼게요.");
      }

      activateTab("log");
    }
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

  if (settings.theme === "light" || settings.theme === "dark") {
    document.documentElement.dataset.theme = settings.theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function setupSettings() {
  const settings = getSettings();
  const weightInput = document.querySelector("#weightStepSetting");
  const restInput = document.querySelector("#restTimerSetting");
  const largeTouchInput = document.querySelector("#largeTouchSetting");
  const easyWordsInput = document.querySelector("#easyWordsSetting");
  const beginnerModeInput = document.querySelector("#beginnerModeSetting");
  const darkModeInput = document.querySelector("#darkModeSetting");
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
  bindSettingToggle(beginnerModeInput, "beginnerMode");
  bindThemeToggle(darkModeInput);
  applySettings(settings);

  exportButton?.addEventListener("click", exportData);
  document.querySelector("[data-import-data]")?.addEventListener("click", importData);
  document.querySelector("[data-logout]")?.addEventListener("click", logout);

  resetTodayButton?.addEventListener("click", () => {
    writeJson("gmymateWorkoutLogsV2", []);
    writeJson("gmymateWorkoutNote", "");
    writeJson("gmymateWorkoutStartedAt", null);
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

function bindThemeToggle(input) {
  if (!input) {
    return;
  }

  const systemPrefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const currentTheme = getSettings().theme;
  input.checked = currentTheme === "dark" || (currentTheme === "system" && systemPrefersDark);

  input.addEventListener("change", () => {
    const nextSettings = getSettings();
    nextSettings.theme = input.checked ? "dark" : "light";
    saveSettings(nextSettings);
    showToast(input.checked ? "다크 모드로 바꿨어요." : "라이트 모드로 바꿨어요.");
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

async function importData() {
  let text;

  try {
    text = await navigator.clipboard.readText();
  } catch {
    showToast("붙여넣기 권한이 필요해요.");
    return;
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    showToast("올바른 백업 데이터가 아니에요.");
    return;
  }

  if (!data || typeof data !== "object") {
    showToast("올바른 백업 데이터가 아니에요.");
    return;
  }

  if (!window.confirm("지금 기록을 복사해둔 데이터로 덮어쓸까요?")) {
    return;
  }

  writeJson("gmymateProfile", data.profile || {});
  writeJson("gmymateWorkoutLogsV2", data.today || []);
  writeJson("gmymateWorkoutHistory", data.history || []);
  writeJson("gmymateSettings", data.settings || {});
  writeJson("gmymateHabits", data.habits || {});
  showToast("데이터를 불러왔어요.");
  window.setTimeout(() => window.location.reload(), 600);
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
  renderGoalProgress(dateKeys);
  renderProfileSummary();
  renderWeeklyGauge(dateKeys);
  renderTodayStats(todayStats);
  renderBalanceHint(history);
  renderPrBoard(history);
  renderBadges(checkBadges(history, streak));
}

function renderPrBoard(history) {
  const prBoardHost = document.querySelector("#prBoardList");

  if (!prBoardHost) {
    return;
  }

  const bestByExercise = {};

  history.forEach((session) => {
    (session.workouts || []).forEach((workout) => {
      workout.sets.forEach((set) => {
        if (!set.done || Number(set.weight) <= 0) {
          return;
        }

        const current = bestByExercise[workout.exerciseId];

        if (!current || Number(set.weight) > current.weight) {
          bestByExercise[workout.exerciseId] = {
            name: workout.name,
            weight: Number(set.weight),
            reps: Number(set.reps),
            dateKey: session.dateKey
          };
        }
      });
    });
  });

  const entries = Object.values(bestByExercise).sort((a, b) => b.weight - a.weight).slice(0, 8);

  if (entries.length === 0) {
    prBoardHost.innerHTML = `<p class="empty-history">아직 기록이 없어요.</p>`;
    return;
  }

  prBoardHost.innerHTML = entries.map((entry) => `
    <article class="history-card">
      <div>
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${formatHistoryDate(entry.dateKey)}</span>
      </div>
      <div>
        <strong>${entry.weight}kg</strong>
        <span>${entry.reps}회</span>
      </div>
    </article>
  `).join("");
}

const BADGE_DEFS = [
  { id: "first-session", label: "첫 운동 완료", check: (ctx) => ctx.history.length >= 1 },
  { id: "streak-7", label: "7일 연속 운동", check: (ctx) => ctx.streak >= 7 },
  { id: "streak-30", label: "30일 연속 운동", check: (ctx) => ctx.streak >= 30 },
  { id: "sets-100", label: "누적 100세트 완료", check: (ctx) => ctx.totalDoneSets >= 100 },
  { id: "volume-10000", label: "누적 볼륨 10,000kg", check: (ctx) => ctx.totalVolume >= 10000 },
  { id: "weight-100", label: "한 세트 100kg 달성", check: (ctx) => ctx.maxSetWeight >= 100 }
];

function checkBadges(history, streak) {
  const totalDoneSets = history.reduce((sum, session) => sum + (session.doneSets || 0), 0);
  const totalVolume = history.reduce((sum, session) => sum + (session.volume || 0), 0);
  const maxSetWeight = history.reduce((max, session) => {
    (session.workouts || []).forEach((workout) => {
      workout.sets.forEach((set) => {
        if (set.done) {
          max = Math.max(max, Number(set.weight) || 0);
        }
      });
    });
    return max;
  }, 0);

  const ctx = { history, streak, totalDoneSets, totalVolume, maxSetWeight };
  const unlocked = new Set(readJson("gmymateBadges", []));
  let newlyUnlocked = null;

  BADGE_DEFS.forEach((badge) => {
    if (!unlocked.has(badge.id) && badge.check(ctx)) {
      unlocked.add(badge.id);
      newlyUnlocked = badge;
    }
  });

  const unlockedIds = [...unlocked];
  writeJson("gmymateBadges", unlockedIds);

  if (newlyUnlocked) {
    showToast(`🏅 뱃지 획득: ${newlyUnlocked.label}`);
  }

  return unlockedIds;
}

function renderBadges(unlockedIds) {
  const badgeHost = document.querySelector("#badgeList");

  if (!badgeHost) {
    return;
  }

  const unlockedSet = new Set(unlockedIds);

  badgeHost.innerHTML = BADGE_DEFS.map((badge) => `
    <div class="badge-chip ${unlockedSet.has(badge.id) ? "is-unlocked" : ""}">
      <span>${unlockedSet.has(badge.id) ? "🏅" : "🔒"}</span>
      <span>${escapeHtml(badge.label)}</span>
    </div>
  `).join("");
}

function renderBalanceHint(history) {
  const hintText = document.querySelector("#balanceHintText");

  if (!hintText) {
    return;
  }

  const lastTrainedByCategory = {};

  history.forEach((session) => {
    (session.workouts || []).forEach((workout) => {
      const existing = lastTrainedByCategory[workout.category];

      if (!existing || session.dateKey > existing) {
        lastTrainedByCategory[workout.category] = session.dateKey;
      }
    });
  });

  const todayKey = getDateKey(new Date());
  let worstCategory = null;
  let worstGapDays = 0;

  Object.entries(lastTrainedByCategory).forEach(([category, lastDateKey]) => {
    const gapDays = Math.round((new Date(todayKey) - new Date(lastDateKey)) / 86400000);

    if (gapDays > worstGapDays) {
      worstGapDays = gapDays;
      worstCategory = category;
    }
  });

  hintText.textContent = worstCategory && worstGapDays >= 5 ? `${worstCategory} 운동 ${worstGapDays}일째 안 했어요.` : "";
}

function getWeekCount(dateKeys) {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  let count = 0;

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);

    if (dateKeys.has(getDateKey(date))) {
      count += 1;
    }
  }

  return count;
}

function maybeCelebrateWeeklyGoal(weeklyDone, weeklyTarget) {
  if (weeklyTarget <= 0 || weeklyDone < weeklyTarget) {
    return;
  }

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const weekKey = getDateKey(sunday);

  if (localStorage.getItem("gmymateWeeklyCelebrated") === weekKey) {
    return;
  }

  localStorage.setItem("gmymateWeeklyCelebrated", weekKey);
  showToast("🎉 이번 주 목표 달성! 정말 잘하고 있어요.");
}

/* 진행 문구는 아크 게이지·스탯 카드와 내용이 겹쳐서 화면에서 뺐다.
   축하 연출은 문구와 무관하게 계속 돌아야 하므로 여기 남긴다. */
function renderGoalProgress(dateKeys) {
  const weeklyTarget = Number(getProfile().weeklyWorkout);

  if (weeklyTarget > 0) {
    maybeCelebrateWeeklyGoal(getWeekCount(dateKeys), weeklyTarget);
  }
}

/* 빈 상태 전환용. 데이터가 없을 땐 맨숫자(--, 0%) 대신 안내 카드를 띄운다. */
function toggleEmptyState(contentId, emptyId, hasData) {
  const content = document.querySelector(`#${contentId}`);
  const empty = document.querySelector(`#${emptyId}`);

  if (content) {
    content.hidden = !hasData;
  }

  if (empty) {
    empty.hidden = hasData;
  }
}

function renderGreeting(username) {
  const greeting = document.querySelector("#homeGreeting");

  if (!greeting) {
    return;
  }

  const hour = new Date().getHours();
  let timeOfDay = "안녕하세요";

  if (hour < 11) {
    timeOfDay = "좋은 아침이에요";
  } else if (hour < 17) {
    timeOfDay = "좋은 오후예요";
  } else if (hour < 22) {
    timeOfDay = "좋은 저녁이에요";
  } else {
    timeOfDay = "오늘도 고생했어요";
  }

  greeting.innerHTML = username
    ? `${timeOfDay}, <b>${escapeHtml(username)}</b>님 👋`
    : `${timeOfDay} 👋`;
}

function renderProfileSummary() {
  const profile = getProfile();
  const hasProfile = Boolean(profile.weight || profile.targetWeight || profile.weeklyWorkout);
  toggleEmptyState("summaryPanel", "profileEmptyState", hasProfile);
}

function renderWeeklyGauge(dateKeys) {
  const gauge = document.querySelector("#weeklyGauge");

  if (!gauge) {
    return;
  }

  const weeklyTarget = Number(getProfile().weeklyWorkout);
  const weeklyDone = getWeekCount(dateKeys);
  const hasTarget = weeklyTarget > 0;

  toggleEmptyState("weeklyGaugeCard", "weeklyGoalEmptyState", hasTarget);

  const caption = document.querySelector("#weeklyGaugeCaption");

  if (caption) {
    caption.hidden = !hasTarget;
  }

  if (!hasTarget) {
    return;
  }

  const percent = Math.min(Math.round((weeklyDone / weeklyTarget) * 100), 100);

  gauge.style.setProperty("--pct", String(percent));
  setText("weeklyGaugePct", `${percent}%`);
  setText("weeklyGaugeCaption", `${weeklyDone}/${weeklyTarget}회`);
}

function renderTodayStats(todayStats) {
  toggleEmptyState("todayStatCard", "todayEmptyState", todayStats.totalSets > 0);
}


function getCompletedDateKeys(history, includeToday) {
  const keys = new Set(history.map((session) => session.dateKey).filter(Boolean));

  if (includeToday) {
    keys.add(getDateKey(new Date()));
  }

  return keys;
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
        <span>${formatHistoryDate(session.finishedAt)} · ${session.exerciseCount || 0}개 운동${session.durationMinutes ? ` · ${session.durationMinutes}분` : ""}${session.playedTracks?.length ? ` · 🎵 ${session.playedTracks.length}곡` : ""}</span>
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
