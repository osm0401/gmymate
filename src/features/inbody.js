import { escapeHtml, getDateKey, readJson, showToast, writeJson } from "../core/storage.js";

const STORAGE_KEY = "gmymateInBodyLogs";
const TREND_LIMIT = 8;
const WEIGHT_METRIC = { key: "weight", label: "몸무게", unit: "kg", color: "var(--app-subtle)" };
const COMPOSITION_METRICS = [
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
    dateInput.value = getDateKey(new Date());
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
    chartsHost.innerHTML = renderWeightChart(logs) +
      COMPOSITION_METRICS.map((metric) => renderCompositionCard(logs, metric)).join("");
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
      const metaParts = [];
      const weight = normalizeMetricValue(log.weight);
      const muscleMass = normalizeMetricValue(log.muscleMass);
      const bodyFat = normalizeMetricValue(log.bodyFat);

      if (weight !== null) {
        metaParts.push(`${weight}kg`);
      }

      if (muscleMass !== null) {
        metaParts.push(`골격근량 ${muscleMass}kg`);
      }

      if (bodyFat !== null) {
        metaParts.push(`체지방 ${bodyFat}%`);
      }

      return `
        <article class="history-card">
          <div>
            <strong>${escapeHtml(formatDateKey(log.date))}</strong>
            <span>${escapeHtml(metaParts.join(" · "))}</span>
          </div>
          <button class="icon-button" type="button" data-remove-inbody="${escapeHtml(log.date)}" aria-label="${escapeHtml(formatDateKey(log.date))} 기록 삭제">✕</button>
        </article>
      `;
    }).join("");
  }
}

// 몸무게 그래프는 이번 변경 범위 밖 — 기존 동작을 그대로 유지한다.
function renderWeightChart(logs) {
  const points = logs.filter((log) => log[WEIGHT_METRIC.key] != null);

  if (points.length === 0) {
    return `
      <div class="inbody-metric">
        <span class="soft-label">${WEIGHT_METRIC.label}</span>
        <p class="empty-history">기록이 없어요.</p>
      </div>
    `;
  }

  const values = points.map((point) => Number(point[WEIGHT_METRIC.key]));
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
        <span class="soft-label">${WEIGHT_METRIC.label}</span>
        <strong>${last}${WEIGHT_METRIC.unit}</strong>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="inbody-sparkline" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${coords.join(" ")}" fill="none" stroke="${WEIGHT_METRIC.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
      </svg>
    </div>
  `;
}

function renderCompositionCard(logs, metric) {
  const points = selectTrendPoints(logs, metric.key);
  const title = `${metric.label}(${metric.unit})`;

  if (points.length === 0) {
    return `
      <figure class="inbody-metric" aria-label="${escapeHtml(`${metric.label} 추이. 기록이 없어요.`)}">
        <figcaption class="inbody-metric-head">
          <span class="soft-label">${escapeHtml(title)}</span>
        </figcaption>
        <p class="empty-history">기록이 없어요.</p>
      </figure>
    `;
  }

  const geometry = buildTrendGeometry(points);
  const first = points[0];
  const latest = points.at(-1);
  const summary = `${metric.label} 추이. ${formatDateKey(first.date)}부터 ${formatDateKey(latest.date)}까지. ` +
    `시작값 ${first.value}${metric.unit}, 최신값 ${latest.value}${metric.unit}.`;

  const markers = geometry.coords.map((coord) =>
    `<circle cx="${coord.x.toFixed(1)}" cy="${coord.y.toFixed(1)}" r="3" fill="${metric.color}"></circle>`
  ).join("");

  return `
    <figure class="inbody-metric" role="img" aria-label="${escapeHtml(summary)}">
      <figcaption class="inbody-metric-head">
        <span class="soft-label">${escapeHtml(title)}</span>
        <strong>${escapeHtml(`${latest.value}${metric.unit}`)}</strong>
      </figcaption>
      <svg viewBox="0 0 ${geometry.width} ${geometry.height}" class="inbody-sparkline" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${geometry.linePoints}" fill="none" stroke="${metric.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${markers}
      </svg>
      <dl class="inbody-metric-stats">
        <div><dt>최솟값</dt><dd>${escapeHtml(`${geometry.min}${metric.unit}`)}</dd></div>
        <div><dt>최댓값</dt><dd>${escapeHtml(`${geometry.max}${metric.unit}`)}</dd></div>
        <div><dt>시작일</dt><dd>${escapeHtml(formatDateKey(first.date))}</dd></div>
        <div><dt>종료일</dt><dd>${escapeHtml(formatDateKey(latest.date))}</dd></div>
      </dl>
    </figure>
  `;
}

// null/빈 문자열/NaN/Infinity/음수는 "기록 없음"으로 취급한다. 0은 유효한 값이다.
function normalizeMetricValue(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function isValidDateKey(dateString) {
  return typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

// 순수 날짜 산술 전용 값이며 화면 표시에는 절대 재사용하지 않는다 —
// x좌표 간격 계산 목적의 UTC 기준 일련번호일 뿐이다.
function dateKeyToOrdinal(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

export function formatDateKey(dateString) {
  const [, month, day] = dateString.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

export function selectTrendPoints(logs, metricKey, limit = TREND_LIMIT) {
  const source = Array.isArray(logs) ? logs : [];
  const points = [];

  for (const log of source) {
    if (!log || !isValidDateKey(log.date)) {
      continue;
    }

    const value = normalizeMetricValue(log[metricKey]);

    if (value === null) {
      continue;
    }

    points.push({ date: log.date, value });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points.slice(-limit);
}

export function buildTrendGeometry(points, { width = 280, height = 80, padding = 10 } = {}) {
  if (points.length === 0) {
    return { width, height, min: null, max: null, coords: [], linePoints: "" };
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const isFlat = max === min;
  const valueRange = isFlat ? 1 : max - min;

  const ordinals = points.map((point) => dateKeyToOrdinal(point.date));
  const firstOrdinal = ordinals[0];
  const dateRange = ordinals.at(-1) - firstOrdinal;

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const coords = points.map((point, index) => {
    const x = points.length > 1
      ? padding + (dateRange > 0 ? (ordinals[index] - firstOrdinal) / dateRange : index / (points.length - 1)) * usableWidth
      : width / 2;
    const y = isFlat ? height / 2 : height - padding - ((point.value - min) / valueRange) * usableHeight;
    return { x, y };
  });

  return {
    width,
    height,
    min,
    max,
    coords,
    linePoints: coords.map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(" ")
  };
}
