import { summarizeWorkoutHistory } from "../core/analytics.js";
import { escapeHtml, readJson, setText } from "../core/storage.js";

export function setupAnalytics() {
  const chart = document.querySelector("#weeklyVolumeChart");
  const select = document.querySelector("#analyticsExerciseSelect");
  const progress = document.querySelector("#exerciseProgressChart");

  if (!chart || !select || !progress) {
    return;
  }

  const render = () => {
    const summary = summarizeWorkoutHistory(readJson("gmymateWorkoutHistory", []), new Date());
    setText("analyticsSessions", `${summary.last7Days.sessions}회`);
    setText("analyticsVolume", `${formatNumber(summary.last7Days.volume)}kg`);
    setText("analyticsStreak", `${summary.bestStreak}일`);
    renderWeek(chart, summary.last7Days.days);
    renderExerciseOptions(select, summary.exerciseProgress);
    renderProgress(progress, summary.exerciseProgress, select.value);
  };

  select.addEventListener("change", () => {
    const summary = summarizeWorkoutHistory(readJson("gmymateWorkoutHistory", []), new Date());
    renderProgress(progress, summary.exerciseProgress, select.value);
  });
  window.addEventListener("gmymate:data-changed", (event) => {
    if (event.detail?.key === "gmymateWorkoutHistory") {
      render();
    }
  });
  render();
}

function renderWeek(host, days) {
  const max = Math.max(...days.map((day) => day.volume), 1);

  host.innerHTML = days.map((day) => {
    const date = new Date(`${day.dateKey}T00:00:00`);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const height = day.volume ? Math.max(Math.round((day.volume / max) * 100), 6) : 4;
    return `
      <div class="volume-day" title="${escapeHtml(label)} ${formatNumber(day.volume)}kg">
        <span class="volume-bar-track"><i class="volume-bar" style="height:${height}%"></i></span>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }).join("");
}

function renderExerciseOptions(select, exercises) {
  const previous = select.value;

  if (exercises.length === 0) {
    select.innerHTML = '<option value="">기록이 쌓이면 표시돼요</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = exercises.map((exercise) => (
    `<option value="${escapeHtml(exercise.exerciseId)}">${escapeHtml(exercise.name)}</option>`
  )).join("");
  select.value = exercises.some((exercise) => exercise.exerciseId === previous)
    ? previous
    : exercises[0].exerciseId;
}

function renderProgress(host, exercises, exerciseId) {
  const exercise = exercises.find((item) => item.exerciseId === exerciseId);

  if (!exercise) {
    host.innerHTML = '<p class="analytics-empty">완료한 운동 기록이 아직 없어요.</p>';
    return;
  }

  const points = exercise.points.slice(-6);
  const values = points.map((point) => point.bestWeight || point.bestReps);
  const max = Math.max(...values, 1);

  host.innerHTML = `<div class="progress-list">${points.map((point) => {
    const value = point.bestWeight || point.bestReps;
    const label = point.bestWeight ? `${formatNumber(point.bestWeight)}kg × ${point.bestReps}회` : `${point.bestReps}회`;
    return `
      <div class="progress-point">
        <span>${escapeHtml(point.dateKey.slice(5).replace("-", "/"))}</span>
        <span class="progress-point-bar"><i style="width:${Math.max(Math.round((value / max) * 100), 5)}%"></i></span>
        <strong>${escapeHtml(label)}</strong>
      </div>
    `;
  }).join("")}</div>`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}
