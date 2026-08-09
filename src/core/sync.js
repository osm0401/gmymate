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
  "gmymateBadges"
];

let pushTimer = null;
let syncEnabled = false;

function snapshotLocalData() {
  const data = {};
  SYNCED_KEYS.forEach((key) => {
    data[key] = readJson(key, null);
  });
  return data;
}

function pushSyncNow() {
  fetch("./api/sync.php", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshotLocalData())
  }).catch(() => {
    // offline — local write already happened, next successful sync will catch up
  });
}

export async function pullSync() {
  try {
    const response = await fetch("./api/sync.php", { credentials: "same-origin" });
    const result = await response.json();

    if (result.ok && result.data) {
      SYNCED_KEYS.forEach((key) => {
        if (result.data[key] !== undefined && result.data[key] !== null) {
          writeJson(key, result.data[key]);
        }
      });
    }
  } catch {
    // offline — keep whatever's already in localStorage
  }

  syncEnabled = true;
}

window.addEventListener("gmymate:data-changed", (event) => {
  if (!syncEnabled || !SYNCED_KEYS.includes(event.detail?.key)) {
    return;
  }

  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(pushSyncNow, 1500);
});
