import { readJson, writeJson } from "./storage.js";

const SYNCED_KEYS = [
  "gmymateProfile",
  "gmymateSettings",
  "gmymateHabits",
  "gmymateWorkoutLogsV2",
  "gmymateWorkoutHistory",
  "gmymateWorkoutNote",
  "gmymateRecentExercises",
  "gmymateInBodyLogs",
  "gmymateBadges",
  "gmymateCustomRoutines",
  "gmymateRecoveryCheckins"
];

const OWNER_KEY = "gmymateSyncOwner";
const DIRTY_KEY = "gmymateSyncDirty";
const LOCAL_ONLY_KEYS = ["gmymateReminderLastShown"];

let pushTimer = null;
let syncEnabled = false;
let applyingRemote = false;

function snapshotLocalData() {
  return Object.fromEntries(SYNCED_KEYS.map((key) => [key, readJson(key, null)]));
}

function claimOwner(username) {
  const previousOwner = localStorage.getItem(OWNER_KEY);

  if (previousOwner && previousOwner !== username) {
    clearSyncedData();
  }

  if (username) {
    localStorage.setItem(OWNER_KEY, username);
  }
}

async function pushSyncNow() {
  try {
    const response = await fetch("./api/sync.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshotLocalData())
    });
    const result = await response.json();

    if (!result.ok) {
      return false;
    }

    localStorage.removeItem(DIRTY_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function pullSync(username = null) {
  claimOwner(username);

  try {
    const response = await fetch("./api/sync.php", { credentials: "same-origin" });
    const result = await response.json();

    if (!result.ok) {
      return false;
    }

    if (result.data) {
      applyingRemote = true;

      try {
        SYNCED_KEYS.forEach((key) => {
          if (result.data[key] !== undefined && result.data[key] !== null) {
            writeJson(key, result.data[key]);
          }
        });
      } finally {
        applyingRemote = false;
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    syncEnabled = true;
  }
}

export async function syncAccount(username) {
  claimOwner(username);
  syncEnabled = true;

  if (localStorage.getItem(DIRTY_KEY) === "1" && !(await pushSyncNow())) {
    return false;
  }

  return pullSync(username);
}

export function enableOfflineSync(username) {
  claimOwner(username);
  syncEnabled = true;
}

export function markPendingSync(username) {
  claimOwner(username);
  localStorage.setItem(DIRTY_KEY, "1");
}

export function clearSyncedData() {
  SYNCED_KEYS.forEach((key) => localStorage.removeItem(key));
  LOCAL_ONLY_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem(OWNER_KEY);
  localStorage.removeItem(DIRTY_KEY);
}

window.addEventListener("gmymate:data-changed", (event) => {
  if (!syncEnabled || applyingRemote || !SYNCED_KEYS.includes(event.detail?.key)) {
    return;
  }

  localStorage.setItem(DIRTY_KEY, "1");
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(pushSyncNow, 1500);
});
