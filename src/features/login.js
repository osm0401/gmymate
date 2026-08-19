import { createDemoSnapshot, DEMO_USER } from "../core/demo.js";
import { clearSyncedData } from "../core/sync.js";
import { writeJson } from "../core/storage.js";

const DEMO_MODE_KEY = "gmymateDemoMode";

export function setupLogin() {
  const form = document.querySelector("#loginForm");
  const note = document.querySelector("#loginNote");
  const demoButton = document.querySelector("[data-demo-login]");

  if (!form || !note) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const remember = Boolean(data.remember);

    note.textContent = "로그인하는 중이에요...";

    try {
      const response = await fetch("./api/login.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username, password: data.password, remember })
      });
      const result = await response.json();

      if (!result.ok) {
        note.textContent = result.error || "로그인에 실패했어요.";
        return;
      }

      if (localStorage.getItem("gmymateSyncOwner") !== result.username) {
        clearSyncedData();
      }

      localStorage.removeItem(DEMO_MODE_KEY);
      window.location.href = "./main.html";
    } catch {
      note.textContent = "서버에 연결할 수 없어요.";
    }
  });

  demoButton?.addEventListener("click", () => {
    clearSyncedData();
    Object.entries(createDemoSnapshot(new Date())).forEach(([key, value]) => writeJson(key, value));
    localStorage.setItem(DEMO_MODE_KEY, "1");
    localStorage.setItem("gmymateSyncOwner", DEMO_USER.username);
    localStorage.setItem("gmymateOfflineUser", DEMO_USER.username);
    window.location.href = "./main.html";
  });
}
