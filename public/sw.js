const SHELL_CACHE = "maestra-shell-v2";
const BADGE_COUNT_URL = "/__maestra_badge_count__";
const SHELL_URLS = [
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/badge-72.png",
];

async function storeBadgeCount(count) {
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(BADGE_COUNT_URL, new Response(String(Math.max(0, count))));
}

async function readBadgeCount() {
  const cache = await caches.open(SHELL_CACHE);
  const response = await cache.match(BADGE_COUNT_URL);
  if (!response) return 0;
  const count = Number(await response.text());
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

async function updateAppBadge(count) {
  await storeBadgeCount(count);
  if (typeof navigator.setAppBadge === "function") {
    if (count > 0) await navigator.setAppBadge(count);
    else if (typeof navigator.clearAppBadge === "function") await navigator.clearAppBadge();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("maestra-") && key !== SHELL_CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/")) || Response.error())
    );
    return;
  }

  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "APP_OPENED") {
    event.waitUntil(updateAppBadge(0));
    return;
  }
  if (event.data?.type === "BADGE_COUNT" && Number.isFinite(event.data.count)) {
    event.waitUntil(updateAppBadge(Math.max(0, Number(event.data.count))));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "There is a new update." };
  }

  event.waitUntil((async () => {
    const storedCount = await readBadgeCount();
    const count = Number.isFinite(payload.count) ? Math.max(0, Number(payload.count)) : storedCount + 1;
    await Promise.all([
      self.registration.showNotification(payload.title || "Maestra Vibe", {
        body: payload.body || "There is a new update.",
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        tag: payload.tag || "maestra-update",
        renotify: true,
        data: { url: payload.url || "/notifications" },
      }),
      updateAppBadge(count),
    ]);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  const destination = target.origin === self.location.origin ? target.href : new URL("/notifications", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if (existing.url !== destination && "navigate" in existing) await existing.navigate(destination);
      return existing.focus();
    }
    return self.clients.openWindow(destination);
  }));
});
