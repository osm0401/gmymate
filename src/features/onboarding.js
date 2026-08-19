import { onboardingRules } from "../core/data.js";
import { markPendingSync } from "../core/sync.js";
import { getProfile, writeJson } from "../core/storage.js";

export function setupOnboarding() {
  const form = document.querySelector("#onboardingForm");
  const note = document.querySelector("#formNote");

  if (!form || !note) {
    return;
  }

  const savedProfile = getProfile();
  Object.entries(savedProfile).forEach(([key, value]) => {
    const field = form.elements[key];

    if (field) {
      field.value = value;
    }
  });

  const fields = Array.from(form.querySelectorAll(".field"));
  const authActions = form.querySelector(".auth-actions");
  let currentStep = 0;

  const progress = document.createElement("div");
  progress.className = "step-progress";
  progress.innerHTML = `
    <div class="step-progress-bar">
      <span class="step-progress-fill"></span>
    </div>
    <span class="step-progress-text"></span>
  `;
  form.insertBefore(progress, form.firstElementChild);

  const stepActions = document.createElement("div");
  stepActions.className = "step-actions";
  stepActions.innerHTML = `
    <button class="step-button" type="button" data-step-back>이전</button>
    <button class="step-button primary" type="button" data-step-next>다음</button>
  `;
  form.insertBefore(stepActions, authActions);

  const backButton = stepActions.querySelector("[data-step-back]");
  const nextButton = stepActions.querySelector("[data-step-next]");
  const progressFill = progress.querySelector(".step-progress-fill");
  const progressText = progress.querySelector(".step-progress-text");

  function getStepInput(index) {
    return fields[index]?.querySelector("input, select");
  }

  function setNote(message, isError = false) {
    note.textContent = message;
    note.classList.toggle("is-error", isError);
  }

  function showStep(index) {
    const authStep = fields.length;
    currentStep = Math.min(Math.max(index, 0), authStep);

    fields.forEach((field, fieldIndex) => {
      field.classList.toggle("is-active", fieldIndex === currentStep);
    });

    const isAuthStep = currentStep === authStep;
    form.classList.toggle("is-auth-step", isAuthStep);
    backButton.disabled = currentStep === 0;
    nextButton.hidden = isAuthStep;

    if (isAuthStep) {
      progressFill.style.width = "100%";
      progressText.textContent = "로그인";
      setNote("준비됐어요. 로그인하면 바로 시작할 수 있어요.");
      return;
    }

    progressFill.style.width = `${((currentStep + 1) / fields.length) * 100}%`;
    progressText.textContent = `${currentStep + 1} / ${fields.length}`;
    setNote("괜찮아요. 하나씩 천천히 입력하면 돼요.");

    const input = getStepInput(currentStep);
    window.setTimeout(() => input?.focus(), 80);
  }

  function validateCurrentStep() {
    const input = getStepInput(currentStep);

    if (!input || input.value) {
      return true;
    }

    setNote("이 항목을 입력하면 다음으로 넘어갈 수 있어요.", true);
    input.focus();
    return false;
  }

  function setupChipSelect(field) {
    const group = field.querySelector("[data-chip-select]");
    const input = field.querySelector("input[type=hidden]");

    if (!group || !input) {
      return;
    }

    const buttons = Array.from(group.querySelectorAll("button"));
    const syncSelected = () => {
      buttons.forEach((button) => {
        button.classList.toggle("selected", button.dataset.value === input.value);
      });
    };
    syncSelected();

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.value;
        syncSelected();
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  fields.forEach(setupChipSelect);

  fields.forEach((field) => {
    const input = field.querySelector("input, select");
    input?.addEventListener("focus", () => {
      if (input instanceof HTMLInputElement) {
        input.dataset.replaceOnType = "true";
        input.dataset.previousValue = input.value;
        input.select();
      }
    });
    input?.addEventListener("input", () => {
      if (input instanceof HTMLInputElement && input.dataset.replaceOnType === "true") {
        const previousValue = input.dataset.previousValue || "";

        if (previousValue && input.value !== previousValue) {
          if (input.value.startsWith(previousValue)) {
            input.value = input.value.slice(previousValue.length);
          } else if (input.value.endsWith(previousValue)) {
            input.value = input.value.slice(0, -previousValue.length);
          }
        }

        input.dataset.replaceOnType = "false";
        delete input.dataset.previousValue;
      }

      setNote("좋아요. 다음으로 넘어가도 돼요.");
    });
    input?.addEventListener("change", () => setNote("좋아요. 다음으로 넘어가도 돼요."));
    input?.addEventListener("keydown", (event) => {
      if (
        input instanceof HTMLInputElement &&
        input.dataset.replaceOnType === "true" &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        input.value = "";
        input.dataset.replaceOnType = "false";
        delete input.dataset.previousValue;
      }

      if (event.key === "Enter" && validateCurrentStep()) {
        event.preventDefault();
        showStep(currentStep + 1);
      }
    });
  });

  backButton.addEventListener("click", () => showStep(currentStep - 1));
  nextButton.addEventListener("click", () => {
    if (validateCurrentStep()) {
      showStep(currentStep + 1);
    }
  });

  async function finishOnboarding() {
    const profile = Object.fromEntries(new FormData(form).entries());
    const emptyStep = onboardingRules.findIndex((rule) => !profile[rule.name]);

    if (emptyStep >= 0) {
      showStep(emptyStep);
      setNote("비어 있는 항목이 있어요. 하나만 더 입력하면 시작할 수 있어요.", true);
      return;
    }

    const invalidStep = onboardingRules.findIndex((rule) => {
      if (rule.min == null || rule.max == null) {
        return false;
      }

      const value = Number(profile[rule.name]);
      return Number.isNaN(value) || value < rule.min || value > rule.max;
    });

    if (invalidStep >= 0) {
      showStep(invalidStep);
      const rule = onboardingRules[invalidStep];
      setNote(`${rule.label} 값을 다시 확인해주세요.`, true);
      return;
    }

    const username = (profile.username || "").trim();
    const password = profile.password || "";

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setNote("아이디는 영문/숫자/밑줄 3~20자로 입력해주세요.", true);
      return;
    }

    if (password.length < 8) {
      setNote("비밀번호는 8자 이상이어야 해요.", true);
      return;
    }

    setNote("가입하는 중이에요...");

    try {
      const response = await fetch("./api/signup.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();

      if (!result.ok) {
        setNote(result.error || "가입에 실패했어요.", true);
        return;
      }
    } catch {
      setNote("서버에 연결할 수 없어요.", true);
      return;
    }

    delete profile.password;
    markPendingSync(username);
    writeJson("gmymateProfile", profile);
    window.location.href = "./main.html";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    finishOnboarding();
  });

  showStep(0);
}
