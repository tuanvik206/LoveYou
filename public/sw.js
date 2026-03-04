const CACHE_NAME = "loveyou-v6";
const IMAGE_CACHE = "loveyou-images-v2";

const STATIC_ASSETS = ["/", "/manifest.json", "/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !["loveyou-v6", "loveyou-images-v2"].includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// === Fetch: chiến lược phân loại ===
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Bỏ qua các request không phải GET
  if (request.method !== "GET") return;

  // Bỏ qua Supabase API & WebSocket (luôn dùng network)
  if (url.hostname.includes("supabase") || url.protocol === "wss:") return;

  // Bỏ qua OSM / map tiles (dynamic, không cache)
  if (url.hostname.includes("openstreetmap") || url.hostname.includes("tile."))
    return;

  // Bỏ qua Next.js HMR (development)
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Static files (_next/static) → Cache-first
  // Next.js JS/CSS chunks → Network-first (tránh hydration mismatch do JS cũ)
  if (url.pathname.startsWith("/_next/static/chunks")) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Other static files (fonts, media, css with content hash) → Cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons")
  ) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Images (avatars, uploads) → Stale-while-revalidate
  if (
    url.hostname.includes("dicebear") ||
    (url.hostname.includes("supabase.co") &&
      (request.headers.get("accept")?.includes("image") ||
        url.pathname.includes("/storage/v1/object/public/")))
  ) {
    e.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        }),
      ),
    );
    return;
  }

  // Các trang HTML → Network-first (fallback về offline.html khi mất mạng)
  if (request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (cached) =>
                cached || caches.match("/offline.html") || caches.match("/"),
            ),
        ),
    );
    return;
  }
});

// === Push notifications ===
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data?.json() ?? {};
  } catch {
    data = { title: "LoveYou 💕" };
  }

  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Chỉ bỏ qua nếu đang visible (focused)
        const appVisible = windowClients.some(
          (c) => c.visibilityState === "visible",
        );
        if (appVisible) return;

        return self.registration.showNotification(data.title || "LoveYou 💕", {
          body: data.body || "",
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
          vibrate: [200, 100, 200, 100, 200],
          tag: data.tag || "loveyou-msg",
          renotify: true,
          data: { url: data.url || "/" },
        });
      })
      .catch(() =>
        // Nếu matchAll lỗi → hiện luôn
        self.registration.showNotification(data.title || "LoveYou 💕", {
          body: data.body || "",
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png",
          vibrate: [200, 100, 200],
          data: { url: data.url || "/" },
        }),
      ),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
