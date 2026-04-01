const CACHE = 'tunetopia-v2'

// Core assets for offline shell
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
  '/app/init.js',
  '/app/state.js',
  '/app/ui.js',
  '/app/router.js',
  '/app/playback.js',
  '/app/playerEvents.js',
  '/app/icons.js',
  '/app/constants.js',
  '/assets/logo.JPEG',
]

// Cache assets on install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(
        PRECACHE.map(url => c.add(url).catch(err => console.warn('[SW] precache miss:', url, err)))
      ))
  )
})

// Cleanup old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] deleting old cache:', k);
          return caches.delete(k)
        })
      ))
      .then(() => self.clients.claim())
  )
})

// Handle update trigger
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received — activating now')
    self.skipWaiting()
  }
})

// Fetch strategy: Network-first for HTML, Cache-first for assets
self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return

  // Bypass streaming, API, and range requests
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    request.destination === 'audio' ||
    request.destination === 'video' ||
    request.headers.get('range')
  ) return

  if (request.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/index.html')))
    )
    return
  }

  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
        return res
      }).catch(() => caches.match('/index.html'))
    })
  )
})