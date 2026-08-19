const CACHE_NAME = "gainmuscle-shell-v10";
const APP_SHELL = [
  "./",
  "./index.html",
  "./main.html",
  "./onboarding.html",
  "./privacy.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/app-icon.svg",
  "./src/app.css",
  "./src/app.js",
  "./src/core/adfit.js",
  "./src/core/analytics.js",
  "./src/core/auth.js",
  "./src/core/data.js",
  "./src/core/demo.js",
  "./src/core/exercise-guides.js",
  "./src/core/goals.js",
  "./src/core/music-player.js",
  "./src/core/part-icons.js",
  "./src/core/reminders.js",
  "./src/core/recovery.js",
  "./src/core/routines.js",
  "./src/core/storage.js",
  "./src/core/sync.js",
  "./src/features/account.js",
  "./src/features/ai-chat.js",
  "./src/features/analytics.js",
  "./src/features/exercise-guides.js",
  "./src/features/goals.js",
  "./src/features/inbody.js",
  "./src/features/login.js",
  "./src/features/main.js",
  "./src/features/music.js",
  "./src/features/onboarding.js",
  "./src/features/reminders.js",
  "./src/features/recovery.js",
  "./src/features/routines.js",
  "./src/features/tap-effects.js",
  "./src/features/workout-log.js",
  "./src/styles/base.css",
  "./src/styles/calendar.css",
  "./src/styles/components.css",
  "./src/styles/effects.css",
  "./src/styles/login.css",
  "./src/styles/main.css",
  "./src/styles/music.css",
  "./src/styles/onboarding.css",
  "./src/styles/portfolio.css",
  "./src/styles/responsive.css",
  "./src/styles/workout-log.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("./offline.html"))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
