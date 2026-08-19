import { calculateRecovery, normalizeRecoveryCheckins } from "../core/recovery.js";
import { getDateKey, readJson, showToast, writeJson } from "../core/storage.js";

const STORAGE_KEY = "gmymateRecoveryCheckins";

export function setupRecovery() {
  const form = document.querySelector("#recoveryForm");
  const details = document.querySelector("#recoveryCheckin");
  const status = document.querySelector("#recoveryStatus");
  const score = document.querySelector("#recoveryScore");
  const recommendation = document.querySelector("#recoveryRecommendation");

  if (!form || !details || !status || !score || !recommendation) {
    return;
  }

  const today = getDateKey(new Date());
  let checkins = normalizeRecoveryCheckins(readJson(STORAGE_KEY, []));

  const updateOutputs = () => {
    ["sleep", "energy", "soreness"].forEach((name) => {
      const output = form.querySelector(`[data-recovery-output="${name}"]`);
      if (output) output.textContent = form.elements[name].value;
    });
  };

  const render = () => {
    const current = checkins.find((entry) => entry.dateKey === today);

    if (!current) {
      status.textContent = "아직 입력 전";
      score.textContent = "--";
      recommendation.textContent = "수면, 에너지, 근육 상태를 입력하면 오늘 운동 강도를 추천해드려요.";
      updateOutputs();
      return;
    }

    ["sleep", "energy", "soreness"].forEach((name) => {
      form.elements[name].value = current[name];
    });
    const result = calculateRecovery(current);
    status.textContent = result.status;
    score.textContent = `${result.score}점`;
    recommendation.textContent = result.recommendation;
    updateOutputs();
  };

  form.addEventListener("input", updateOutputs);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const result = calculateRecovery(data);

    if (!result.ok) {
      showToast("회복 상태 값을 다시 확인해주세요.");
      return;
    }

    checkins = normalizeRecoveryCheckins([
      ...checkins.filter((entry) => entry.dateKey !== today),
      { dateKey: today, sleep: Number(data.sleep), energy: Number(data.energy), soreness: Number(data.soreness) }
    ]).slice(0, 60);
    writeJson(STORAGE_KEY, checkins);
    details.open = false;
    render();
    showToast("오늘 회복 상태를 저장했어요.");
  });

  render();
}
