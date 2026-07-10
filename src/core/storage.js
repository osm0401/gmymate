(function attachStorage(app) {
function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getProfile() {
  return readJson("gmymateProfile", {});
}

function setText(id, value) {
  const element = document.querySelector(`#${id}`);

  if (element) {
    element.textContent = value;
  }
}

function showToast(message) {
  const toast = document.querySelector("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Object.assign(app, {
  readJson,
  writeJson,
  getProfile,
  setText,
  showToast,
  escapeHtml
});
})(window.Gmymate = window.Gmymate || {});
