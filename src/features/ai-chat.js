const CHAT_STORAGE_KEY = "gmymateAiChatSessionV1";
const MAX_SAVED_MESSAGES = 20;
const MAX_CONTEXT_MESSAGES = 6;

export function setupAiChat(user = null) {
  const panel = document.querySelector("#aiChatPanel");
  const sheet = panel?.querySelector(".ai-chat-sheet");
  const messages = document.querySelector("#aiChatMessages");
  const form = document.querySelector("#aiChatForm");
  const input = document.querySelector("#aiChatInput");
  const sendButton = form?.querySelector(".ai-chat-send");
  const openButtons = document.querySelectorAll("[data-chat-open]");

  if (!panel || !sheet || !messages || !form || !input || !sendButton || openButtons.length === 0) {
    return;
  }

  let history = readHistory();
  let activeRequest = null;
  let opener = null;

  function readHistory() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) || "[]");
      return Array.isArray(stored)
        ? stored.filter((item) => ["user", "assistant"].includes(item?.role) && typeof item.text === "string").slice(-MAX_SAVED_MESSAGES)
        : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history.slice(-MAX_SAVED_MESSAGES)));
    } catch {
      // Chat can continue when session storage is unavailable.
    }
  }

  function messageElement(role, text, className = "") {
    const article = document.createElement("article");
    const bubble = document.createElement("p");
    article.className = `ai-chat-message is-${role}${className ? ` ${className}` : ""}`;
    bubble.textContent = text;
    article.appendChild(bubble);
    return article;
  }

  function scrollToEnd() {
    window.requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  function append(role, text, save = true, className = "") {
    const cleanText = String(text).trim();
    messages.appendChild(messageElement(role, cleanText, className));

    if (save) {
      history = [...history, { role, text: cleanText }].slice(-MAX_SAVED_MESSAGES);
      saveHistory();
    }

    scrollToEnd();
  }

  function render() {
    messages.replaceChildren();
    append("assistant", user?.demo
      ? "샘플 모드입니다. AI 답변은 실제 계정으로 로그인하면 사용할 수 있어요."
      : "안녕하세요. 운동, 회복이나 간단한 계산도 편하게 물어보세요.", false);
    history.forEach((item) => append(item.role, item.text, false));
  }

  function setSending(sending) {
    input.disabled = sending;
    sendButton.classList.toggle("is-stopping", sending);
    sendButton.setAttribute("aria-label", sending ? "AI 답변 중지" : "메시지 보내기");
    form.setAttribute("aria-busy", String(sending));
  }

  function open(event) {
    opener = event.currentTarget;
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    openButtons.forEach((button) => button.setAttribute("aria-expanded", "true"));
    window.requestAnimationFrame(() => input.focus({ preventScroll: true }));
    scrollToEnd();
  }

  function close() {
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    openButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
    opener?.focus?.({ preventScroll: true });
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  }

  async function send() {
    if (activeRequest) {
      activeRequest.abort();
      return;
    }

    const prompt = input.value.trim();
    if (!prompt) {
      return;
    }

    if (user?.demo) {
      append("user", prompt);
      append("assistant", "AI 답변은 실제 계정으로 로그인한 뒤 사용할 수 있어요.", false, "is-status");
      input.value = "";
      resizeInput();
      return;
    }

    const context = history.slice(-MAX_CONTEXT_MESSAGES);
    append("user", prompt);
    input.value = "";
    resizeInput();
    activeRequest = new AbortController();
    setSending(true);
    const loading = messageElement("assistant", "답변을 준비하고 있어요.", "is-loading");
    loading.querySelector("p").innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(loading);
    scrollToEnd();

    try {
      const response = await fetch("./api/gemini.php", {
        method: "POST",
        credentials: "same-origin",
        signal: activeRequest.signal,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ prompt, history: context })
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("AI 서버 응답을 확인해주세요.");
      }

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "AI 답변을 가져오지 못했어요.");
      }

      loading.remove();
      append("assistant", result.reply);
    } catch (error) {
      loading.remove();
      append("assistant", error.name === "AbortError" ? "답변을 멈췄어요." : error.message, false, error.name === "AbortError" ? "is-status" : "is-error");
    } finally {
      activeRequest = null;
      setSending(false);
      input.focus({ preventScroll: true });
    }
  }

  openButtons.forEach((button) => button.addEventListener("click", open));
  panel.querySelectorAll("[data-chat-close]").forEach((button) => button.addEventListener("click", close));
  panel.querySelectorAll("[data-chat-prompt]").forEach((button) => button.addEventListener("click", () => {
    input.value = button.dataset.chatPrompt || "";
    resizeInput();
    input.focus();
  }));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send();
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
      close();
    }
  });

  render();
  resizeInput();
}
