import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyVolumeBuckets } from "../src/core/weekly-volume.js";
import { formatWeeklyVolumeLabel, buildWeeklyVolumeMarkup, setupWeeklyVolumeTrend } from "../src/features/weekly-volume-trend.js";

const NOW = new Date("2026-08-10T12:00:00+09:00");

function createElementStub() {
  return { innerHTML: "", hidden: false };
}

function createDocumentStub(elements) {
  return { querySelector: (selector) => elements[selector] ?? null };
}

function createLocalStorageStub(data) {
  const store = { ...data };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    }
  };
}

// --- src/core/weekly-volume.js -------------------------------------------

test("빈 기록이면 오래된 주부터 현재 주까지 정확히 6개의 0kg 버킷을 만든다", () => {
  const buckets = buildWeeklyVolumeBuckets([], { count: 6, now: NOW });

  assert.equal(buckets.length, 6);
  buckets.forEach((bucket) => assert.equal(bucket.volume, 0));
  assert.equal(buckets[5].weekStartKey, "2026-08-09");
  assert.equal(buckets[5].isCurrent, true);
  assert.equal(buckets[0].isCurrent, false);
});

test("같은 주의 여러 세션 볼륨을 합산한다", () => {
  const history = [
    { dateKey: "2026-08-09", volume: 600 },
    { dateKey: "2026-08-10", workouts: [{ sets: [{ done: true, weight: 50, reps: 8 }] }] }
  ];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets[5].volume, 1000);
});

test("토요일 기록은 일요일 경계를 넘지 않고 직전 주에 들어간다", () => {
  const history = [{ dateKey: "2026-08-08", volume: 500 }];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets[4].weekStartKey, "2026-08-02");
  assert.equal(buckets[4].volume, 500);
  assert.equal(buckets[5].volume, 0);
});

test("기록이 없는 중간 주도 제거되지 않고 0 버킷으로 유지된다", () => {
  const history = [
    { dateKey: "2026-07-05", volume: 100 },
    { dateKey: "2026-08-09", volume: 200 }
  ];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets.length, 6);
  assert.equal(buckets[1].volume, 0);
  assert.equal(buckets[2].volume, 0);
  assert.equal(buckets[3].volume, 0);
});

test("히스토리 순서가 뒤섞여도 결과는 동일하다", () => {
  const a = [
    { dateKey: "2026-08-09", volume: 100 },
    { dateKey: "2026-08-02", volume: 50 }
  ];
  const b = [a[1], a[0]];

  const bucketsA = buildWeeklyVolumeBuckets(a, { count: 6, now: NOW });
  const bucketsB = buildWeeklyVolumeBuckets(b, { count: 6, now: NOW });

  assert.deepEqual(bucketsA.map((bucket) => bucket.volume), bucketsB.map((bucket) => bucket.volume));
});

test("dateKey가 유효하면 finishedAt보다 우선한다", () => {
  const history = [{ dateKey: "2026-08-09", finishedAt: "2026-07-01T00:00:00+09:00", volume: 300 }];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets[5].volume, 300);
  assert.equal(buckets[0].volume, 0);
});

test("dateKey가 없으면 finishedAt을 대체로 사용한다", () => {
  const history = [{ finishedAt: "2026-08-10T09:00:00+09:00", volume: 250 }];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets[5].volume, 250);
});

test("dateKey와 finishedAt이 모두 무효하면 세션을 제외한다", () => {
  const history = [{ dateKey: "invalid", finishedAt: "not-a-date", volume: 999 }];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.volume, 0), 0);
});

test("누락·문자열·음수·NaN 볼륨은 완료 세트에서 재계산한다", () => {
  const invalidVolumes = [undefined, "500", -10, NaN];

  invalidVolumes.forEach((volume) => {
    const history = [
      {
        dateKey: "2026-08-09",
        volume,
        workouts: [{ sets: [{ done: true, weight: 20, reps: 5 }] }]
      }
    ];

    const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });
    assert.equal(buckets[5].volume, 100, `volume=${volume}일 때 재계산되어야 한다`);
  });
});

