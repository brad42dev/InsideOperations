// Inside/Operations — Rounds offline service worker
// Provides network-first caching for the rounds API and cache-first for
// static assets so the Rounds module remains usable without connectivity.

const CACHE_NAME = "io-rounds-v1";
const OFFLINE_URLS = ["/", "/index.html", "/rounds"];

// ---------------------------------------------------------------------------
// Install — pre-cache critical shell URLs
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // addAll is best-effort; ignore failures for paths that aren't
        // served yet (e.g. /rounds before first navigation).
        Promise.allSettled(OFFLINE_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

// ---------------------------------------------------------------------------
// Activate — prune stale caches
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Fetch — strategy selection by request type
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  // Only handle same-origin or relative requests (ignore cross-origin)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/mobile/health") {
    // Network-only pass-through for the mobile health check.
    // This endpoint is public (no auth) and is used for connectivity detection;
    // it should never be served from cache.
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({ ok: false, ts: new Date().toISOString() }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );
  } else if (
    url.pathname === "/api/mobile/rounds/active" &&
    event.request.method === "GET"
  ) {
    // Network-first for the active rounds pre-cache endpoint.
    // Cache successful responses so the PWA can resume a round offline even
    // if the device loses connectivity between the round start and data entry.
    event.respondWith(handleRoundsApi(event.request));
  } else if (url.pathname.startsWith("/api/rounds")) {
    // Network-first for rounds API — cache successful GET responses for
    // offline playback; fall back to cache on network failure.
    event.respondWith(handleRoundsApi(event.request));
  } else if (url.pathname.startsWith("/api/")) {
    // Network-only for all other API calls.  Return a structured 503 JSON
    // instead of a browser error page when offline.
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({
              error: "offline",
              message: "No network connection",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );
  } else {
    // Cache-first for static assets (JS, CSS, fonts, images)
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
  }
});

async function handleRoundsApi(request) {
  try {
    const response = await fetch(request);
    // Cache successful GET responses so they survive offline
    if (request.method === "GET" && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_err) {
    // Network unavailable — serve from cache if present
    const cached = await caches.match(request);
    if (cached) return cached;
    // No cache entry either — return offline indicator
    return new Response(
      JSON.stringify({
        error: "offline",
        message: "Rounds data not available offline",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Background sync — flush pending round responses when connectivity returns
// ---------------------------------------------------------------------------

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-rounds") {
    event.waitUntil(notifySyncReady());
  }
});

async function notifySyncReady() {
  // The React app owns the IndexedDB queue via useOfflineRounds.
  // Notify all open clients so they can trigger the sync themselves.
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((client) => client.postMessage({ type: "sync-complete" }));
}
