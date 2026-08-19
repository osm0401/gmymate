import assert from "node:assert/strict";
import test from "node:test";
import { exerciseCatalog, getExerciseReplacements } from "../src/core/data.js";

test("exercise replacements stay in the same category and exclude exercises already in use", () => {
  const replacements = getExerciseReplacements("chest-press", ["fly"], exerciseCatalog);

  assert.ok(replacements.length > 0);
  assert.ok(replacements.every((exercise) => exercise.category === "가슴"));
  assert.ok(replacements.every((exercise) => !["chest-press", "fly"].includes(exercise.id)));
});

test("unknown exercises have no replacements", () => {
  assert.deepEqual(getExerciseReplacements("unknown", [], exerciseCatalog), []);
});
