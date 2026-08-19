import { clearSyncedData } from "../core/sync.js";

const DEMO_MODE_KEY = "gmymateDemoMode";
const OFFLINE_USER_KEY = "gmymateOfflineUser";

export function setupAccount(user = null) {
  const dialog = document.querySelector("#deleteAccountDialog");
  const form = document.querySelector("#deleteAccountForm");
  const note = document.querySelector("#deleteAccountNote");
  const passwordField = dialog?.querySelector("[data-delete-password-field]");
  const passwordInput = form?.elements.password;

  if (!dialog || !form || !note || !passwordInput) {
    return;
  }

  const isDemo = Boolean(user?.demo);
  passwordField?.toggleAttribute("hidden", isDemo);
  passwordInput.required = !isDemo;

  const close = () => {
    dialog.close();
    form.reset();
    note.textContent = "";
  };

  document.querySelector("[data-open-delete-account]")?.addEventListener("click", () => {
    note.textContent = "";
    dialog.showModal();
    window.requestAnimationFrame(() => (isDemo ? dialog.querySelector("[data-close-delete-account]") : passwordInput)?.focus());
  });

  dialog.querySelectorAll("[data-close-delete-account]").forEach((button) => button.addEventListener("click", close));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      close();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value;

    if (!isDemo && !password) {
      note.textContent = "현재 비밀번호를 입력해주세요.";
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    note.textContent = "삭제하는 중이에요...";

    try {
      if (!isDemo) {
        const response = await fetch("./api/delete-account.php", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ password })
        });
        const result = await response.json();

        if (!response.ok || !result.ok) {
          note.textContent = result.error || "계정을 삭제하지 못했어요.";
          return;
        }
      }

      clearSyncedData();
      localStorage.removeItem(DEMO_MODE_KEY);
      localStorage.removeItem(OFFLINE_USER_KEY);
      window.location.href = "./index.html";
    } catch {
      note.textContent = "서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.";
    } finally {
      submitButton.disabled = false;
    }
  });
}
