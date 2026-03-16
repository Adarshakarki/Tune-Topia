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
  '/assets/circularlogo.png',
]

// - install: precache shell assets -
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

// - activate: clear old caches -
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

// - fetch strategy -
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // - never cache API calls, audio streams, or external resources -
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    request.destination === 'audio' ||
    request.headers.get('range')
  ) {
    e.respondWith(fetch(request))
    return
  }

  // - app shell: cache first, fall back to network -
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // only cache valid same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic')
          return response
        const clone = response.clone()
        caches.open(CACHE).then((c) => c.put(request, clone))
        return response
      })
    })
  )
})
