import { clearSyncedData } from "./sync.js";

export async function requireAuth() {
  try {
    const response = await fetch("./api/me.php", { credentials: "same-origin" });
    const result = await response.json();

    if (!result.ok) {
      window.location.href = "./index.html";
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

export async function logout() {
  try {
    await fetch("./api/logout.php", { method: "POST", credentials: "same-origin" });
  } finally {
    clearSyncedData();
    window.location.href = "./index.html";
  }
}
