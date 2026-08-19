import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseCatalog } from "../src/core/data.js";
import {
  exerciseGuides,
  getExerciseGuide,
  searchExerciseGuides
} from "../src/core/exercise-guides.js";

test("exerciseGuides covers every catalog exercise exactly once", () => {
  assert.deepEqual(
    exerciseGuides.map((guide) => guide.id).sort(),
    exerciseCatalog.map((exercise) => exercise.id).sort()
  );
  assert.equal(new Set(exerciseGuides.map((guide) => guide.id)).size, exerciseCatalog.length);
});

test("every guide has a target, two or three concise cues, and one caution", () => {
  exerciseGuides.forEach((guide) => {
    assert.ok(guide.target.length > 0, `${guide.id} target`);
    assert.ok(guide.cues.length >= 2 && guide.cues.length <= 3, `${guide.id} cues`);
    assert.ok(guide.cues.every((cue) => typeof cue === "string" && cue.length > 0), `${guide.id} cue text`);
    assert.ok(typeof guide.caution === "string" && guide.caution.length > 0, `${guide.id} caution`);
  });
});

test("guide copy avoids medical claims", () => {
  const copy = JSON.stringify(exerciseGuides);
  assert.doesNotMatch(copy, /치료|완치|질환 예방|재활 효과|통증을 없애/);
});

test("getExerciseGuide looks up trimmed ids and safely handles unknown input", () => {
  assert.equal(getExerciseGuide("  squat  ")?.name, "스쿼트");
  assert.equal(getExerciseGuide("missing"), null);
  assert.equal(getExerciseGuide(null), null);
});

test("searchExerciseGuides searches ids, Korean names, categories, targets, and cues", () => {
  assert.deepEqual(searchExerciseGuides("SEATED-ROW").map((guide) => guide.id), ["seated-row"]);
  assert.ok(searchExerciseGuides("가슴").some((guide) => guide.id === "chest-press"));
  assert.ok(searchExerciseGuides("광배근").some((guide) => guide.id === "lat-pulldown"));
  assert.ok(searchExerciseGuides("발바닥").some((guide) => guide.id === "squat"));
  assert.ok(searchExerciseGuides("무릎을 잠그").some((guide) => guide.id === "leg-press"));
});

test("blank search returns a new complete list while non-string search returns empty", () => {
  const result = searchExerciseGuides("   ");

  assert.deepEqual(result, exerciseGuides);
  assert.notEqual(result, exerciseGuides);
  assert.deepEqual(searchExerciseGuides({}), []);
});

test("exported guide data and helper results are immutable", () => {
  const results = searchExerciseGuides("등");

  assert.ok(Object.isFrozen(exerciseGuides));
  assert.ok(exerciseGuides.every((guide) => Object.isFrozen(guide) && Object.isFrozen(guide.cues)));
  assert.ok(Object.isFrozen(results));
});
