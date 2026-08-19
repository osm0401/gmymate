import {
  calculateRecovery,
  clearCheckinPainAreas,
  getInjuryAreas,
  hasHealthDataConsent,
  normalizeBodyAreas,
  normalizeRecoveryCheckins,
  withHealthDataConsent,
  withInjuryAreas,
  withdrawHealthDataConsent
} from "../core/recovery.js";
import { getDateKey, getProfile, readJson, showToast, writeJson } from "../core/storage.js";

const STORAGE_KEY = "gmymateRecoveryCheckins";

export function setupRecovery() {
  setupRecoveryCheckin();
  setupInjuryProfile();
}

/* 동의 체크박스가 꺼져 있으면 부위 체크박스를 disabled로 막는다. disabled 입력은
   FormData에 아예 포함되지 않으므로(MDN FormData.getAll) 동의 없이는 저장될 값 자체가 없다. */
function syncAreaAvailability(consentInput, areaInputs) {
  areaInputs.forEach((input) => {
    input.disabled = !consentInput.checked;
    if (!consentInput.checked) {
      input.checked = false;
    }
  });
}

function setupRecoveryCheckin() {
  const form = document.querySelector("#recoveryForm");
  const details = document.querySelector("#recoveryCheckin");
  const status = document.querySelector("#recoveryStatus");
  const score = document.querySelector("#recoveryScore");
  const recommendation = document.querySelector("#recoveryRecommendation");
  const consentInput = document.querySelector("#healthDataConsent");

  if (!form || !details || !status || !score || !recommendation || !consentInput) {
    return;
  }

  const areaInputs = [...form.querySelectorAll('input[name="painAreas"]')];
  const today = getDateKey(new Date());
  let checkins = normalizeRecoveryCheckins(readJson(STORAGE_KEY, []));

  const updateOutputs = () => {
    ["sleep", "energy", "soreness"].forEach((name) => {
      const output = form.querySelector(`[data-recovery-output="${name}"]`);
      if (output) output.textContent = form.elements[name].value;
    });
  };

  const render = () => {
    consentInput.checked = hasHealthDataConsent(getProfile());
    syncAreaAvailability(consentInput, areaInputs);

    const current = checkins.find((entry) => entry.dateKey === today);

    if (!current) {
      status.textContent = "아직 입력 전";
      score.textContent = "--";
      recommendation.textContent = "수면, 에너지, 근육 상태를 입력하면 오늘 운동 강도를 추천해드려요.";
      areaInputs.forEach((input) => { input.checked = false; });
      updateOutputs();
      return;
    }

    ["sleep", "energy", "soreness"].forEach((name) => {
      form.elements[name].value = current[name];
    });
    areaInputs.forEach((input) => {
      input.checked = consentInput.checked && current.painAreas.includes(input.value);
    });
    const result = calculateRecovery(current);
    status.textContent = result.status;
    score.textContent = `${result.score}점`;
    recommendation.textContent = result.recommendation;
    updateOutputs();
  };

  form.addEventListener("input", updateOutputs);
  consentInput.addEventListener("change", () => syncAreaAvailability(consentInput, areaInputs));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const result = calculateRecovery(data);

    if (!result.ok) {
      showToast("회복 상태 값을 다시 확인해주세요.");
      return;
    }

    if (consentInput.checked && !hasHealthDataConsent(getProfile())) {
      writeJson("gmymateProfile", withHealthDataConsent(getProfile()));
    }

    const painAreas = consentInput.checked ? normalizeBodyAreas(formData.getAll("painAreas")) : [];

    checkins = normalizeRecoveryCheckins([
      ...checkins.filter((entry) => entry.dateKey !== today),
      { dateKey: today, sleep: Number(data.sleep), energy: Number(data.energy), soreness: Number(data.soreness), painAreas }
    ]).slice(0, 60);
    writeJson(STORAGE_KEY, checkins);
    details.open = false;
    render();
    showToast("오늘 회복 상태를 저장했어요.");
  });

  window.addEventListener("gmymate:data-changed", (event) => {
    if (event.detail?.key === "gmymateProfile") {
      render();
    }
  });

  render();
}

function setupInjuryProfile() {
  const form = document.querySelector("#injuryProfileForm");
  const consentInput = document.querySelector("#injuryHealthDataConsent");
  const withdrawButton = document.querySelector("[data-withdraw-health-consent]");

  if (!form || !consentInput) {
    return;
  }

  const areaInputs = [...form.querySelectorAll('input[name="injuryAreas"]')];

  const render = () => {
    const profile = getProfile();
    consentInput.checked = hasHealthDataConsent(profile);
    syncAreaAvailability(consentInput, areaInputs);
    const injuryAreas = getInjuryAreas(profile);
    areaInputs.forEach((input) => {
      input.checked = consentInput.checked && injuryAreas.includes(input.value);
    });
  };

  consentInput.addEventListener("change", () => syncAreaAvailability(consentInput, areaInputs));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    let profile = getProfile();

    if (consentInput.checked) {
      if (!hasHealthDataConsent(profile)) {
        profile = withHealthDataConsent(profile);
      }
      profile = withInjuryAreas(profile, new FormData(form).getAll("injuryAreas"));
    } else {
      profile = withInjuryAreas(profile, []);
    }

    writeJson("gmymateProfile", profile);
    render();
    showToast("부상 프로필을 저장했어요.");
  });

  withdrawButton?.addEventListener("click", () => {
    if (!window.confirm("통증·부상 정보를 삭제할까요? 수면·에너지·뻐근함 기록은 남아요.")) {
      return;
    }

    writeJson("gmymateProfile", withdrawHealthDataConsent(getProfile()));
    writeJson(STORAGE_KEY, clearCheckinPainAreas(readJson(STORAGE_KEY, [])));
    render();
    showToast("통증·부상 정보를 삭제했어요.");
  });

  window.addEventListener("gmymate:data-changed", (event) => {
    if (event.detail?.key === "gmymateProfile") {
      render();
    }
  });

  render();
}
