(function attachWorkoutTimer(app) {
// 휴식/세트 타이머 서브시스템. workout-log.js에서 팩토리로 생성해 상태를 캡슐화한다 (decisions.md D-7).
// ctx: readJson/writeJson/getRestSeconds/getSettings/getNextSetLabel/showToast/formatTime + dom refs.
function createWorkoutTimer(ctx) {
  const { readJson, writeJson, getRestSeconds, getSettings, getNextSetLabel, showToast, formatTime, dom } = ctx;
  const { timerDock, timerModeLabel, timerDisplay, timerBar, restStatus, addRestButton, skipRestButton, nextSetButton } = dom;

  let timerIntervalId = null;
  let restCompletionTimeoutId = null;
  let audioContext = null;
  let timerState = restore();

  function restore() {
    const saved = readJson("gmymateTimerState", {});
    const mode = ["set", "rest"].includes(saved.mode) ? saved.mode : "idle";
    const restored = {
      mode,
      setStartedAt: Number(saved.setStartedAt) || 0,
      restEndsAt: Number(saved.restEndsAt) || 0,
      restTotalSeconds: Number(saved.restTotalSeconds) || getRestSeconds()
    };

    if (restored.mode === "set" && !restored.setStartedAt) {
      restored.setStartedAt = Date.now();
    }

    return restored;
  }

  function save() {
    writeJson("gmymateTimerState", timerState);
  }

  function ensureInterval() {
    window.clearInterval(timerIntervalId);
    window.clearTimeout(restCompletionTimeoutId);
    timerIntervalId = timerState.mode === "idle" ? null : window.setInterval(render, 500);
    restCompletionTimeoutId = null;

    if (timerState.mode === "rest") {
      const delay = Math.max(timerState.restEndsAt - Date.now(), 0);
      restCompletionTimeoutId = window.setTimeout(finishRest, delay);
    }
  }

  function startSet() {
    timerState = {
      mode: "set",
      setStartedAt: Date.now(),
      restEndsAt: 0,
      restTotalSeconds: getRestSeconds()
    };
    save();
    ensureInterval();
    render();
  }

  function startRest(seconds = getRestSeconds()) {
    const total = Math.max(Math.round(Number(seconds) || getRestSeconds()), 1);
    primeRestAlert();
    timerState = {
      mode: "rest",
      setStartedAt: 0,
      restEndsAt: Date.now() + total * 1000,
      restTotalSeconds: total
    };
    save();
    ensureInterval();
    render();
  }

  function stop() {
    window.clearInterval(timerIntervalId);
    window.clearTimeout(restCompletionTimeoutId);
    timerIntervalId = null;
    restCompletionTimeoutId = null;
    timerState = {
      mode: "idle",
      setStartedAt: 0,
      restEndsAt: 0,
      restTotalSeconds: getRestSeconds()
    };
    save();
    render();
  }

  function addRest(seconds) {
    if (timerState.mode !== "rest") {
      return;
    }
    timerState.restEndsAt += seconds * 1000;
    timerState.restTotalSeconds += seconds;
    save();
    render();
  }

  function finishRest() {
    if (timerState.mode !== "rest") {
      return;
    }

    const nextSet = getNextSetLabel();
    startSet();
    timerDock?.classList.add("is-rest-complete");
    window.setTimeout(() => timerDock?.classList.remove("is-rest-complete"), 1400);

    if (getSettings().workoutAlert) {
      navigator.vibrate?.([180, 90, 180, 90, 240]);
      playRestCompleteSound();
      showRestCompleteNotification(nextSet);
    }

    showToast(nextSet ? `휴식 끝! ${nextSet}를 시작해요.` : "휴식 끝! 오늘 세트를 모두 완료했어요.");
  }

  function primeRestAlert() {
    if (!getSettings().workoutAlert) {
      return;
    }

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return;
    }

    audioContext ||= new Ctor();
    audioContext.resume?.();
  }

  function playRestCompleteSound() {
    if (!audioContext) {
      return;
    }

    try {
      const now = audioContext.currentTime;
      [0, 0.18].forEach((offset, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = index ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.15);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.17);
      });
    } catch {
      // The visual timer and vibration remain available if audio is blocked.
    }
  }

  function showRestCompleteNotification(nextSet) {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) {
      return;
    }

    try {
      new Notification("GAINMUSCLE · 휴식 끝", {
        body: nextSet ? `${nextSet}를 시작할 차례예요.` : "오늘 세트를 모두 완료했어요.",
        tag: "gmymate-rest-complete"
      });
    } catch {
      // Some mobile browsers only allow notifications through a service worker.
    }
  }

  function render() {
    let displaySeconds = 0;
    let progress = 0;

    if (timerState.mode === "rest") {
      displaySeconds = Math.max(Math.ceil((timerState.restEndsAt - Date.now()) / 1000), 0);

      if (displaySeconds <= 0) {
        finishRest();
        return;
      }

      progress = ((timerState.restTotalSeconds - displaySeconds) / timerState.restTotalSeconds) * 100;
    } else if (timerState.mode === "set") {
      displaySeconds = Math.max(Math.floor((Date.now() - timerState.setStartedAt) / 1000), 0);
    }

    if (timerDock) {
      timerDock.dataset.mode = timerState.mode;
    }

    if (timerModeLabel) {
      timerModeLabel.textContent = timerState.mode === "rest" ? "휴식" : timerState.mode === "set" ? "세트" : "준비";
    }

    if (timerDisplay) {
      timerDisplay.textContent = formatTime(displaySeconds);
    }

    if (timerBar) {
      timerBar.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;
    }

    if (restStatus) {
      restStatus.textContent = timerState.mode === "rest" ? formatTime(displaySeconds) : timerState.mode === "set" ? "세트" : "대기";
    }

    if (addRestButton) {
      addRestButton.hidden = timerState.mode !== "rest";
    }

    if (skipRestButton) {
      skipRestButton.hidden = timerState.mode !== "rest";
    }

    if (nextSetButton) {
      nextSetButton.hidden = timerState.mode === "rest";
    }
  }

  return {
    startSet,
    startRest,
    stop,
    render,
    ensureInterval,
    addRest,
    getMode: () => timerState.mode
  };
}

app.createWorkoutTimer = createWorkoutTimer;
})(window.Gmymate = window.Gmymate || {});
