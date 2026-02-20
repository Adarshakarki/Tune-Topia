// ── piped.js — Piped API with Invidious fallback for CORS safety ──

// Piped instances known to allow CORS from browser
const PIPED_INSTANCES = [
  'https://api.piped.yt',
  'https://piped.adminforge.de',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.in',
];

// Invidious instances as search fallback if all Piped fail
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://yt.artemislena.eu',
  'https://invidious.nerdvpn.de',
  'https://iv.melmac.space',
];

const TIMEOUT_MS = 5000;

let activePiped     = null;  // for streams
let activeSearch    = null;  // for search (piped or invidious)
let searchBackend   = null;  // 'piped' | 'invidious'

// ── instance pickers ─────────────────────────────────────────────────────

async function pickPipedInstance(onStatus) {
  for (const inst of PIPED_INSTANCES) {
    try {
      const r = await fetch(
        `${inst}/search?q=music&filter=videos`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      if (r.ok) {
        activePiped = inst;
        return inst;
      }
    } catch { /* try next */ }
  }
  return null;
}

async function pickInvidiousInstance(onStatus) {
  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const r = await fetch(
        `${inst}/api/v1/search?q=music&type=video&fields=videoId`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );
      if (r.ok) {
        activeSearch  = inst;
        searchBackend = 'invidious';
        return inst;
      }
    } catch { /* try next */ }
  }
  return null;
}

async function pickInstance(onStatus) {
  onStatus?.('connecting');

  // Try Piped first for search
  const piped = await pickPipedInstance(onStatus);
  if (piped) {
    activeSearch  = piped;
    searchBackend = 'piped';
    onStatus?.('ok', piped.replace('https://', '') + ' (Piped)');
    return;
  }

  // Piped all failed — try Invidious for search
  console.warn('[API] All Piped instances failed CORS, falling back to Invidious for search');
  const inv = await pickInvidiousInstance(onStatus);
  if (inv) {
    onStatus?.('ok', inv.replace('https://', '') + ' (Invidious)');
    return;
  }

  onStatus?.('error');
  throw new Error('All servers unreachable. Check your connection.');
}

// ── search ────────────────────────────────────────────────────────────────

async function searchTracks(query, onStatus) {
  if (!activeSearch) await pickInstance(onStatus);

  return searchBackend === 'invidious'
    ? searchViaInvidious(query, onStatus)
    : searchViaPiped(query, onStatus);
}

async function searchViaPiped(query, onStatus) {
  const url = `${activeSearch}/search?` + new URLSearchParams({ q: query, filter: 'music_songs' });
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    // this instance dropped — retry with invidious
    activeSearch  = null;
    searchBackend = null;
    activePiped   = null;
    await pickInstance(onStatus);
    return searchTracks(query, onStatus);
  }

  if (!res.ok) throw new Error(`Piped search failed (HTTP ${res.status})`);
  const data = await res.json();
  return (data.items || []).map(mapPipedItem).filter(Boolean);
}

async function searchViaInvidious(query, onStatus) {
  const FIELDS = 'videoId,title,author,videoThumbnails,lengthSeconds';
  const url = `${activeSearch}/api/v1/search?` + new URLSearchParams({ q: query, type: 'video', fields: FIELDS });
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    activeSearch = null;
    await pickInvidiousInstance(onStatus);
    return searchViaInvidious(query, onStatus);
  }

  if (!res.ok) throw new Error(`Invidious search failed (HTTP ${res.status})`);
  const items = await res.json();
  return items.map(mapInvidiousItem).filter(Boolean);
}

// ── audio stream (Piped only) ─────────────────────────────────────────────

async function getAudioStream(videoId) {
  // Make sure we have a Piped instance for streams
  if (!activePiped) {
    const piped = await pickPipedInstance();
    if (!piped) throw new Error('No Piped instance available for streaming');
  }

  const res = await fetch(
    `${activePiped}/streams/${videoId}`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!res.ok) {
    activePiped = null;
    throw new Error(`Stream fetch failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.audioStreams?.length) throw new Error('No audio streams available');

  const best = data.audioStreams
    .filter(s => s.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];

  return {
    url:      best.url,
    bitrate:  best.bitrate,
    mimeType: best.mimeType,
    thumb:    data.thumbnailUrl || '',
    duration: data.duration     || 0,
  };
}

// ── mappers ───────────────────────────────────────────────────────────────

function mapPipedItem(item) {
  if (!item?.url) return null;
  const id = new URLSearchParams(item.url.split('?')[1]).get('v');
  if (!id) return null;
  return {
    id,
    title:  item.title        || 'Unknown Title',
    artist: item.uploaderName || 'Unknown Artist',
    thumb:  item.thumbnail    || '',
    dur:    item.duration     || 0,
  };
}

function mapInvidiousItem(item) {
  if (!item?.videoId) return null;
  const thumbs   = item.videoThumbnails || [];
  const priority = ['medium', 'high', 'default'];
  const thumb    = priority.map(q => thumbs.find(t => t.quality === q)?.url).find(Boolean) || thumbs[0]?.url || '';
  return {
    id:     item.videoId,
    title:  item.title  || 'Unknown Title',
    artist: item.author || 'Unknown Artist',
    thumb,
    dur:    item.lengthSeconds ?? 0,
  };
}

window.Piped = { searchTracks, getAudioStream, pickInstance };

