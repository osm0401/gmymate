// Kakao AdFit ad unit IDs — get them from https://adfit.kakao.com.
// Not a secret: it has to be visible in the page for the ad script to work,
// so there's no benefit to hiding it behind a server round-trip.
const ADFIT_UNITS = {
  home: "DAN-OiYotfmOeEQPSWzn",
  routine: ""
};

export function setupAdFit() {
  const slots = document.querySelectorAll("[data-adfit-slot]");
  let hasUnit = false;

  slots.forEach((slot) => {
    const unitId = ADFIT_UNITS[slot.dataset.adfitSlot];

    if (unitId) {
      slot.dataset.adUnit = unitId;
      hasUnit = true;
    } else {
      slot.closest(".ad-slot")?.setAttribute("hidden", "");
      slot.remove();
    }
  });

  if (hasUnit) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "//t1.daumcdn.net/kas/static/ba.min.js";
    document.body.appendChild(script);
  }
}
