import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTrendPoints, buildTrendGeometry, formatDateKey } from "../src/features/inbody.js";

test("selectTrendPoints: empty logs returns empty", () => {
  assert.deepEqual(selectTrendPoints([], "muscleMass"), []);
});

test("selectTrendPoints: single valid record returns one point", () => {
  const logs = [{ date: "2026-01-05", muscleMass: 30.5 }];
  assert.deepEqual(selectTrendPoints(logs, "muscleMass"), [{ date: "2026-01-05", value: 30.5 }]);
});

test("selectTrendPoints: two or more records are kept and ordered ascending", () => {
  const logs = [
    { date: "2026-01-10", muscleMass: 31 },
    { date: "2026-01-05", muscleMass: 30 }
  ];
  assert.deepEqual(selectTrendPoints(logs, "muscleMass"), [
    { date: "2026-01-05", value: 30 },
    { date: "2026-01-10", value: 31 }
  ]);
});

test("selectTrendPoints: identical values across records are all kept", () => {
  const logs = [
    { date: "2026-01-01", bodyFat: 20 },
    { date: "2026-01-02", bodyFat: 20 },
    { date: "2026-01-03", bodyFat: 20 }
  ];
  const points = selectTrendPoints(logs, "bodyFat");
  assert.equal(points.length, 3);
  assert.ok(points.every((point) => point.value === 20));
});

test("selectTrendPoints: shuffled dates are sorted ascending", () => {
  const logs = [
    { date: "2026-03-01", bodyFat: 3 },
    { date: "2026-01-01", bodyFat: 1 },
    { date: "2026-02-01", bodyFat: 2 }
  ];
  const points = selectTrendPoints(logs, "bodyFat");
  assert.deepEqual(points.map((point) => point.date), ["2026-01-01", "2026-02-01", "2026-03-01"]);
});

test("selectTrendPoints: more than 8 records keeps only the latest 8 by date", () => {
  const logs = Array.from({ length: 10 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    muscleMass: index
  }));
  const points = selectTrendPoints(logs, "muscleMass");
  assert.equal(points.length, 8);
  assert.deepEqual(points.map((point) => point.date), [
    "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06",
    "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"
  ]);
});

test("selectTrendPoints: more than 8 unsorted records still keeps the latest 8 by date", () => {
  const dates = ["10", "03", "01", "07", "05", "09", "02", "08", "04", "06"];
  const logs = dates.map((day) => ({ date: `2026-01-${day}`, muscleMass: Number(day) }));
  const points = selectTrendPoints(logs, "muscleMass");
  assert.equal(points.length, 8);
  assert.deepEqual(points.map((point) => point.date), [
    "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06",
    "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"
  ]);
});

test("selectTrendPoints: null, empty string, NaN, and Infinity values are excluded", () => {
  const logs = [
    { date: "2026-01-01", muscleMass: null },
    { date: "2026-01-02", muscleMass: "" },
    { date: "2026-01-03", muscleMass: NaN },
    { date: "2026-01-04", muscleMass: Infinity },
    { date: "2026-01-05", muscleMass: -Infinity },
    { date: "2026-01-06", muscleMass: 28.4 }
  ];
  const points = selectTrendPoints(logs, "muscleMass");
  assert.deepEqual(points, [{ date: "2026-01-06", value: 28.4 }]);
});

test("selectTrendPoints: negative values are excluded", () => {
  const logs = [{ date: "2026-01-01", bodyFat: -1 }];
  assert.deepEqual(selectTrendPoints(logs, "bodyFat"), []);
});

test("selectTrendPoints: missing bodyFat only excludes that metric, not muscleMass", () => {
  const logs = [
    { date: "2026-01-01", muscleMass: 30, bodyFat: null },
    { date: "2026-01-02", muscleMass: 31, bodyFat: 18 }
  ];
  assert.equal(selectTrendPoints(logs, "bodyFat").length, 1);
  assert.equal(selectTrendPoints(logs, "muscleMass").length, 2);
});

test("selectTrendPoints: does not mutate the input array or its order", () => {
  const logs = [
    { date: "2026-01-10", muscleMass: 31 },
    { date: "2026-01-05", muscleMass: 30 }
  ];
  const snapshot = logs.map((log) => ({ ...log }));
  selectTrendPoints(logs, "muscleMass");
  assert.deepEqual(logs, snapshot);
});

test("buildTrendGeometry: empty points produce no coords", () => {
  const geometry = buildTrendGeometry([]);
  assert.deepEqual(geometry.coords, []);
  assert.equal(geometry.linePoints, "");
});

test("buildTrendGeometry: a single point is centered with no NaN/Infinity", () => {
  const geometry = buildTrendGeometry([{ date: "2026-01-01", value: 30 }]);
  assert.equal(geometry.coords.length, 1);
  const [point] = geometry.coords;
  assert.equal(point.x, geometry.width / 2);
  assert.equal(point.y, geometry.height / 2);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
});

test("buildTrendGeometry: identical values render as a centered horizontal line", () => {
  const points = [
    { date: "2026-01-01", value: 20 },
    { date: "2026-01-05", value: 20 },
    { date: "2026-01-10", value: 20 }
  ];
  const geometry = buildTrendGeometry(points);
  assert.ok(geometry.coords.every((coord) => coord.y === geometry.height / 2));
  geometry.coords.forEach((coord) => {
    assert.ok(Number.isFinite(coord.x));
    assert.ok(Number.isFinite(coord.y));
  });
});

test("buildTrendGeometry: two or more distinct points produce ordered finite coordinates", () => {
  const points = [
    { date: "2026-01-01", value: 10 },
    { date: "2026-01-05", value: 20 },
    { date: "2026-01-20", value: 15 }
  ];
  const geometry = buildTrendGeometry(points);
  assert.equal(geometry.coords.length, 3);
  geometry.coords.forEach((coord) => {
    assert.ok(Number.isFinite(coord.x));
    assert.ok(Number.isFinite(coord.y));
  });
  // later dates should not produce a smaller x than earlier dates
  assert.ok(geometry.coords[0].x < geometry.coords[1].x);
  assert.ok(geometry.coords[1].x < geometry.coords[2].x);
  assert.equal(geometry.min, 10);
  assert.equal(geometry.max, 20);
});

test("buildTrendGeometry: never produces NaN or Infinity even with duplicate dates", () => {
  const points = [
    { date: "2026-01-01", value: 5 },
    { date: "2026-01-01", value: 8 }
  ];
  const geometry = buildTrendGeometry(points);
  geometry.coords.forEach((coord) => {
    assert.ok(Number.isFinite(coord.x));
    assert.ok(Number.isFinite(coord.y));
  });
});

test("formatDateKey: formats a YYYY-MM-DD string without reinterpreting via Date()", () => {
  assert.equal(formatDateKey("2026-01-05"), "1월 5일");
  assert.equal(formatDateKey("2026-12-31"), "12월 31일");
});
