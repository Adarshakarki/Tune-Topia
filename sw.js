const CACHE = 'tunetopia-v1'
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/style/z-index.css',
  '/style/tokens.css',
  '/style/layout.css',
  '/style/components.css',
  '/style/sections.css',
  '/style/player.css',
  '/style/album.css',
  '/style/artist.css',
  '/style/playlist.css',
  '/style/userplaylist.css',
  '/style/library.css',
  '/style/search.css',
  '/style/settings.css',
  '/style/account.css',
  '/style/capsule.css',
  '/style/modals.css',
  '/style/equalizer.css',
  '/style/genre.css',
  '/style/video.css',
  '/style/responsive.css',
  '/assets/logo.png',
]

// ── install: precache shell assets ──────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        PRECACHE.map((url) =>
          c.add(url).catch((err) => console.warn('[SW] precache miss:', url, err))
        )
      )
    ).then(() => self.skipWaiting())
  )
})

// ── activate: clear old caches ───────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ── fetch strategy ───────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e

  // pass through non-GET — SW cannot clone/cache POST etc.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // pass through non-http(s) — e.g. chrome-extension://, data:, blob:
  if (!url.protocol.startsWith('http')) return

  // pass through cross-origin, API calls, audio streams, range requests
  // wrap in catch so CORS failures (e.g. maus.qqdl.site) don't crash the SW
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    request.destination === 'audio' ||
    request.headers.get('range')
  ) {
    e.respondWith(
      fetch(request).catch(() => new Response(null, { status: 503, statusText: 'SW passthrough failed' }))
    )
    return
  }

  // app shell: cache first, fall back to network, fall back to /index.html
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic')
            return response
          const clone = response.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
          return response
        })
        .catch(() => caches.match('/index.html'))
    })
  )
})