import { exerciseGuides, getExerciseGuide, searchExerciseGuides } from "../core/exercise-guides.js";
import { escapeHtml } from "../core/storage.js";

export function setupExerciseGuides() {
  const search = document.querySelector("#exerciseGuideSearch");
  const list = document.querySelector("#exerciseGuideList");
  const dialog = document.querySelector("#exerciseGuideDialog");
  const title = document.querySelector("#exerciseGuideTitle");
  const category = document.querySelector("#exerciseGuideCategory");
  const detail = document.querySelector("#exerciseGuideDetail");

  if (!search || !list || !dialog || !title || !category || !detail) {
    return;
  }

  const render = (guides = exerciseGuides) => {
    list.innerHTML = guides.length ? guides.map((guide) => `
      <button class="exercise-guide-item" type="button" data-guide-id="${escapeHtml(guide.id)}">
        <span>${escapeHtml(guide.category)} · ${escapeHtml(guide.target)}</span>
        <strong>${escapeHtml(guide.name)}</strong>
      </button>
    `).join("") : '<p class="analytics-empty">검색 결과가 없어요.</p>';
  };

  const close = () => dialog.close();

  search.addEventListener("input", () => render(searchExerciseGuides(search.value)));
  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-guide-id]");
    const guide = button ? getExerciseGuide(button.dataset.guideId) : null;

    if (!guide) {
      return;
    }

    title.textContent = guide.name;
    category.textContent = `${guide.category} · ${guide.target}`;
    detail.innerHTML = `
      <section>
        <h3>동작 순서</h3>
        <ol>${guide.cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")}</ol>
      </section>
      <section>
        <h3>주의할 점</h3>
        <p>${escapeHtml(guide.caution)}</p>
      </section>
    `;
    dialog.showModal();
  });
  dialog.querySelector("[data-close-guide]")?.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      close();
    }
  });
  render();
}
