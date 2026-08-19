import { exerciseCatalog } from "./data.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_REFERENCE_DATE = "2026-01-15";
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DEMO_USER = Object.freeze({ username: "demo" });

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validDateKey(value) {
  const match = typeof value === "string" ? value.match(DATE_KEY_PATTERN) : null;

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? value
    : null;
}

function referenceDateKey(value) {
  const direct = validDateKey(value);

  if (direct) {
    return direct;
  }

  if (
    (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number")
    || (typeof value === "string" && (!value.trim() || DATE_KEY_PATTERN.test(value)))
  ) {
    return FALLBACK_REFERENCE_DATE;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return FALLBACK_REFERENCE_DATE;
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function offsetDateKey(dateKey, daysAgo) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

function exercise(exerciseId) {
  return exerciseCatalog.find((entry) => entry.id === exerciseId);
}

function sets(weight, reps, count, done = true) {
  return Array.from({ length: count }, () => ({ weight, reps, done, type: "normal" }));
}

function makeWorkout(dateKey, exerciseId, workoutSets, index = 0) {
  const catalogEntry = exercise(exerciseId);
  return {
    id: `demo-${dateKey}-${exerciseId}-${index + 1}`,
    exerciseId,
    name: catalogEntry.name,
    category: catalogEntry.category,
    sets: workoutSets.map((set) => ({ ...set }))
  };
}

function makeSession(dateKey, title, durationMinutes, workoutSpecs, note = "") {
  const workouts = workoutSpecs.map(([exerciseId, workoutSets], index) => (
    makeWorkout(dateKey, exerciseId, workoutSets, index)
  ));
  const allSets = workouts.flatMap((workout) => workout.sets);

  return {
    id: `demo-session-${dateKey}`,
    title,
    dateKey,
    finishedAt: `${dateKey}T10:30:00.000Z`,
    exerciseCount: workouts.length,
    doneSets: allSets.filter((set) => set.done).length,
    totalSets: allSets.length,
    volume: allSets.filter((set) => set.done)
      .reduce((total, set) => total + set.weight * set.reps, 0),
    durationMinutes,
    note,
    playedTracks: [],
    workouts
  };
}

function makeHistory(referenceKey) {
  return [
    makeSession(offsetDateKey(referenceKey, 1), "등 집중", 52, [
      ["lat-pulldown", sets(40, 10, 3)],
      ["seated-row", sets(42.5, 10, 3)]
    ], "마지막 세트까지 자세 유지"),
    makeSession(offsetDateKey(referenceKey, 2), "하체 기본", 61, [
      ["squat", sets(50, 8, 4)],
      ["leg-press", sets(100, 10, 3)]
    ]),
    makeSession(offsetDateKey(referenceKey, 4), "가슴과 어깨", 47, [
      ["chest-press", sets(35, 10, 3)],
      ["shoulder-press", sets(20, 8, 3)]
    ]),
    makeSession(offsetDateKey(referenceKey, 6), "등 당기기", 45, [
      ["pull-up", sets(0, 7, 3)],
      ["t-bar-row", sets(30, 10, 3)]
    ]),
    makeSession(offsetDateKey(referenceKey, 9), "하체 보강", 49, [
      ["hack-squat", sets(60, 10, 3)],
      ["hip-extension", sets(20, 12, 3)]
    ]),
    makeSession(offsetDateKey(referenceKey, 12), "팔 집중", 38, [
      ["arm-curl", sets(10, 12, 3)],
      ["overhead-extension", sets(15, 12, 3)]
    ]),
    makeSession(offsetDateKey(referenceKey, 16), "유산소와 코어", 41, [
      ["cycle", sets(0, 25, 1)],
      ["kneeling-crunch", sets(0, 15, 3)]
    ])
  ];
}

export function createDemoSnapshot(referenceDate = FALLBACK_REFERENCE_DATE) {
  const referenceKey = referenceDateKey(referenceDate);
  const todayWorkouts = [
    makeWorkout(referenceKey, "squat", [
      ...sets(52.5, 8, 2),
      ...sets(52.5, 8, 1, false)
    ]),
    makeWorkout(referenceKey, "lat-pulldown", [
      ...sets(42.5, 10, 1),
      ...sets(42.5, 10, 2, false)
    ], 1)
  ];

  return deepFreeze({
    gmymateProfile: {
      username: DEMO_USER.username,
      height: "174",
      age: "29",
      weight: "72.4",
      targetWeight: "70",
      experience: "under-2-years",
      goal: "strength",
      weeklyWorkout: "4"
    },
    gmymateSettings: {
      weightStepKg: 2.5,
      restSeconds: 90,
      largeTouch: false,
      easyWords: true,
      workoutAlert: true,
      workoutAlertTime: "18:30",
      workoutAlertDays: [1, 3, 5],
      beginnerMode: false,
      theme: "system"
    },
    gmymateHabits: { protein: true, water: true, stretch: false },
    gmymateRecoveryCheckins: [
      { dateKey: referenceKey, sleep: 4, energy: 4, soreness: 2 }
    ],
    gmymateWorkoutLogsV2: todayWorkouts,
    gmymateWorkoutHistory: makeHistory(referenceKey),
    gmymateInBodyLogs: [
      { date: offsetDateKey(referenceKey, 56), weight: 74.2, muscleMass: 31.1, bodyFat: 21.8 },
      { date: offsetDateKey(referenceKey, 28), weight: 73.1, muscleMass: 31.5, bodyFat: 20.9 },
      { date: referenceKey, weight: 72.4, muscleMass: 31.9, bodyFat: 20.1 }
    ],
    gmymateCustomRoutines: [
      { id: "demo-routine-full-body", name: "전신 기본", exerciseIds: ["squat", "chest-press", "seated-row"] },
      { id: "demo-routine-back", name: "등 집중", exerciseIds: ["lat-pulldown", "seated-row", "t-bar-row"] }
    ]
  });
}
