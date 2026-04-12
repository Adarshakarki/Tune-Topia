// Service Worker
const CACHE = 'tunetopia-v2.1.3'
const VERSION = CACHE.split('-v')[1] || '1.0.0'

// Assets to cache
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'style/z-index.css',
  'style/tokens.css',
  'style/layout.css',
  'style/components.css',
  'style/sections.css',
  'style/player.css',
  'style/album.css',
  'style/artist.css',
  'style/playlist.css',
  'style/userplaylist.css',
  'style/library.css',
  'style/search.css',
  'style/settings.css',
  'style/account.css',
  'style/capsule.css',
  'style/modals.css',
  'style/equalizer.css',
  'style/genre.css',
  'theme/themes.json',
  'style/video.css',
  'style/responsive.css',
  'app/init.js',
  'app/state.js',
  'app/ui.js',
  'app/router.js',
  'app/playback.js',
  'app/playerEvents.js',
  'app/icons.js',
  'modules/theme.js',
  'app/constants.js',
  'assets/logo.JPEG',
]

// Install handler
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Cache static list
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch((err) => console.warn('[SW] precache miss:', url, err)))
      );

      // Cache dynamic themes
      try {
        const res = await fetch('theme/themes.json');
        const data = await res.json();
        if (data.themes) {
          const themeUrls = data.themes.map((t) => `theme/${t.id}.css`);
          await Promise.all(themeUrls.map((url) => cache.add(url).catch((err) => console.warn('[SW] theme cache miss:', url, err))));
        }
      } catch (err) { console.warn('[SW] could not fetch theme manifest during install'); }
    })
  );
});

// Activate handler
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

// IPC handler
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received — activating now')
    self.skipWaiting()
  }
})

// Fetch handler
self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return

  // Network-only rules
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.includes('ffmpeg') ||
    url.pathname.endsWith('.wasm') ||
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
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html') || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })))
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
      }).catch(() => caches.match('./index.html') || new Response('Offline', { status: 503 }))
    })
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE
    })
  }
})