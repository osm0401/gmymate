const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function validScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

function validDateKey(value) {
  const match = typeof value === "string" ? value.match(DATE_KEY_PATTERN) : null;
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function calculateRecovery(values) {
  const sleep = validScore(values?.sleep);
  const energy = validScore(values?.energy);
  const soreness = validScore(values?.soreness);

  if (sleep === null || energy === null || soreness === null) {
    return { ok: false, reason: "invalid-values" };
  }

  const score = Math.round(((sleep + energy + (6 - soreness)) / 15) * 100);

  if (score >= 75) {
    return { ok: true, score, status: "준비 좋음", recommendation: "평소 계획대로 운동해도 좋아요." };
  }

  if (score >= 50) {
    return { ok: true, score, status: "가볍게 진행", recommendation: "무게나 세트 수를 조금 줄여 시작해보세요." };
  }

  return { ok: true, score, status: "회복 우선", recommendation: "오늘은 휴식이나 가벼운 스트레칭을 추천해요." };
}

export function normalizeRecoveryCheckins(value) {
  const byDate = new Map();

  (Array.isArray(value) ? value : []).forEach((entry) => {
    const result = calculateRecovery(entry);

    if (entry && validDateKey(entry.dateKey) && result.ok) {
      byDate.set(entry.dateKey, {
        dateKey: entry.dateKey,
        sleep: Number(entry.sleep),
        energy: Number(entry.energy),
        soreness: Number(entry.soreness)
      });
    }
  });

  return [...byDate.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
