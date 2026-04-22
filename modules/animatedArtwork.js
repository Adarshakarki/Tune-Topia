// Animated Artwork (ROBUST FIXED VERSION)
import * as Cache from './cache.js';
import { _proxify } from './player.js';

const BASE_URL = 'https://artwork.m8tec.top/api/v1/artwork';
// -------------------- Utils --------------------

function cleanMetadata(s) {
  if (!s) return '';
  return s
    .split(
      /[-(\[](remaster|remix|mix|live|deluxe|edition|version|from|feat|ft|audio|video|official|lyrics)/i
    )[0]
    .trim();
}

function getCacheKey(artist, album, title) {
  return `aa_${artist}_${album}_${title || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// -------------------- HLS.js loader --------------------

let _HlsPromise = null;

function loadHls() {
  if (_HlsPromise) return _HlsPromise;

  _HlsPromise = new Promise((resolve) => {
    // Already loaded
    if (window.Hls) return resolve(window.Hls);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
    script.onload = () => {
      console.log('[AnimatedArtwork] HLS.js loaded:', !!window.Hls);
      resolve(window.Hls || null);
    };
    script.onerror = () => {
      console.warn('[AnimatedArtwork] Failed to load HLS.js');
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return _HlsPromise;
}

// -------------------- API --------------------

export async function getAnimatedUrl(track) {
  const artist = cleanMetadata(
    track.artist ||
      (Array.isArray(track.artists) ? track.artists[0]?.name : '')
  );

  const album = cleanMetadata(track.album || '');
  const albumQuery = album || cleanMetadata(track.title || '');
  const title = cleanMetadata(track.title || track.name || '');

  if (!artist || !albumQuery) {
    console.log('[AnimatedArtwork] Missing metadata', { artist, album: albumQuery, title });
    return null;
  }

  const key = getCacheKey(artist, albumQuery, title);

  const cached = Cache.get(key);
  if (cached) return typeof cached === 'string' ? cached : cached?.url || null;

  try {
    const params = new URLSearchParams({ artist, album: albumQuery });
    if (title) params.set('title', title);

    const apiUrl = `${BASE_URL}/search?${params}`;

    let res;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      res = await fetch(apiUrl, {
        mode: 'cors',
        credentials: 'omit'
      });

      if (res.status === 429) {
        retries++;
        const delay = Math.pow(2, retries) * 1000;
        console.warn(`[AnimatedArtwork] Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        break;
      }
    }

    if (!res.ok) {
      console.warn('[AnimatedArtwork] API error:', res.status);
      return null;
    }

    const data = await res.json();
    console.log('[ARTWORK RAW RESPONSE]', data);

    let url = null;

    if (typeof data?.url === 'string') {
      url = data.url;
    } else if (Array.isArray(data)) {
      url = data?.[0]?.url || data?.[0]?.animatedArtworkUrl || null;
    } else if (data?.results) {
      url = data.results?.[0]?.url || data.results?.[0]?.animatedArtworkUrl || null;
    } else {
      const r = data?.data?.[0] || data;
      url =
        r?.url ||
        r?.animatedArtworkUrl ||
        r?.videoVariants?.[0]?.url ||
        r?.attributes?.editorialVideo?.motionDetailSquare?.video?.url ||
        null;
    }

    console.log('[ARTWORK EXTRACTED URL]', url);

    if (!url || typeof url !== 'string') {
      console.warn('[AnimatedArtwork] No valid URL found');
      return null;
    }

    const cleanUrl = url.split('?')[0];
    const isStatic = /\.(jpe?g|png|webp|avif)$/i.test(cleanUrl);

    if (isStatic) {
      console.warn('[AnimatedArtwork] Static image blocked:', url);
      return null;
    }

    Cache.set(key, url, 7 * 24 * 60 * 60 * 1000);
    return url;
  } catch (e) {
    console.warn('[AnimatedArtwork] fetch failed:', e);
    return null;
  }
}

// -------------------- UI --------------------

