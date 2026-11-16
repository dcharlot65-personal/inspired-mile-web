/**
 * Service worker for Sonnet Man (sonnetman.inspiredmile.com).
 *
 * The rule everything else follows: THE ONLY RESPONSES KEPT ARE ONES THIS WORKER FETCHED
 * ITSELF, WITHOUT CREDENTIALS, FROM A SHORT LIST OF STATIC PATHS. The browser's own
 * request (which carries the session cookie) is answered, never stored. So nothing that
 * depends on who is signed in can reach Cache Storage, and the privacy page's "no
 * personal data is cached" is true by construction.
 *
 * What it never does:
 *   - Answer or store anything under /api/, or any request with an Authorization header.
 *     v2 stored every successful API GET, /api/v1/auth/me (email address, username)
 *     among them, and they outlived sign-out.
 *   - Touch a request to another origin. The models (0.3 to 3 GB) come from the Hugging
 *     Face hub and Transformers.js keeps them in a cache of its own; v2 answered every
 *     request, so it stored a second copy of the weights here.
 *   - Delete a cache it does not own. v2 deleted every cache but its own on activation,
 *     which on a version bump would have thrown away every downloaded model.
 *   - Serve an old page while the network has a new one. Pages always come from the
 *     network; the copy kept here is only for when there is none.
 *
 * What it does, for GET requests to this origin only:
 *   /_astro/*                    cache first (file names carry a content hash)
 *   /images /fonts /audio, icons cached copy at once, refreshed behind it
 *   page navigations             network first; offline, the kept copy or offline.html
 *   everything else              left to the browser (/api, 3D models, range requests)
 *
 * On sign-out the page sends FORGET_USER and the worker deletes every entry that is not
 * on the static list, and every older cache of its own (src/lib/pwa.ts forgetUserCaches
 * does the same from the page, for when no worker controls it).
 *
 * src/lib/sw.test.ts runs this file against a fake cache and network.
 */

const CACHE_PREFIX = 'inspired-mile-';
const CACHE_NAME = CACHE_PREFIX + 'v3';
const OFFLINE_PAGE = '/offline.html';
const PRECACHE = [OFFLINE_PAGE, '/fonts/inter-latin.woff2', '/favicon.svg', '/icon-192.png', '/icon-512.png'];
/** Nothing larger than this is kept, whatever its path. */
const MAX_CACHED_BYTES = 12 * 1024 * 1024;

function isAsset(path) {
  return path.startsWith('/images/') || path.startsWith('/fonts/') || path.startsWith('/audio/') || PRECACHE.includes(path);
}

/** A page of the site: /, /battle, /cards/DC-001/, /offline.html. Never anything under /api. */
function isPagePath(path) {
  if (path === '/api' || path.startsWith('/api/')) return false;
  const last = path.slice(path.lastIndexOf('/') + 1);
  return !last.includes('.') || last.endsWith('.html');
}

/**
 * May an entry under this URL stay in the cache? Same origin, no query string, and a
 * static path. Keep in step with mayStayCached in src/lib/pwa.ts (sw.test.ts compares them).
 */
function storable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.search) return false;
  const path = url.pathname;
  return path.startsWith('/_astro/') || isAsset(path) || isPagePath(path);
}

/** Fetch for keeping: no cookie, no HTTP auth, so the answer cannot depend on the player. */
function fetchAnonymous(url, headers) {
  return fetch(url, { credentials: 'omit', headers: headers || {} });
}

/** Store an anonymous answer under its URL, unless anything about it says not to. */
function keep(url, response) {
  if (!storable(new URL(url, self.location.origin))) return Promise.resolve();
  if (!response || response.status !== 200 || response.redirected) return Promise.resolve();
  const control = (response.headers.get('cache-control') || '').toLowerCase();
  if (control.includes('no-store') || control.includes('private')) return Promise.resolve();
  const vary = (response.headers.get('vary') || '').toLowerCase();
  if (vary.includes('cookie') || vary.includes('authorization') || vary.includes('*')) return Promise.resolve();
  if (Number(response.headers.get('content-length') || 0) > MAX_CACHED_BYTES) return Promise.resolve();
  const copy = response.clone();
  return caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(url, copy))
    .catch(() => {});
}

