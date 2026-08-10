import { mergeGoalIntoProfile, normalizeGoalSettings } from "../core/goals.js";
import { getProfile, showToast, writeJson } from "../core/storage.js";

const ERROR_MESSAGES = {
  "invalid-goal": "목표를 선택해주세요.",
  "invalid-target-weight": "목표 몸무게는 30~250kg 사이, 소수 첫째 자리까지 입력해주세요.",
  "invalid-weekly-workout": "주간 운동 횟수를 선택해주세요."
};

function setupChipField(fieldEl) {
  const input = fieldEl.querySelector('input[type="hidden"]');
  const buttons = Array.from(fieldEl.querySelectorAll(".chip-select-group button"));

  const sync = () => {
    buttons.forEach((button) => button.classList.toggle("selected", button.dataset.value === input.value));
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.value;
      sync();
    });
  });

  return { input, buttons, sync };
}

export function setupGoals() {
  const form = document.querySelector("#goalEditForm");

  if (!form) {
    return;
  }

  const note = form.querySelector("#goalEditNote");
  const weightInput = form.querySelector('input[name="targetWeight"]');
  const goalField = setupChipField(form.querySelector('.goal-field[data-goal-field="goal"]'));
  const weeklyField = setupChipField(form.querySelector('.goal-field[data-goal-field="weeklyWorkout"]'));

  function clearErrors() {
    form.querySelectorAll(".field-error").forEach((el) => {
      el.textContent = "";
    });
    note.textContent = "";
    note.classList.remove("is-error");
  }

  function focusField(field) {
    if (field === "targetWeight") {
      weightInput.focus();
      return;
    }

    (field === "goal" ? goalField : weeklyField).buttons[0]?.focus();
  }

  function showFieldError(field, message) {
    const errorEl = form.querySelector(`.field-error[data-error-for="${field}"]`);

    if (errorEl) {
      errorEl.textContent = message;
    }

    focusField(field);
  }

  function populateForm() {
    const profile = getProfile();
    goalField.input.value = profile.goal || "";
    goalField.sync();
    weightInput.value = profile.targetWeight || "";
    weeklyField.input.value = profile.weeklyWorkout || "";
    weeklyField.sync();
    clearErrors();
  }

  function openForm() {
    populateForm();
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function closeForm() {
    form.hidden = true;
  }

  document.querySelectorAll("[data-open-goal-form]").forEach((button) => {
    button.addEventListener("click", openForm);
  });

  form.querySelector("[data-close-goal-form]")?.addEventListener("click", closeForm);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors();

    const result = normalizeGoalSettings({
      goal: goalField.input.value,
      targetWeight: weightInput.value,
      weeklyWorkout: weeklyField.input.value
    });

    if (!result.ok) {
      showFieldError(result.field, ERROR_MESSAGES[result.reason] || "입력값을 다시 확인해주세요.");
      return;
    }

    const nextProfile = mergeGoalIntoProfile(getProfile(), result.values);

    try {
      writeJson("gmymateProfile", nextProfile);
    } catch {
      note.textContent = "저장 공간이 부족해서 목표를 저장하지 못했어요.";
      note.classList.add("is-error");
      return;
    }

    closeForm();
    showToast("목표를 저장했어요.");
  });
}
