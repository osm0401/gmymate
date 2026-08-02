(function protectAccountPages() {
  document.documentElement.classList.add("auth-checking");

  function redirectToLogin() {
    window.location.replace("./index.html");
  }

  function cacheProfile(profile) {
    if (!profile) {
      return;
    }

    localStorage.setItem("gmymateProfile", JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("gmymate:profile-loaded", { detail: profile }));
  }

  fetch("./api/auth.php", { credentials: "same-origin", cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("unauthorized");
      }

      return response.json();
    })
    .then((data) => {
      if (!data.authenticated) {
        redirectToLogin();
        return;
      }

      cacheProfile(data.user?.profile);
      const currentPage = window.location.pathname.split("/").pop();

      if (currentPage === "main.html" && data.needsOnboarding) {
        window.location.replace("./onboarding.html");
        return;
      }

      document.documentElement.classList.remove("auth-checking");
    })
    .catch(redirectToLogin);

  document.addEventListener("click", async (event) => {
    const logoutButton = event.target.closest("[data-logout]");

    if (!logoutButton) {
      return;
    }

    logoutButton.disabled = true;

    try {
      await fetch("./api/auth.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" })
      });
    } finally {
      localStorage.removeItem("gmymateProfile");
      redirectToLogin();
    }
  });
})();
