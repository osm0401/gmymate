export function setupTapEffects() {
  const targetSelector = [
    "button",
    ".exercise-option",
    ".exercise-chip",
    ".empty-log-card"
  ].join(",");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(targetSelector);

    if (!target || target.disabled || event.target.closest("input, select, textarea")) {
      return;
    }

    target.classList.remove("is-tapping");
    window.requestAnimationFrame(() => target.classList.add("is-tapping"));
    window.setTimeout(() => target.classList.remove("is-tapping"), 180);

    if (reducedMotion.matches) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "tap-ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;

    target.querySelectorAll(".tap-ripple").forEach((oldRipple) => oldRipple.remove());
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  });
}
