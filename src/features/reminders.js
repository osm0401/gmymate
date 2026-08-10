import { normalizeReminderSettings, shouldShowWorkoutReminder } from "../core/reminders.js";
import { getDateKey, getProfile, readJson, showToast, writeJson } from "../core/storage.js";

const REMINDER_BODY = "오늘 아직 운동 시작 전이에요. 지금 가볍게 시작해볼까요?";
const LAST_SHOWN_KEY = "gmymateReminderLastShown";
const CHECK_INTERVAL_MS = 60 * 1000;

function getStoredSettings() {
  return readJson("gmymateSettings", {});
}

function saveReminderFields(nextFields) {
  writeJson("gmymateSettings", { ...getStoredSettings(), ...nextFields });
}

function getCompletedDateKeys() {
  const history = readJson("gmymateWorkoutHistory", []);
  return new Set(history.map((session) => session.dateKey).filter(Boolean));
}

function fireNotification() {
  try {
    new Notification("gmymate", { body: REMINDER_BODY });
  } catch {
    showToast(REMINDER_BODY);
  }
}

export function setupReminders() {
  const alertInput = document.querySelector("#workoutAlertSetting");
  const timeInput = document.querySelector("#workoutAlertTimeSetting");
  const dayButtons = Array.from(document.querySelectorAll("[data-alert-day]"));
  const note = document.querySelector("#workoutAlertNote");

  if (!alertInput || !timeInput || dayButtons.length === 0) {
    return;
  }

  function syncDayButtons(days) {
    dayButtons.forEach((button) => {
      button.classList.toggle("selected", days.includes(Number(button.dataset.alertDay)));
    });
  }

  function setControlsEnabled(enabled) {
    timeInput.disabled = !enabled;
    dayButtons.forEach((button) => {
      button.disabled = !enabled;
    });
  }

  function setNote(message) {
    if (note) {
      note.textContent = message;
    }
  }

  function evaluateAndMaybeNotify() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    const settings = normalizeReminderSettings(getStoredSettings());

    if (!settings.workoutAlert) {
      return;
    }

    const shouldShow = shouldShowWorkoutReminder({
      settings,
      completedDateKeys: getCompletedDateKeys(),
      todayWorkouts: readJson("gmymateWorkoutLogsV2", []),
      weeklyTarget: Number(getProfile().weeklyWorkout) || 0,
      lastShownDateKey: readJson(LAST_SHOWN_KEY, null)
    });

    if (!shouldShow) {
      return;
    }

    fireNotification();
    writeJson(LAST_SHOWN_KEY, getDateKey(new Date()));
  }

  function populate() {
    const settings = normalizeReminderSettings(getStoredSettings());
    alertInput.checked = settings.workoutAlert;
    timeInput.value = settings.workoutAlertTime;
    syncDayButtons(settings.workoutAlertDays);
    setControlsEnabled(settings.workoutAlert);
  }

  populate();

  alertInput.addEventListener("change", () => {
    setNote("");

    if (!alertInput.checked) {
      saveReminderFields({ workoutAlert: false });
      setControlsEnabled(false);
      return;
    }

    if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") {
      alertInput.checked = false;
      setNote("이 브라우저는 알림을 지원하지 않아요. 앱을 열어두면 화면 안내로 대신 알려드릴게요.");
      return;
    }

    let permissionRequest;

    try {
      permissionRequest = Notification.requestPermission();
    } catch {
      alertInput.checked = false;
      setNote("지금은 알림을 사용할 수 없어요.");
      return;
    }

    Promise.resolve(permissionRequest).then((permission) => {
      if (permission !== "granted") {
        alertInput.checked = false;
        setNote("알림이 차단돼 있어요. 브라우저 설정에서 gmymate 알림을 허용해주세요.");
        return;
      }

      saveReminderFields({ workoutAlert: true });
      setControlsEnabled(true);
      evaluateAndMaybeNotify();
    }).catch(() => {
      alertInput.checked = false;
      setNote("지금은 알림을 사용할 수 없어요.");
    });
  });

  timeInput.addEventListener("change", () => {
    if (!timeInput.value) {
      return;
    }

    saveReminderFields({ workoutAlertTime: timeInput.value });
    evaluateAndMaybeNotify();
  });

  dayButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const day = Number(button.dataset.alertDay);
      const currentDays = normalizeReminderSettings(getStoredSettings()).workoutAlertDays;
      const nextDays = currentDays.includes(day)
        ? currentDays.filter((selectedDay) => selectedDay !== day)
        : [...currentDays, day].sort((a, b) => a - b);

      if (nextDays.length === 0) {
        return;
      }

      saveReminderFields({ workoutAlertDays: nextDays });
      syncDayButtons(nextDays);
      evaluateAndMaybeNotify();
    });
  });

  let intervalId = null;

  function startInterval() {
    if (intervalId === null) {
      intervalId = window.setInterval(evaluateAndMaybeNotify, CHECK_INTERVAL_MS);
    }
  }

  function stopInterval() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  }

  evaluateAndMaybeNotify();

  if (document.visibilityState === "visible") {
    startInterval();
  }

  window.addEventListener("focus", evaluateAndMaybeNotify);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      evaluateAndMaybeNotify();
      startInterval();
    } else {
      stopInterval();
    }
  });
  window.addEventListener("pagehide", stopInterval);
}