/** The key an entry is kept under: origin and path, never the query string. */
function keyOf(url) {
  return url.origin + url.pathname;
}

function fromCache(key) {
  return caches.open(CACHE_NAME).then((cache) => cache.match(key));
}

/**
 * An anonymous copy for the cache; the player gets it too when it is good. When it is
 * not (a proxy that wants its cookie, an error), the browser's own request is sent
 * instead and nothing is stored.
 */
function fetchAndKeep(request, key) {
  return fetchAnonymous(key).then(
    (response) => {
      if (response.status !== 200) return fetch(request);
      keep(key, response);
      return response;
    },
    () => fetch(request),
  );
}

function cacheFirst(request, key) {
  return fromCache(key).then((cached) => cached || fetchAndKeep(request, key));
}

function staleWhileRevalidate(request, key) {
  return fromCache(key).then((cached) => {
    const fresh = fetchAndKeep(request, key);
    if (!cached) return fresh;
    fresh.catch(() => {});
    return cached;
  });
}

/**
 * Bring the offline copy of a page up to date, with a request of the worker's own. Asks
 * with the kept copy's ETag, so an unchanged page costs a 304 and not a second download.
 */
function refreshPage(key) {
  return fromCache(key)
    .then((old) => {
      const etag = old && old.headers.get('etag');
      const headers = { accept: 'text/html' };
      if (etag) headers['if-none-match'] = etag;
      return fetchAnonymous(key, headers);
    })
    .then((response) => keep(key, response))
    .catch(() => {});
}

function page(event, key) {
  // The player's own request, cookie and all: answered, never stored.
  return fetch(event.request).then(
    (response) => {
      if (response.ok) event.waitUntil(refreshPage(key));
      return response;
    },
    () =>
      fromCache(key)
        .then((cached) => cached || fromCache(self.location.origin + OFFLINE_PAGE))
        .then((kept) => kept || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })),
  );
}

/** Delete everything that is not on the static list, and every older cache of this worker. */
function forgetUser() {
  return caches.keys().then((names) =>
    Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_PREFIX))
        .map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
          return caches.open(name).then((cache) =>
            cache.keys().then((requests) =>
              Promise.all(requests.filter((request) => !storable(new URL(request.url))).map((request) => cache.delete(request))),
            ),
          );
        }),
    ),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    // One missing file must not stop the worker installing.
    Promise.all(PRECACHE.map((path) => fetchAnonymous(path).then((response) => keep(path, response)).catch(() => {}))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          // Only this worker's older caches (v2's held signed-in API answers). Transformers.js,
          // Kokoro and Whisper keep the downloaded models in caches of their own, same origin.
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range') || request.headers.has('authorization')) return;
  const path = url.pathname;
  if (path === '/api' || path.startsWith('/api/')) return;
  const key = keyOf(url);

  if (request.mode === 'navigate') {
    // A page's query string is read by the page, not the server: one copy per path.
    if (isPagePath(path)) event.respondWith(page(event, key));
    return;
  }
  // A file asked for with a query string is not the file kept under its path.
  if (url.search) return;
  if (path.startsWith('/_astro/')) {
    event.respondWith(cacheFirst(request, key));
  } else if (isAsset(path)) {
    event.respondWith(staleWhileRevalidate(request, key));
  }
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'FORGET_USER') return;
  const done = forgetUser()
    .catch(() => {})
    .then(() => {
      // The page waits for this before it calls the player signed out.
      if (event.ports && event.ports[0]) event.ports[0].postMessage({ type: 'FORGOTTEN' });
    });
  if (event.waitUntil) event.waitUntil(done);
});
