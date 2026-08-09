import { escapeHtml, readJson, showToast, writeJson } from "../core/storage.js";

const STORAGE_KEY = "gmymateInBodyLogs";
const METRICS = [
  { key: "weight", label: "몸무게", unit: "kg", color: "var(--app-subtle)" },
  { key: "muscleMass", label: "골격근량", unit: "kg", color: "#2f7bd1" },
  { key: "bodyFat", label: "체지방률", unit: "%", color: "var(--app-danger)" }
];

export function setupInBody() {
  const form = document.querySelector("#inbodyForm");
  const chartsHost = document.querySelector("#inbodyCharts");
  const logListHost = document.querySelector("#inbodyLogList");

  if (!form || !chartsHost) {
    return;
  }

  const dateInput = form.querySelector('input[name="date"]');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    if (!data.date || !data.weight) {
      return;
    }

    const logs = readJson(STORAGE_KEY, []);
    const nextLogs = [
      ...logs.filter((log) => log.date !== data.date),
      {
        date: data.date,
        weight: Number(data.weight),
        muscleMass: data.muscleMass ? Number(data.muscleMass) : null,
        bodyFat: data.bodyFat ? Number(data.bodyFat) : null
      }
    ].sort((a, b) => a.date.localeCompare(b.date));

    writeJson(STORAGE_KEY, nextLogs);
    showToast("인바디 기록을 저장했어요.");
    renderAll(nextLogs);
  });

  logListHost?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-inbody]");

    if (!removeButton) {
      return;
    }

    const nextLogs = readJson(STORAGE_KEY, []).filter((log) => log.date !== removeButton.dataset.removeInbody);
    writeJson(STORAGE_KEY, nextLogs);
    showToast("기록을 지웠어요.");
    renderAll(nextLogs);
  });

  renderAll(readJson(STORAGE_KEY, []));

  function renderAll(logs) {
    renderCharts(logs);
    renderLogList(logs);
  }

  function renderCharts(logs) {
    chartsHost.innerHTML = METRICS.map((metric) => renderMetricChart(logs, metric)).join("");
  }

  function renderLogList(logs) {
    if (!logListHost) {
      return;
    }

    if (logs.length === 0) {
      logListHost.innerHTML = "";
      return;
    }

    logListHost.innerHTML = logs.slice(-8).reverse().map((log) => {
      const metaParts = [`${log.weight}kg`];

      if (log.muscleMass != null) {
        metaParts.push(`골격근량 ${log.muscleMass}kg`);
      }

      if (log.bodyFat != null) {
        metaParts.push(`체지방 ${log.bodyFat}%`);
      }

      return `
        <article class="history-card">
          <div>
            <strong>${escapeHtml(formatLogDate(log.date))}</strong>
            <span>${escapeHtml(metaParts.join(" · "))}</span>
          </div>
          <button class="icon-button" type="button" data-remove-inbody="${escapeHtml(log.date)}" aria-label="${escapeHtml(formatLogDate(log.date))} 기록 삭제">✕</button>
        </article>
      `;
    }).join("");
  }
}

function formatLogDate(dateString) {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function renderMetricChart(logs, metric) {
  const points = logs.filter((log) => log[metric.key] != null);

  if (points.length === 0) {
    return `
      <div class="inbody-metric">
        <span class="soft-label">${metric.label}</span>
        <p class="empty-history">기록이 없어요.</p>
      </div>
    `;
  }

  const values = points.map((point) => Number(point[metric.key]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 80;
  const padding = 10;

  const coords = values.map((value, index) => {
    const x = points.length > 1 ? padding + (index / (points.length - 1)) * (width - padding * 2) : width / 2;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = values.at(-1);

  return `
    <div class="inbody-metric">
      <div class="inbody-metric-head">
        <span class="soft-label">${metric.label}</span>
        <strong>${last}${metric.unit}</strong>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="inbody-sparkline" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${coords.join(" ")}" fill="none" stroke="${metric.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      </svg>
    </div>
  `;
}
