import { clearSyncedData } from "./sync.js";
import { DEMO_USER } from "./demo.js";

const DEMO_MODE_KEY = "gmymateDemoMode";
const OFFLINE_USER_KEY = "gmymateOfflineUser";

export async function requireAuth() {
  if (localStorage.getItem(DEMO_MODE_KEY) === "1") {
    return { ok: true, username: DEMO_USER.username, demo: true };
  }

  try {
    const response = await fetch("./api/me.php", { credentials: "same-origin" });
    const result = await response.json();

    if (!result.ok) {
      window.location.href = "./index.html";
      return null;
    }

    localStorage.setItem(OFFLINE_USER_KEY, result.username);
    return result;
  } catch {
    const offlineUsername = localStorage.getItem(OFFLINE_USER_KEY);

    if (offlineUsername) {
      return { ok: true, username: offlineUsername, offline: true };
    }

    window.location.href = "./index.html";
    return null;
  }
}

export async function logout() {
  try {
    if (localStorage.getItem(DEMO_MODE_KEY) !== "1") {
      await fetch("./api/logout.php", { method: "POST", credentials: "same-origin" });
    }
  } finally {
    clearSyncedData();
    localStorage.removeItem(DEMO_MODE_KEY);
    localStorage.removeItem(OFFLINE_USER_KEY);
    window.location.href = "./index.html";
  }
}
