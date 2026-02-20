// ── piped.js ──────────────────────────────────────────────────────────────
//
//  SEARCH  → Invidious only  (consistent CORS support, very reliable)
//  STREAMS → Piped first     (direct audio URL)
//            → YT embed URL  (fallback if Piped also has CORS issues)
//
// ─────────────────────────────────────────────────────────────────────────

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://yt.artemislena.eu',
  'https://invidious.nerdvpn.de',
  'https://iv.melmac.space',
  'https://invidious.privacydev.net',
];

const PIPED_INSTANCES = [
  'https://api.piped.yt',
  'https://pipedapi.kavin.rocks',
  'https://piped.adminforge.de',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.in',
];

const TIMEOUT_MS = 5000;

let activeInvidious = null;  // search
let activePiped     = null;  // streams (optional — falls back to YT embed)

// ── pick Invidious instance for search ───────────────────────────────────
async function pickInstance(onStatus) {
  onStatus?.('connecting');
  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const r = await fetch(
        `${inst}/api/v1/search?q=music&type=video&fields=videoId`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      if (r.ok) {
        activeInvidious = inst;
        onStatus?.('ok', inst.replace('https://', ''));
        // also try to grab a Piped instance in the background (non-blocking)
        pickPipedQuietly();
        return;
      }
    } catch { /* try next */ }
  }
  onStatus?.('error');
  throw new Error('All search servers unreachable. Check your connection.');
}

// silently try to get a Piped instance — used only for streams
async function pickPipedQuietly() {
  for (const inst of PIPED_INSTANCES) {
    try {
      const r = await fetch(
        `${inst}/streams/dQw4w9WgXcQ`,   // known video, quick probe
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      if (r.ok) { activePiped = inst; return; }
    } catch { /* try next */ }
  }
  console.info('[Piped] No CORS-friendly Piped instance found — will use YT embed for playback');
}

// ── search via Invidious ──────────────────────────────────────────────────
async function searchTracks(query, onStatus) {
  if (!activeInvidious) await pickInstance(onStatus);

  const url = `${activeInvidious}/api/v1/search?` + new URLSearchParams({
    q:      query,
    type:   'video',
    fields: 'videoId,title,author,videoThumbnails,lengthSeconds',
  });

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    // instance dropped mid-session, re-pick
    activeInvidious = null;
    await pickInstance(onStatus);
    return searchTracks(query, onStatus);
  }

  if (!res.ok) throw new Error(`Search failed (HTTP ${res.status})`);

  const items = await res.json();
  return items.map(mapInvidiousItem).filter(Boolean);
}

// ── get audio stream ──────────────────────────────────────────────────────
// Returns { url, type } where type is 'direct' or 'embed'
// player.js handles both cases
async function getAudioStream(videoId) {
  // Try Piped direct audio first
  if (activePiped) {
    try {
      const res = await fetch(
        `${activePiped}/streams/${videoId}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.audioStreams?.length) {
          const best = data.audioStreams
            .filter(s => s.url)
            .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
          if (best?.url) {
            return { url: best.url, type: 'direct', mimeType: best.mimeType };
          }
        }
      }
    } catch {
      activePiped = null;
    }
  }

  // Piped unavailable — return YT embed URL as fallback
  console.info(`[Stream] Using YT embed fallback for ${videoId}`);
  return {
    url:  `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=0`,
    type: 'embed',
  };
}

// ── mapper ────────────────────────────────────────────────────────────────
function mapInvidiousItem(item) {
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

