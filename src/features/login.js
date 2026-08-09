export function setupLogin() {
  const form = document.querySelector("#loginForm");
  const note = document.querySelector("#loginNote");

  if (!form || !note) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const remember = Boolean(data.remember);

    note.textContent = "로그인하는 중이에요...";

    try {
      const response = await fetch("./api/login.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username, password: data.password, remember })
      });
      const result = await response.json();

      if (!result.ok) {
        note.textContent = result.error || "로그인에 실패했어요.";
        return;
      }

      window.location.href = "./main.html";
    } catch {
      note.textContent = "서버에 연결할 수 없어요.";
    }
  });
}
