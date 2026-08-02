(function setupAccountAccess() {
  const loginForm = document.querySelector("#loginForm");
  const registerForm = document.querySelector("#registerForm");
  const switchButton = document.querySelector("#authSwitch");
  const title = document.querySelector("#authTitle");
  const message = document.querySelector("#authMessage");

  if (!loginForm || !registerForm || !switchButton || !title || !message) {
    return;
  }

  let mode = "login";

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
  }

  function setBusy(form, busy) {
    form.querySelectorAll("input, button").forEach((control) => {
      control.disabled = busy;
    });
  }

  function showMode(nextMode) {
    mode = nextMode;
    const isRegister = mode === "register";
    loginForm.hidden = isRegister;
    registerForm.hidden = !isRegister;
    title.textContent = isRegister ? "회원가입" : "로그인";
    switchButton.innerHTML = isRegister
      ? "이미 계정이 있나요? <strong>로그인</strong>"
      : "처음이신가요? <strong>회원가입</strong>";
    setMessage("");
    const firstInput = (isRegister ? registerForm : loginForm).querySelector("input");
    window.setTimeout(() => firstInput?.focus(), 50);
  }

  async function request(action, payload = {}) {
    const response = await fetch("./api/auth.php", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload })
    });
    const data = await response.json().catch(() => null);

    if (!data) {
      throw new Error(
        response.status === 404
          ? "서버에 로그인 API 파일이 없어요. api 폴더를 업로드해주세요."
          : "로그인 서버 응답을 확인해주세요."
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "서버에 연결할 수 없어요.");
    }

    return data;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(loginForm).entries());

    if (!values.identifier || !values.password) {
      setMessage("아이디와 비밀번호를 모두 입력해주세요.", true);
      return;
    }

    setBusy(loginForm, true);
    setMessage("로그인하고 있어요.");

    try {
      const data = await request("login", values);
      window.location.replace(data.next || "./main.html");
    } catch (error) {
      setMessage(error.message, true);
      setBusy(loginForm, false);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(registerForm).entries());

    if (values.password !== values.passwordConfirm) {
      setMessage("비밀번호 확인이 일치하지 않아요.", true);
      return;
    }

    if (!registerForm.checkValidity()) {
      registerForm.reportValidity();
      return;
    }

    setBusy(registerForm, true);
    setMessage("계정을 만들고 있어요.");

    try {
      const data = await request("register", values);
      window.location.replace(data.next || "./onboarding.html");
    } catch (error) {
      setMessage(error.message, true);
      setBusy(registerForm, false);
    }
  });

  switchButton.addEventListener("click", () => {
    showMode(mode === "login" ? "register" : "login");
  });

  fetch("./api/auth.php", { credentials: "same-origin" })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      if (data?.authenticated) {
        window.location.replace(data.next || "./main.html");
      }
    })
    .catch(() => {
      const isLocalPreview = window.location.protocol === "file:";
      setMessage(
        isLocalPreview
          ? "로컬 미리보기에서는 로그인할 수 없어요. 닷홈 실행을 선택해주세요."
          : "로그인 서버 파일을 확인해주세요.",
        true
      );
    });
})();
