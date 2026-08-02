(function attachWorkoutLogUtils(app) {
const { escapeHtml } = app;

// workout-log.js에서 쓰는 순수(무상태) 헬퍼. main.js의 동명 함수와 겹치지 않도록
// app.workoutLogUtils 네임스페이스로 노출한다 (docs/collab/decisions.md D-9).
function formatNumber(value) {
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(Math.floor(totalSeconds), 0);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatSavedTime(value) {
  const date = new Date(Number(value) || Date.now());
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function exerciseIcon(name) {
  const initial = escapeHtml(name.slice(0, 1));

  return `
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <rect x="3" y="3" width="38" height="38" rx="12"></rect>
        <path d="M12 22h20M9 16h5v12H9zm21 0h5v12h-5z"></path>
        <text x="22" y="29">${initial}</text>
      </svg>
    `;
}

app.workoutLogUtils = { formatNumber, formatTime, formatSavedTime, exerciseIcon };
})(window.Gmymate = window.Gmymate || {});
