const SHELL_CACHE = "maestra-shell-v3";
const RUNTIME_CACHE = "maestra-runtime-v1";
const STATIC_CACHE = "maestra-static-v1";
const MAX_PAGES = 40;
const MAX_STATIC = 250;
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

async function trimCache(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}
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
  event.waitUntil(caches.open(SHELL_CACHE).then(async (cache) => {
    await cache.addAll(SHELL_URLS);
    try {
      const offline = await fetch("/offline.html", { cache: "reload", redirect: "error" });
      if (offline.ok) await cache.put("/offline.html", offline);
    } catch {
      // offline.html na mile to bhi install fail nahi hona chahiye
    }
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("maestra-") && key !== SHELL_CACHE && key !== RUNTIME_CACHE && key !== STATIC_CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (IS_LOCAL || request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Build ki hashed files kabhi nahi badalti: pehle cache se do.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(cache.put(request, copy).then(() => trimCache(cache, MAX_STATIC)));
      }
      return response;
    })());
    return;
  }

  // Pages: pehle internet, na ho to pichli dekhi hui copy, phir /offline.html.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          event.waitUntil(caches.open(RUNTIME_CACHE).then(async (cache) => {
            await cache.put(request, copy);
            await trimCache(cache, MAX_PAGES);
          }));
        }
        return response;
      } catch {
        return (await caches.match(request))
          || (await caches.match("/offline.html"))
          || Response.error();
      }
    })());
    return;
  }

  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_USER_CACHE") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
    return;
  }
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
