// ── piped.js — search + stream URLs via Piped API, no key needed ──

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://pipedapi.in',
  'https://piped.adminforge.de',
];

const TIMEOUT_MS    = 6000;
let   activeInstance = null;

// ── pick fastest reachable instance ──────────────────────────────────────
async function pickInstance(onStatus) {
  onStatus?.('connecting');
  for (const inst of PIPED_INSTANCES) {
    try {
      const r = await fetch(
        `${inst}/search?q=music&filter=videos`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      if (r.ok) {
        activeInstance = inst;
        onStatus?.('ok', inst.replace('https://', ''));
        return inst;
      }
    } catch { /* try next */ }
  }
  onStatus?.('error');
  throw new Error('All Piped servers are unreachable. Try again later.');
}

// ── search tracks ─────────────────────────────────────────────────────────
async function searchTracks(query, onStatus) {
  if (!activeInstance) await pickInstance(onStatus);

  const url = `${activeInstance}/search?` + new URLSearchParams({
    q:      query,
    filter: 'music_songs',
  });

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    activeInstance = null;
    await pickInstance(onStatus);
    res = await fetch(
      `${activeInstance}/search?${new URLSearchParams({ q: query, filter: 'music_songs' })}`,
      { signal: AbortSignal.timeout(8000) }
    );
  }

  if (!res.ok) {
    activeInstance = null;
    throw new Error(`Search failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  return (data.items || []).map(mapItem).filter(Boolean);
}

// ── get direct audio stream URL for a video ID ────────────────────────────
async function getAudioStream(videoId) {
  if (!activeInstance) await pickInstance();

  const res = await fetch(
    `${activeInstance}/streams/${videoId}`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!res.ok) throw new Error(`Stream fetch failed (HTTP ${res.status})`);

  const data = await res.json();

  if (!data.audioStreams?.length) throw new Error('No audio streams available');

  // pick highest bitrate audio stream
  const best = data.audioStreams
    .filter(s => s.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

  return {
    url:      best.url,
    bitrate:  best.bitrate,
    codec:    best.codec,
    mimeType: best.mimeType,
    // also return thumbnail and title in case they differ
    thumb:    data.thumbnailUrl || '',
    duration: data.duration     || 0,
  };
}

// ── map raw Piped search item ─────────────────────────────────────────────
function mapItem(item) {
  if (!item?.url) return null;

  // Piped returns url like "/watch?v=VIDEO_ID"
  const id = new URLSearchParams(item.url.split('?')[1]).get('v');
  if (!id) return null;

  return {
    id,
    title:     item.title       || 'Unknown Title',
    artist:    item.uploaderName || 'Unknown Artist',
    thumb:     item.thumbnail   || '',
    dur:       item.duration    || 0,
    views:     item.views       || 0,
  };
}

window.Piped = { searchTracks, getAudioStream, pickInstance };