test("미완료 세트는 볼륨 계산에서 제외한다", () => {
  const history = [
    {
      dateKey: "2026-08-09",
      workouts: [
        {
          sets: [
            { done: true, weight: 10, reps: 5 },
            { done: false, weight: 1000, reps: 1000 }
          ]
        }
      ]
    }
  ];

  const buckets = buildWeeklyVolumeBuckets(history, { count: 6, now: NOW });

  assert.equal(buckets[5].volume, 50);
});

test("입력 배열과 세션/운동/세트 객체를 변경하지 않는다", () => {
  const history = Object.freeze([
    Object.freeze({
      dateKey: "2026-08-09",
      workouts: Object.freeze([
        Object.freeze({ sets: Object.freeze([Object.freeze({ done: true, weight: 10, reps: 5 })]) })
      ])
    })
  ]);

  assert.doesNotThrow(() => buildWeeklyVolumeBuckets(history, { count: 6, now: NOW }));
});

// --- src/features/weekly-volume-trend.js ----------------------------------

test("formatWeeklyVolumeLabel은 0을 대시로, 나머지는 반올림된 kg으로 표시한다", () => {
  assert.equal(formatWeeklyVolumeLabel(0), "-");
  assert.equal(formatWeeklyVolumeLabel(999.6), "1,000kg");
});

test("buildWeeklyVolumeMarkup은 6개 열과 접근 가능한 데이터 표를 함께 만든다", () => {
  const buckets = buildWeeklyVolumeBuckets(
    [{ dateKey: "2026-08-09", volume: 1000 }],
    { count: 6, now: NOW }
  );

  const { hasVolume, columnsHtml, tableHtml } = buildWeeklyVolumeMarkup(buckets);

  assert.equal(hasVolume, true);
  assert.equal((columnsHtml.match(/weekly-volume-column/g) || []).length, 6);
  assert.match(columnsHtml, /data-week-start="2026-08-09"/);
  assert.match(columnsHtml, /data-volume="1000"/);
  assert.match(tableHtml, /1,000kg/);
  assert.match(tableHtml, /<table/);
});

test("6주 모두 0이면 hasVolume이 false다", () => {
  const buckets = buildWeeklyVolumeBuckets([], { count: 6, now: NOW });
  const { hasVolume } = buildWeeklyVolumeMarkup(buckets);

  assert.equal(hasVolume, false);
});

test("setupWeeklyVolumeTrend은 저장된 기록으로 차트와 표를 채우고 이벤트 후 다시 그린다", () => {
  const chart = createElementStub();
  const table = createElementStub();
  const emptyState = createElementStub();

  globalThis.document = createDocumentStub({
    "#weeklyVolumeTrend": {},
    "#weeklyVolumeChart": chart,
    "#weeklyVolumeTable": table,
    "#weeklyVolumeEmptyState": emptyState
  });
  globalThis.window = new EventTarget();
  globalThis.localStorage = createLocalStorageStub({
    gmymateWorkoutHistory: JSON.stringify([{ dateKey: "2026-08-09", volume: 1000 }])
  });

  setupWeeklyVolumeTrend();

  assert.match(chart.innerHTML, /1,000kg/);
  assert.equal(chart.hidden, false);
  assert.equal(emptyState.hidden, true);

  globalThis.localStorage.setItem(
    "gmymateWorkoutHistory",
    JSON.stringify([])
  );
  globalThis.window.dispatchEvent(new CustomEvent("gmymate:workouts-changed"));

  assert.equal(chart.hidden, true);
  assert.equal(emptyState.hidden, false);

  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.localStorage;
});

test("setupWeeklyVolumeTrend은 달력 화면이 아니면 조용히 종료한다", () => {
  globalThis.document = createDocumentStub({});
  globalThis.window = new EventTarget();

  assert.doesNotThrow(() => setupWeeklyVolumeTrend());

  delete globalThis.document;
  delete globalThis.window;
});
