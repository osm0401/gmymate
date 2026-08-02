(function attachCloudSync(app) {
const API_URL = "./api/data.php";
const OWNER_KEY = "gainmuscleCloudOwnerV1";
const DIRTY_KEY = "gainmuscleCloudDirtyV1";
const USER_DATA_KEYS = [
  "gmymateSettings",
  "gmymateHabits",
  "gmymateCustomRoutines",
  "gmymateWorkoutLogsV2",
  "gmymateWorkoutNote",
  "gmymateActiveWorkoutV1",
  "gmymateWorkoutHistory",
  "gmymateRecentExercises",
  "gmymateTimerState"
];

let initializePromise = null;
let activeSaveTimer = null;
let activeRevision = 0;
const domainRevisions = new Map();

function readLocal(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDirtyDomains() {
  return readLocal(DIRTY_KEY, {});
}

function setDomainDirty(domain, dirty) {
  const domains = getDirtyDomains();

  if (dirty) {
    domains[domain] = true;
  } else {
    delete domains[domain];
  }

  writeLocal(DIRTY_KEY, domains);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => null);

  if (!data || !data.success) {
    throw new Error(data?.message || "Cloud sync failed.");
  }

  return data;
}

async function fetchCloud(url, options) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getCloudData() {
  const response = await fetchCloud(`${API_URL}?date=${encodeURIComponent(getDateKey())}`, {
    credentials: "same-origin",
    cache: "no-store"
  });
  const result = await parseResponse(response);
  return result.data;
}

async function postCloud(action, payload = {}) {
  const response = await fetchCloud(API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  return parseResponse(response);
}

function clearUserLocalData() {
  USER_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(DIRTY_KEY);
}

function mergeSessions(cloudHistory, localHistory) {
  const sessions = new Map();

  [...cloudHistory, ...localHistory].forEach((session) => {
    if (session?.id) {
      sessions.set(session.id, session);
    }
  });

  return [...sessions.values()]
    .sort((left, right) => new Date(right.finishedAt || right.dateKey) - new Date(left.finishedAt || left.dateKey))
    .slice(0, 80);
}

function enrichExercises(routines) {
  return routines.map((routine) => ({
    ...routine,
    exercises: routine.exercises.map((item) => {
      const exercise = app.exerciseCatalog.find((candidate) => candidate.id === item.exerciseId);
      return {
        ...item,
        name: exercise?.name || item.name || "운동",
        category: exercise?.category || item.category || "기타",
        equipment: exercise?.equipment || "",
        unit: exercise?.unit || "회",
        description: exercise?.description || "",
        difficulty: exercise?.difficulty || ""
      };
    })
  }));
}

async function runDomainSync(domain, action, payload, onSuccess) {
  const revision = (domainRevisions.get(domain) || 0) + 1;
  domainRevisions.set(domain, revision);
  setDomainDirty(domain, true);

  try {
    const result = await postCloud(action, payload);

    if (domainRevisions.get(domain) === revision) {
      setDomainDirty(domain, false);
      onSuccess?.(result);
    }

    window.dispatchEvent(new CustomEvent("gainmuscle:cloud-saved", { detail: { domain } }));
    return result;
  } catch {
    window.dispatchEvent(new CustomEvent("gainmuscle:cloud-pending", { detail: { domain } }));
    return null;
  }
}

function saveSettings(settings) {
  return runDomainSync("settings", "settings", { settings });
}

function saveHabits(habits) {
  return runDomainSync("habits", "syncHabits", { habits, date: getDateKey() });
}

function syncRoutines(routines) {
  return runDomainSync(
    "routines",
    "syncRoutines",
    { routines: enrichExercises(routines) },
    (result) => {
      if (Array.isArray(result.routines)) {
        writeLocal("gmymateCustomRoutines", result.routines);
        window.dispatchEvent(new CustomEvent("gainmuscle:routines-synced", { detail: result.routines }));
      }
    }
  );
}

function scheduleActiveWorkout(active) {
  activeRevision += 1;
  const revision = activeRevision;
  setDomainDirty("activeWorkout", true);
  window.clearTimeout(activeSaveTimer);
  activeSaveTimer = window.setTimeout(async () => {
    const hasWorkouts = Array.isArray(active.workouts) && active.workouts.length > 0;
    const action = hasWorkouts ? "saveActiveWorkout" : "clearActiveWorkout";
    const payload = hasWorkouts ? { active, date: getDateKey() } : {};

    try {
      await postCloud(action, payload);

      if (activeRevision === revision) {
        setDomainDirty("activeWorkout", false);
      }
    } catch {
      window.dispatchEvent(new CustomEvent("gainmuscle:cloud-pending", { detail: { domain: "activeWorkout" } }));
    }
  }, 650);
}

function completeWorkout(session) {
  window.clearTimeout(activeSaveTimer);
  activeRevision += 1;
  setDomainDirty("history", true);
  setDomainDirty("activeWorkout", true);
  return postCloud("completeWorkout", { session })
    .then((result) => {
      setDomainDirty("history", false);
      setDomainDirty("activeWorkout", false);
      return result;
    })
    .catch(() => {
      window.dispatchEvent(new CustomEvent("gainmuscle:cloud-pending", { detail: { domain: "history" } }));
      return null;
    });
}

async function initializeCloudNow() {
  try {
    let cloud = await getCloudData();
    const ownerId = String(cloud.userId);
    const previousOwner = localStorage.getItem(OWNER_KEY);

    if (previousOwner && previousOwner !== ownerId) {
      clearUserLocalData();
    }

    const firstCloudLoad = !previousOwner || previousOwner !== ownerId;
    const dirty = getDirtyDomains();
    const localSettings = readLocal("gmymateSettings", {});
    const localHabits = readLocal("gmymateHabits", {});
    const localRoutines = readLocal("gmymateCustomRoutines", []);
    const localHistory = readLocal("gmymateWorkoutHistory", []);
    const localWorkouts = readLocal("gmymateWorkoutLogsV2", []);
    const localNote = readLocal("gmymateWorkoutNote", "");
    const localMeta = readLocal("gmymateActiveWorkoutV1", {});

    if (dirty.settings || (firstCloudLoad && Object.keys(localSettings).length > 0)) {
      const settings = { ...cloud.settings, ...localSettings };
      await postCloud("settings", { settings });
      writeLocal("gmymateSettings", settings);
    } else {
      writeLocal("gmymateSettings", cloud.settings || {});
    }
    setDomainDirty("settings", false);

    if (dirty.habits || (firstCloudLoad && cloud.habitEntryCount === 0 && Object.keys(localHabits).length > 0)) {
      await postCloud("syncHabits", { habits: localHabits, date: getDateKey() });
    } else {
      writeLocal("gmymateHabits", cloud.habits || {});
    }
    setDomainDirty("habits", false);

    if (dirty.routines || (firstCloudLoad && (cloud.routines || []).length === 0 && localRoutines.length > 0)) {
      const result = await postCloud("syncRoutines", { routines: enrichExercises(localRoutines) });
      writeLocal("gmymateCustomRoutines", result.routines || localRoutines);
    } else {
      writeLocal("gmymateCustomRoutines", cloud.routines || []);
    }
    setDomainDirty("routines", false);

    if (dirty.history || (firstCloudLoad && (cloud.history || []).length === 0 && localHistory.length > 0)) {
      await postCloud("importHistory", { history: localHistory });
      writeLocal("gmymateWorkoutHistory", mergeSessions(cloud.history || [], localHistory));
    } else {
      writeLocal("gmymateWorkoutHistory", cloud.history || []);
    }
    setDomainDirty("history", false);

    if (dirty.activeWorkout || (firstCloudLoad && !cloud.activeWorkout && localWorkouts.length > 0)) {
      await postCloud("saveActiveWorkout", {
        date: getDateKey(),
        active: { workouts: localWorkouts, note: localNote, meta: localMeta }
      });
    } else if (cloud.activeWorkout) {
      writeLocal("gmymateWorkoutLogsV2", cloud.activeWorkout.workouts || []);
      writeLocal("gmymateWorkoutNote", cloud.activeWorkout.note || "");
      writeLocal("gmymateActiveWorkoutV1", cloud.activeWorkout.meta || {});
    } else {
      writeLocal("gmymateWorkoutLogsV2", []);
      writeLocal("gmymateWorkoutNote", "");
      localStorage.removeItem("gmymateActiveWorkoutV1");
    }
    setDomainDirty("activeWorkout", false);

    localStorage.setItem(OWNER_KEY, ownerId);

    if (Number(cloud.exerciseCount) < app.exerciseCatalog.length) {
      postCloud("seedExercises", { exercises: enrichExercises([{ exercises: app.exerciseCatalog }])[0].exercises })
        .catch(() => {});
    }

    window.dispatchEvent(new CustomEvent("gainmuscle:cloud-ready", { detail: { userId: cloud.userId } }));
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent("gainmuscle:cloud-offline"));
    return false;
  }
}

function initializeCloud() {
  if (!initializePromise) {
    initializePromise = initializeCloudNow();
  }

  return initializePromise;
}

app.cloudSync = {
  completeWorkout,
  saveHabits,
  saveSettings,
  scheduleActiveWorkout,
  syncRoutines
};
app.initializeCloud = initializeCloud;
})(window.Gmymate = window.Gmymate || {});
