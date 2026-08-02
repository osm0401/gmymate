(function attachAiChat(app) {
const CHAT_STORAGE_KEY = "gmymateAiChatSessionV1";
const MAX_SAVED_MESSAGES = 20;
const MAX_CONTEXT_MESSAGES = 6;

function setupAiChat() {
  const panel = document.querySelector("#aiChatPanel");
  const sheet = panel?.querySelector(".ai-chat-sheet");
  const messagesElement = document.querySelector("#aiChatMessages");
  const form = document.querySelector("#aiChatForm");
  const input = document.querySelector("#aiChatInput");
  const sendButton = form?.querySelector(".ai-chat-send");
  const openButtons = document.querySelectorAll("[data-chat-open]");
  const closeButtons = panel?.querySelectorAll("[data-chat-close]") || [];
  const promptButtons = panel?.querySelectorAll("[data-chat-prompt]") || [];

  if (!panel || !sheet || !messagesElement || !form || !input || !sendButton || openButtons.length === 0) {
    return;
  }

  let history = readHistory();
  let opener = null;
  let sending = false;
  let activeRequest = null;

  function readHistory() {
    try {
      const value = JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) || "[]");
      if (!Array.isArray(value)) {
        return [];
      }

      return value.filter((message) => (
        message
        && ["user", "assistant"].includes(message.role)
        && typeof message.text === "string"
        && message.text.trim()
      )).slice(-MAX_SAVED_MESSAGES);
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history.slice(-MAX_SAVED_MESSAGES)));
    } catch {
      // The current chat still works when session storage is unavailable.
    }
  }

  function createMessage(role, text, extraClass = "") {
    const message = document.createElement("article");
    const bubble = document.createElement("p");
    message.className = `ai-chat-message is-${role}${extraClass ? ` ${extraClass}` : ""}`;
    message.setAttribute("aria-label", role === "user" ? "내 메시지" : "AI 코치 답변");
    bubble.textContent = text;
    message.appendChild(bubble);
    return message;
  }

  function scrollMessagesToEnd() {
    window.requestAnimationFrame(() => {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    });
  }

  function renderHistory() {
    messagesElement.replaceChildren();
    messagesElement.appendChild(createMessage(
      "assistant",
      "안녕하세요. 궁금한 내용을 편하게 물어보세요."
    ));
    history.forEach((message) => messagesElement.appendChild(createMessage(message.role, message.text)));
    scrollMessagesToEnd();
  }

  function addMessage(role, text) {
    const message = { role, text: String(text).trim() };
    history = [...history, message].slice(-MAX_SAVED_MESSAGES);
    saveHistory();
    messagesElement.appendChild(createMessage(message.role, message.text));
    scrollMessagesToEnd();
  }

  function addLoadingMessage() {
    const loading = createMessage("assistant", "답변을 준비하고 있어요.", "is-loading");
    const bubble = loading.querySelector("p");
    bubble.textContent = "";
    bubble.setAttribute("aria-label", "답변을 준비하고 있어요");

    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("span");
      dot.setAttribute("aria-hidden", "true");
      bubble.appendChild(dot);
    }

    messagesElement.appendChild(loading);
    scrollMessagesToEnd();
    return loading;
  }

  function addErrorMessage(text) {
    const message = createMessage("assistant", text, "is-error");
    messagesElement.appendChild(message);
    scrollMessagesToEnd();
  }

  function addStatusMessage(text) {
    const message = createMessage("assistant", text, "is-status");
    messagesElement.appendChild(message);
    scrollMessagesToEnd();
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
    input.style.overflowY = input.scrollHeight > 96 ? "auto" : "hidden";
  }

  function setSending(isSending) {
    sending = isSending;
    input.disabled = isSending;
    sendButton.disabled = false;
    sendButton.classList.toggle("is-stopping", isSending);
    sendButton.setAttribute("aria-label", isSending ? "AI 답변 중지" : "메시지 보내기");
    sendButton.title = isSending ? "답변 중지" : "메시지 보내기";
    promptButtons.forEach((button) => {
      button.disabled = isSending;
    });
    form.setAttribute("aria-busy", String(isSending));
  }

  function openChat(event) {
    opener = event?.currentTarget || document.activeElement;
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    openButtons.forEach((button) => button.setAttribute("aria-expanded", "true"));
    window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
    scrollMessagesToEnd();
  }

  function closeChat() {
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    openButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
    opener?.focus?.({ preventScroll: true });
  }

  async function requestAnswer(prompt, context, signal) {
    const response = await fetch("./api/gemini.php", {
      method: "POST",
      credentials: "same-origin",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ prompt, history: context })
    });
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("AI 서버 응답을 확인해주세요.");
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      const error = new Error(data.message || "AI 답변을 가져오지 못했어요.");
      error.status = Number(data.errorStatus || response.status);
      throw error;
    }

    return data;
  }

  function stopAnswer() {
    if (!sending || !activeRequest) {
      return;
    }

    sendButton.disabled = true;
    sendButton.setAttribute("aria-label", "AI 답변을 중지하고 있어요");
    activeRequest.abort();
  }

  async function sendMessage() {
    if (sending) {
      stopAnswer();
      return;
    }

    const prompt = input.value.trim();

    if (!prompt) {
      return;
    }

    const context = history.slice(-MAX_CONTEXT_MESSAGES);
    addMessage("user", prompt);
    input.value = "";
    resizeInput();
    const requestController = new AbortController();
    activeRequest = requestController;
    setSending(true);
    const loadingMessage = addLoadingMessage();

    try {
      const data = await requestAnswer(prompt, context, requestController.signal);
      loadingMessage.remove();
      addMessage("assistant", data.reply);
    } catch (error) {
      loadingMessage.remove();
      if (error.name === "AbortError") {
        addStatusMessage("답변을 멈췄어요. 다른 질문을 입력할 수 있어요.");
      } else {
        addErrorMessage(error.status === 401
          ? "로그인이 만료됐어요. 다시 로그인해주세요."
          : error.message || "AI 답변을 가져오지 못했어요.");
      }
    } finally {
      if (activeRequest === requestController) {
        activeRequest = null;
      }
      setSending(false);
      input.focus({ preventScroll: true });
    }
  }

  openButtons.forEach((button) => button.addEventListener("click", openChat));
  closeButtons.forEach((button) => button.addEventListener("click", closeChat));

  promptButtons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.chatPrompt || "";
      resizeInput();
      input.focus({ preventScroll: true });
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });

  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeChat();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = [...sheet.querySelectorAll("button:not(:disabled), textarea:not(:disabled)")];
    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  renderHistory();
  resizeInput();
}

app.setupAiChat = setupAiChat;
})(window.Gmymate = window.Gmymate || {});
