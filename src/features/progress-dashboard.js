(function attachProgressDashboard(app) {
const { escapeHtml, setText } = app;

// 이 모듈 전용 로컬 헬퍼 — main.js/workout-log.js와 이름이 겹치므로 app.*에 노출하지 않고
// 파일 로컬로 둔다 (docs/collab/decisions.md D-9).
function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString("ko-KR");
}

function formatHistoryDate(value) {
  const date = value ? new Date(value) : new Date();
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function renderProgressDashboard(history) {
  const recentSessions = getSessionsSince(history, 6);
  const recentTotals = recentSessions.reduce((totals, session) => {
    totals.sets += Number(session.doneSets) || countCompletedSets(session);
    totals.volume += Number(session.volume) || calculateSessionVolume(session);
    return totals;
  }, { sets: 0, volume: 0 });
  const weeklyBuckets = getWeeklyVolumeBuckets(history, 6);
  const currentWeek = weeklyBuckets.at(-1)?.volume || 0;
  const previousWeek = weeklyBuckets.at(-2)?.volume || 0;

  setText("progressWeekSessions", `${recentSessions.length}회`);
  setText("progressWeekSets", `${recentTotals.sets}세트`);
  setText("progressWeekVolume", `${formatCompactNumber(recentTotals.volume)}kg`);
  setText("progressTrendLabel", formatVolumeTrend(currentWeek, previousWeek));

  renderWeeklyVolumeChart(weeklyBuckets);
  renderExerciseProgress(history);
}

function getSessionsSince(history, daysAgo) {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - daysAgo);
  return history.filter((session) => getSessionDate(session) >= threshold);
}

function getSessionDate(session) {
  const value = session.finishedAt || (session.dateKey ? `${session.dateKey}T12:00:00` : "");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function countCompletedSets(session) {
  return (session.workouts || []).reduce((total, workout) => (
    total + (workout.sets || []).filter((set) => set.done).length
  ), 0);
}

function calculateSessionVolume(session) {
  return (session.workouts || []).reduce((total, workout) => total + (workout.sets || []).reduce((sum, set) => (
    set.done ? sum + (Number(set.weight) || 0) * (Number(set.reps) || 0) : sum
  ), 0), 0);
}

function getWeekStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

function getWeeklyVolumeBuckets(history, count) {
  const currentStart = getWeekStart(new Date());
  const buckets = Array.from({ length: count }, (_, index) => {
    const start = new Date(currentStart);
    start.setDate(currentStart.getDate() - ((count - 1 - index) * 7));
    return {
      key: getDateKey(start),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      volume: 0
    };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  history.forEach((session) => {
    const bucket = bucketMap.get(getDateKey(getWeekStart(getSessionDate(session))));
    if (bucket) {
      bucket.volume += Number(session.volume) || calculateSessionVolume(session);
    }
  });

  return buckets;
}

function formatVolumeTrend(current, previous) {
  if (!current && !previous) {
    return "첫 기록을 기다려요";
  }

  if (!previous) {
    return "이번 주 첫 기록";
  }

  const percentage = Math.round(((current - previous) / previous) * 100);
  if (percentage === 0) {
    return "지난주와 같아요";
  }
  return `지난주보다 ${percentage > 0 ? "+" : ""}${percentage}%`;
}

function renderWeeklyVolumeChart(buckets) {
  const chart = document.querySelector("#weeklyVolumeChart");

  if (!chart) {
    return;
  }

  const maximum = Math.max(...buckets.map((bucket) => bucket.volume), 1);
  chart.innerHTML = buckets.map((bucket, index) => {
    const height = bucket.volume ? Math.max(Math.round((bucket.volume / maximum) * 100), 8) : 3;
    const label = `${bucket.label} 주, ${formatNumber(bucket.volume)}kg`;
    return `
      <div class="weekly-volume-column ${index === buckets.length - 1 ? "is-current" : ""}" aria-label="${label}">
        <span class="weekly-volume-value">${bucket.volume ? formatCompactNumber(bucket.volume) : "-"}</span>
        <span class="weekly-volume-bar"><i style="height: ${height}%"></i></span>
        <span class="weekly-volume-label">${bucket.label}</span>
      </div>
    `;
  }).join("");
}

function renderExerciseProgress(history) {
  const list = document.querySelector("#exerciseProgressList");

  if (!list) {
    return;
  }

  const progress = collectExerciseProgress(history).slice(0, 5);
  if (!progress.length) {
    list.innerHTML = `<p class="empty-progress">운동을 완료하면 종목별 변화가 여기에 보여요.</p>`;
    return;
  }

  list.innerHTML = progress.map((item) => {
    const change = getPerformanceChange(item.latest, item.previous);
    return `
      <article class="exercise-progress-row">
        <span class="progress-exercise-mark" aria-hidden="true">${escapeHtml(item.name.slice(0, 1))}</span>
        <span class="exercise-progress-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.latest.label)} · ${formatHistoryDate(item.latest.finishedAt)}</small>
        </span>
        <span class="exercise-progress-change ${change.tone}">${change.label}</span>
      </article>
    `;
  }).join("");
}

function collectExerciseProgress(history) {
  const records = new Map();
  [...history].reverse().forEach((session) => {
    (session.workouts || []).forEach((workout) => {
      const completedSets = (workout.sets || []).filter((set) => set.done);
      const performance = getBestPerformance(completedSets, workout.exerciseId);

      if (!performance) {
        return;
      }

      const record = records.get(workout.exerciseId) || {
        exerciseId: workout.exerciseId,
        name: workout.name || "운동",
        previous: null,
        latest: null
      };
      record.previous = record.latest;
      record.latest = { ...performance, finishedAt: session.finishedAt || session.dateKey };
      record.name = workout.name || record.name;
      records.set(workout.exerciseId, record);
    });
  });

  return [...records.values()]
    .filter((record) => record.latest)
    .sort((left, right) => new Date(right.latest.finishedAt) - new Date(left.latest.finishedAt));
}

function getBestPerformance(sets, exerciseId) {
  if (!sets.length) {
    return null;
  }

  const weightedSets = sets.filter((set) => Number(set.weight) > 0);
  if (weightedSets.length) {
    const best = weightedSets.reduce((current, set) => {
      const score = Number(set.weight) * (1 + (Number(set.reps) || 0) / 30);
      return !current || score > current.score ? { set, score } : current;
    }, null);
    return {
      score: best.score,
      label: `${formatNumber(best.set.weight)}kg × ${formatNumber(best.set.reps)}회`
    };
  }

  const best = sets.reduce((current, set) => Number(set.reps) > Number(current.reps) ? set : current, sets[0]);
  const unit = exerciseId === "plank" ? "초" : exerciseId && ["treadmill", "cycling", "stair-climber", "rowing-machine"].includes(exerciseId) ? "분" : "회";
  return { score: Number(best.reps) || 0, label: `${formatNumber(best.reps)}${unit}` };
}

function getPerformanceChange(latest, previous) {
  if (!previous || !previous.score) {
    return { label: "첫 기록", tone: "is-new" };
  }

  const percentage = Math.round(((latest.score - previous.score) / previous.score) * 100);
  if (percentage > 0) {
    return { label: `+${percentage}%`, tone: "is-up" };
  }
  if (percentage < 0) {
    return { label: `${percentage}%`, tone: "is-down" };
  }
  return { label: "유지", tone: "is-steady" };
}

function formatCompactNumber(value) {
  const number = Math.round(Number(value) || 0);
  if (number >= 10000) {
    return `${(number / 1000).toFixed(number >= 100000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }
  return number.toLocaleString("ko-KR");
}

app.renderProgressDashboard = renderProgressDashboard;
})(window.Gmymate = window.Gmymate || {});
