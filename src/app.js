import { setupOnboarding } from "./features/onboarding.js";
import { setupLogin } from "./features/login.js";
import { setupMain } from "./features/main.js";
import { setupGoals } from "./features/goals.js";
import { setupReminders } from "./features/reminders.js";
import { setupRoutines } from "./features/routines.js";
import { setupWorkoutLog } from "./features/workout-log.js";
import { setupInBody } from "./features/inbody.js";
import { setupMusic } from "./features/music.js";
import { setupTapEffects } from "./features/tap-effects.js";
import { setupAnalytics } from "./features/analytics.js";
import { setupExerciseGuides } from "./features/exercise-guides.js";
import { setupAiChat } from "./features/ai-chat.js";
import { setupAccount } from "./features/account.js";
import { setupRecovery } from "./features/recovery.js";
import { requireAuth } from "./core/auth.js";
import { enableOfflineSync, syncAccount } from "./core/sync.js";
import { setupAdFit } from "./core/adfit.js";
import { readJson, writeJson } from "./core/storage.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js?v=10", { updateViaCache: "none" }).catch(() => {}));
}

function currentEffectiveTheme(settings) {
  if (settings.theme === "light" || settings.theme === "dark") {
    return settings.theme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyStoredTheme() {
  const settings = readJson("gmymateSettings", {});

  if (settings.theme === "light" || settings.theme === "dark") {
    document.documentElement.dataset.theme = settings.theme;
  }
}

function bindHeaderThemeToggles() {
  document.querySelectorAll("[data-dark-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const settings = { theme: "system", ...readJson("gmymateSettings", {}) };
      const next = currentEffectiveTheme(settings) === "dark" ? "light" : "dark";
      settings.theme = next;
      writeJson("gmymateSettings", settings);
      document.documentElement.dataset.theme = next;

      const darkModeCheckbox = document.querySelector("#darkModeSetting");
      if (darkModeCheckbox) {
        darkModeCheckbox.checked = next === "dark";
      }
    });
  });
}

applyStoredTheme();
bindHeaderThemeToggles();
setupOnboarding();
setupLogin();
setupTapEffects();

if (document.querySelector(".main-screen")) {
  requireAuth().then(async (user) => {
    if (!user) {
      return;
    }

    if (!user.demo) {
      if (user.offline) {
        enableOfflineSync(user.username);
      } else {
        await syncAccount(user.username);
      }

      window.addEventListener("online", () => syncAccount(user.username));
    }

    setupMain(user);
    setupGoals();
    setupReminders();
    setupRoutines();
    setupWorkoutLog();
    setupInBody();
    setupMusic();
    setupAnalytics();
    setupExerciseGuides();
    setupAiChat(user);
    setupAccount(user);
    setupRecovery();
    setupAdFit();
  });
}
