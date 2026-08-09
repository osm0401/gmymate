export function readJson(key, fallback) {
  const raw = localStorage.getItem(key);

  if (raw === null) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("gmymate:data-changed", { detail: { key } }));
}

export function getProfile() {
  return readJson("gmymateProfile", {});
}

export function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWorkoutStats(workouts) {
  return workouts.reduce((stats, workout) => {
    workout.sets.forEach((set) => {
      stats.totalSets += 1;

      if (set.done) {
        stats.doneSets += 1;
        stats.volume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
      }
    });

    return stats;
  }, { doneSets: 0, totalSets: 0, volume: 0 });
}

export function setText(id, value) {
  const element = document.querySelector(`#${id}`);

  if (!element) {
    return;
  }

  const next = String(value);

  /* 값이 실제로 바뀔 때만 살짝 튀게 한다. 첫 렌더(빈 값 → 첫 값)까지 튀면
     화면 열 때마다 숫자가 전부 요동쳐서 산만하므로 제외.
     offsetWidth를 읽어 리플로우를 강제해야 같은 애니메이션이 다시 재생된다. */
  if (element.textContent !== "" && element.textContent !== next) {
    element.classList.remove("value-pop");
    void element.offsetWidth;
    element.classList.add("value-pop");
  }

  element.textContent = next;
}

export function showToast(message) {
  const toast = document.querySelector("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