export async function updateDisplay(container, videoUrl, isPlaying = true) {
  if (!container) return;

  let video = container.querySelector('.aa-video');
  const img = container.querySelector('img');

  // REMOVE
  if (!videoUrl) {
    if (video) {
      if (video._hls) {
        video._hls.destroy();
        video._hls = null;
      }
      video.style.opacity = '0';
      setTimeout(() => video.remove(), 250);
    }
    if (img) img.style.opacity = '1';
    return;
  }

  // Dedupe — only skip if HLS is already running for this exact URL
  if (video?.dataset.src === videoUrl && video._hls) return;

  // CREATE
  if (!video) {
    video = document.createElement('video');
    video.className = 'aa-video';

    video.autoplay = isPlaying;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    container.style.overflow = 'hidden';

    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: '0',
      transition: 'opacity 0.3s ease, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.6s ease',
      transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
      filter: isPlaying ? 'brightness(1)' : 'brightness(0.8)',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      zIndex: '1'
    });

    container.appendChild(video);
  }

  // Tear down any previous HLS instance
  if (video._hls) {
    video._hls.destroy();
    video._hls = null;
  }

  video.dataset.src = videoUrl;

  const isHls = /m3u8(\?|$)/i.test(videoUrl);

  // Wait for HLS.js to be available before deciding playback path
  const Hls = isHls ? await loadHls() : null;

  console.log('[AnimatedArtwork] HLS.js available:', !!Hls, '| isSupported:', Hls?.isSupported());

  try {
    if (isHls && Hls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: true,
        xhrSetup(xhr, url) {
          xhr.open('GET', url, true);
        },
        pLoader: function(config) {
          this.load = (context, config, callbacks) => { context.url = _proxify(context.url); return Hls.DefaultConfig.pLoader.call(this, context, config, callbacks); }
        },
        // Recover from buffer stalls faster
        nudgeMaxRetry: 10,
        nudgeOffset: 0.2,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 1
      });

      video._hls = hls;

      hls.loadSource(_proxify(videoUrl));
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isPlaying) {
          video.pause();
          return;
        }

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            if (err.name === 'NotAllowedError') {
              console.warn('[AnimatedArtwork] Autoplay blocked, waiting for interaction');
              if (img) img.style.opacity = '1';
              const resume = () => {
                video.play().then(() => {
                  if (img) img.style.opacity = '0';
                }).catch(() => {});
                document.removeEventListener('click', resume);
              };
              document.addEventListener('click', resume, { once: true });
            } else {
              console.warn('[AnimatedArtwork] play() failed:', err);
            }
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('[HLS ERROR]', data.type, data.details, data);
        if (data.fatal) {
          hls.destroy();
          video._hls = null;
          if (img) img.style.opacity = '1';
        }
      });

    } else if (isHls && (!Hls || !Hls.isSupported())) {
      // m3u8 but no HLS.js — only Safari can handle this natively
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        video.src = _proxify(videoUrl);
        if (isPlaying) {
          video.play().catch(err => console.warn('[AnimatedArtwork] Safari play() failed:', err.name));
        } else {
          video.pause();
        }
      } else {
        console.warn('[AnimatedArtwork] Cannot play m3u8 without HLS.js on this browser');
        if (img) img.style.opacity = '1';
        return;
      }

    } else if (isPlaying) {
      // Non-HLS URL
      video.src = _proxify(videoUrl);
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[AnimatedArtwork] Native play() failed:', err.name);
        });
      }
    } else {
      // Non-HLS but paused
      video.src = _proxify(videoUrl);
      video.pause();
    }
  } catch (e) {
    console.warn('[AnimatedArtwork] playback error:', e);
    if (img) img.style.opacity = '1';
  }

  video.onloadeddata = () => {
    video.style.opacity = '1';
    if (img) img.style.opacity = '0';
  };

  video.onerror = () => {
    const err = video.error;
    console.warn('[AnimatedArtwork] video element error:', err?.code, err?.message);
    if (!video._hls && img) img.style.opacity = '1';
  };
}