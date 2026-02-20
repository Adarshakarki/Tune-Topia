// ── piped.js ──────────────────────────────────────────────────────────────
//
//  All requests are routed through corsproxy.io to bypass CORS restrictions.
//
//  SEARCH  → Invidious (reliable API, good data)
//  STREAMS → Piped (direct audio URL) → YT embed fallback
//
// ─────────────────────────────────────────────────────────────────────────

const CORS = 'https://corsproxy.io/?url=';

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://iv.melmac.space',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.yt',
  'https://piped.adminforge.de',
];

const TIMEOUT_MS = 6000;

let activeInvidious = null;
let activePiped     = null;

// ── proxied fetch helper ──────────────────────────────────────────────────
async function pfetch(url, timeout = TIMEOUT_MS) {
  const proxied = CORS + encodeURIComponent(url);
  const res = await fetch(proxied, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

// ── pick instances ────────────────────────────────────────────────────────
async function pickInstance(onStatus) {
  onStatus?.('connecting');

  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const r = await pfetch(`${inst}/api/v1/search?q=music&type=video&fields=videoId`);
      if (r.ok) {
        activeInvidious = inst;
        onStatus?.('ok', inst.replace('https://', ''));
        pickPipedQuietly(); // non-blocking
        return;
      }
    } catch { /* try next */ }
  }

  onStatus?.('error');
  throw new Error('All servers unreachable. Try refreshing.');
}

async function pickPipedQuietly() {
  for (const inst of PIPED_INSTANCES) {
    try {
      const r = await pfetch(`${inst}/streams/dQw4w9WgXcQ`);
      if (r.ok) { activePiped = inst; return; }
    } catch { /* try next */ }
  }
}

// ── search ────────────────────────────────────────────────────────────────
async function searchTracks(query, onStatus) {
  if (!activeInvidious) await pickInstance(onStatus);

  const url = `${activeInvidious}/api/v1/search?` + new URLSearchParams({
    q:      query,
    type:   'video',
    fields: 'videoId,title,author,videoThumbnails,lengthSeconds',
  });

  let res;
  try {
    res = await pfetch(url, 10000);
  } catch {
    activeInvidious = null;
    await pickInstance(onStatus);
    return searchTracks(query, onStatus);
  }

  const items = await res.json();
  return items.map(mapItem).filter(Boolean);
}

// ── audio stream ──────────────────────────────────────────────────────────
async function getAudioStream(videoId) {
  if (activePiped) {
    try {
      const res  = await pfetch(`${activePiped}/streams/${videoId}`, 12000);
      const data = await res.json();
      if (data.audioStreams?.length) {
        const best = data.audioStreams
          .filter(s => s.url)
          .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
        if (best?.url) return { url: best.url, type: 'direct', mimeType: best.mimeType };
      }
    } catch { activePiped = null; }
  }

  // fallback — hidden YT embed iframe
  return {
    url:  `https://www.youtube.com/embed/${videoId}?autoplay=1`,
    type: 'embed',
  };
}

// ── mapper ────────────────────────────────────────────────────────────────
function mapItem(item) {
  if (!item?.videoId) return null;
  const thumbs   = item.videoThumbnails || [];
  const priority = ['medium', 'high', 'default'];
  const thumb    = priority.map(q => thumbs.find(t => t.quality === q)?.url).find(Boolean)
                   || thumbs[0]?.url || '';
  return {
    id:     item.videoId,
    title:  item.title  || 'Unknown Title',
    artist: item.author || 'Unknown Artist',
    thumb,
    dur: item.lengthSeconds ?? 0,
  };
}

window.Piped = { searchTracks, getAudioStream, pickInstance };

