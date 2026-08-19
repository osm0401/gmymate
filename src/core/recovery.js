const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PAIN_SAFETY_NOTE = "통증이 있거나 악화되면 중단하고 의료 전문가와 상담하세요.";

export const BODY_AREAS = ["shoulder", "lower-back", "knee", "other"];

export const BODY_AREA_LABELS = {
  shoulder: "어깨",
  "lower-back": "허리",
  knee: "무릎",
  other: "기타"
};

export const HEALTH_DATA_CONSENT_VERSION = 1;

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

/* 알 수 없는 값(스크립트 태그 등)은 버리고 BODY_AREAS 순서로 고정, 최대 4개(=전체 허용값 수)만 반환한다. */
export function normalizeBodyAreas(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const present = new Set(value.filter((item) => typeof item === "string"));
  return BODY_AREAS.filter((area) => present.has(area)).slice(0, 4);
}

export function calculateRecovery(values) {
  const sleep = validScore(values?.sleep);
  const energy = validScore(values?.energy);
  const soreness = validScore(values?.soreness);

  if (sleep === null || energy === null || soreness === null) {
    return { ok: false, reason: "invalid-values" };
  }

  const score = Math.round(((sleep + energy + (6 - soreness)) / 15) * 100);
  let status;
  let recommendation;

  if (score >= 75) {
    status = "준비 좋음";
    recommendation = "평소 계획대로 운동해도 좋아요.";
  } else if (score >= 50) {
    status = "가볍게 진행";
    recommendation = "무게나 세트 수를 조금 줄여 시작해보세요.";
  } else {
    status = "회복 우선";
    recommendation = "오늘은 휴식이나 가벼운 스트레칭을 추천해요.";
  }

  /* 통증 부위가 있으면 "평소 계획대로"처럼 무조건 괜찮다는 문구가 단독으로 나가지 않도록
     안전 문구를 덧붙인다. 점수 계산식 자체는 건드리지 않는다. */
  if (normalizeBodyAreas(values?.painAreas).length > 0) {
    recommendation = `${recommendation} ${PAIN_SAFETY_NOTE}`;
  }

  return { ok: true, score, status, recommendation };
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
        soreness: Number(entry.soreness),
        painAreas: normalizeBodyAreas(entry.painAreas)
      });
    }
  });

  return [...byDate.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/* 프로필의 다른 필드는 그대로 두고 injuryAreas만 바꿔치기하는 불변 함수. */
export function withInjuryAreas(profile, injuryAreas) {
  return {
    ...(profile && typeof profile === "object" ? profile : {}),
    injuryAreas: normalizeBodyAreas(injuryAreas)
  };
}

export function getInjuryAreas(profile) {
  return normalizeBodyAreas(profile?.injuryAreas);
}

/* 운동의 warningAreas와 등록된 부상 부위의 교집합. "other"는 운동별 매핑 대상이 아니므로 제외. */
export function getExerciseWarningAreas(exercise, injuryAreas) {
  const warningAreas = Array.isArray(exercise?.warningAreas) ? exercise.warningAreas : [];
  const areas = normalizeBodyAreas(injuryAreas);
  return BODY_AREAS.filter((area) => area !== "other" && warningAreas.includes(area) && areas.includes(area));
}

export function hasGeneralInjuryNotice(injuryAreas) {
  return normalizeBodyAreas(injuryAreas).includes("other");
}

export function hasHealthDataConsent(profile) {
  return profile?.healthDataConsent?.version === HEALTH_DATA_CONSENT_VERSION;
}

export function withHealthDataConsent(profile, agreedAt = new Date().toISOString()) {
  return {
    ...(profile && typeof profile === "object" ? profile : {}),
    healthDataConsent: { version: HEALTH_DATA_CONSENT_VERSION, agreedAt }
  };
}

/* 동의 철회: 부상 프로필과 동의 기록만 지운다. 수면/에너지/뻐근함 등 나머지 필드는 손대지 않는다. */
export function withdrawHealthDataConsent(profile) {
  const next = { ...(profile && typeof profile === "object" ? profile : {}) };
  delete next.healthDataConsent;
  next.injuryAreas = [];
  return next;
}

export function clearCheckinPainAreas(checkins) {
  return (Array.isArray(checkins) ? checkins : []).map((entry) => ({ ...entry, painAreas: [] }));
}
