import { readJson } from "../core/storage.js";
import { buildWeeklyVolumeBuckets } from "../core/weekly-volume.js";

export function formatWeeklyVolumeLabel(volume) {
  const rounded = Math.round(volume);
  return rounded > 0 ? `${rounded.toLocaleString("ko-KR")}kg` : "-";
}

function formatWeekStartLabel(bucket) {
  const base = `${bucket.weekStart.getMonth() + 1}월 ${bucket.weekStart.getDate()}일`;
  return bucket.isCurrent ? `${base} · 진행 중` : base;
}

// DOM 없이 순수하게 마크업 문자열만 만든다. setupWeeklyVolumeTrend가 이 결과를 innerHTML에 꽂는다.
export function buildWeeklyVolumeMarkup(buckets) {
  const hasVolume = buckets.some((bucket) => bucket.volume > 0);
  const maxVolume = Math.max(1, ...buckets.map((bucket) => bucket.volume));

  const columnsHtml = buckets
    .map((bucket) => {
      const heightPct = Math.round((bucket.volume / maxVolume) * 100);

      return `<div class="weekly-volume-column${bucket.isCurrent ? " is-current" : ""}" data-week-start="${bucket.weekStartKey}" data-volume="${bucket.volume}">
        <span class="weekly-volume-value">${formatWeeklyVolumeLabel(bucket.volume)}</span>
        <span class="weekly-volume-bar"><i style="height: ${heightPct}%"></i></span>
        <span class="weekly-volume-label">${formatWeekStartLabel(bucket)}</span>
      </div>`;
    })
    .join("");

  const rowsHtml = buckets
    .map(
      (bucket) => `<tr>
          <th scope="row">${formatWeekStartLabel(bucket)}</th>
          <td>${formatWeeklyVolumeLabel(bucket.volume)}</td>
        </tr>`
    )
    .join("");

  const tableHtml = `<table class="weekly-volume-table">
      <caption>주별 완료 세트 볼륨</caption>
      <thead><tr><th scope="col">주 시작일</th><th scope="col">볼륨</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;

  return { hasVolume, columnsHtml, tableHtml };
}

export function setupWeeklyVolumeTrend() {
  const root = document.querySelector("#weeklyVolumeTrend");

  if (!root) {
    return;
  }

  const chart = document.querySelector("#weeklyVolumeChart");
  const table = document.querySelector("#weeklyVolumeTable");
  const emptyState = document.querySelector("#weeklyVolumeEmptyState");

  function render() {
    const history = readJson("gmymateWorkoutHistory", []);
    const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: new Date() });
    const { hasVolume, columnsHtml, tableHtml } = buildWeeklyVolumeMarkup(buckets);

    if (chart) {
      chart.innerHTML = columnsHtml;
      chart.hidden = !hasVolume;
    }

    if (table) {
      table.innerHTML = tableHtml;
    }

    if (emptyState) {
      emptyState.hidden = hasVolume;
    }
  }

  render();
  window.addEventListener("gmymate:workouts-changed", render);
}
