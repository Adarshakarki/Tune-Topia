// providers //

const PROVIDERS = {
  monochrome: {
    label: 'Monochrome',
    urls: [
      'https://api.monochrome.tf',
      'https://arran.monochrome.tf',
      'https://monochrome-api.samidy.com',
    ],
    type: 'hifi',
  },
  squid: {
    label: 'Squid',
    urls: ['https://triton.squid.wtf'],
    type: 'hifi',
  },
  qqdl: {
    label: 'QQDL',
    urls: [
      'https://wolf.qqdl.site',
      'https://maus.qqdl.site',
      'https://vogel.qqdl.site',
      'https://katze.qqdl.site',
      'https://hund.qqdl.site',
    ],
    type: 'hifi',
  },
  spotisaver: {
    label: 'Spotisaver',
    urls: [
      'https://hifi-one.spotisaver.net',
      'https://hifi-two.spotisaver.net',
    ],
    type: 'hifi',
  },
  kinoplus: {
    label: 'Kinoplus',
    urls: ['https://tidal.kinoplus.online'],
    type: 'hifi',
  },
  binimum: {
    label: 'Binimum',
    urls: ['https://tidal-api.binimum.org'],
    type: 'hifi',
  },
  invidious: {
    label: 'Invidious (YT)',
    urls: ['https://iv.melmac.space'],
    type: 'invidious',
  },
};

// build a flat ordered list of all hifi bases, then invidious last
const ALL_HIFI_BASES = Object.values(PROVIDERS)
  .filter(p => p.type === 'hifi')
  .flatMap(p => p.urls);

const IV_BASE = 'https://iv.melmac.space';

// cover art //

function tidalCover(coverId, size = 320) {
  if (!coverId) return '';
  const path = coverId.replace(/-/g, '/');
  return `https://resources.tidal.com/images/${path}/${size}x${size}.jpg`;
}

function ivThumb(videoId) {
  return `${IV_BASE}/vi/${videoId}/mqdefault.jpg`;
}

// http utils //

async function fetchJSON(url, timeout = 8000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

async function tryBases(bases, path) {
  const errors = [];
  for (const base of bases) {
    try {
      const data = await fetchJSON(`${base}${path}`);
      return { data, base };
    } catch (e) {
      errors.push(`${base}: ${e.message}`);
    }
  }
  throw new Error('All providers failed:\n' + errors.join('\n'));
}

// hifi api //

async function hifiSearch(query, bases = ALL_HIFI_BASES) {
  const { data } = await tryBases(bases, `/search/?s=${encodeURIComponent(query)}`);
  const items = data?.data?.items || data?.items || [];
  return items.map(normalizeHifiTrack);
}

async function hifiSearchArtist(query, bases = ALL_HIFI_BASES) {
  const { data } = await tryBases(bases, `/search/?a=${encodeURIComponent(query)}`);
  const items = data?.data?.artists?.items || [];
  return items.map(a => ({
    id: String(a.id),
    name: a.name,
    cover: tidalCover(a.picture),
    type: 'artist',
  }));
}

async function hifiGetStream(trackId, quality = 'LOSSLESS', bases = ALL_HIFI_BASES) {
  const { data, base } = await tryBases(
    bases,
    `/track/?id=${trackId}&quality=${quality}`
  );
  const payload = data?.data || data;
  if (!payload?.manifest) throw new Error('No manifest in response');
  return decodeManifest(payload, base);
}

async function hifiGetInfo(trackId, bases = ALL_HIFI_BASES) {
  const { data } = await tryBases(bases, `/info/?id=${trackId}`);
  return data?.data || data;
}

function decodeManifest(payload, base) {
  const raw = atob(payload.manifest);
  const mime = payload.manifestMimeType || '';

  if (mime === 'application/vnd.tidal.bts') {
    const manifest = JSON.parse(raw);
    return {
      type: 'direct',
      url: manifest.urls[0],
      mimeType: manifest.mimeType || 'audio/flac',
      codecs: manifest.codecs || 'flac',
      quality: payload.audioQuality,
      bitDepth: payload.bitDepth,
      sampleRate: payload.sampleRate,
    };
  }

  if (mime === 'application/dash+xml') {
    return {
      type: 'dash',
      manifest: raw,
      quality: payload.audioQuality,
      bitDepth: payload.bitDepth,
      sampleRate: payload.sampleRate,
    };
  }

  throw new Error('Unknown manifest type: ' + mime);
}

function normalizeHifiTrack(t) {
  const artists = (t.artists || [t.artist]).filter(Boolean);
  const artistName = artists.map(a => a.name).join(', ') || '';
  return {
    id: String(t.id),
    title: t.title || 'Unknown',
    artist: artistName,
    album: t.album?.title || '',
    cover: tidalCover(t.album?.cover, 640),
    coverSmall: tidalCover(t.album?.cover, 160),
    duration: t.duration || 0,
    dur: fmtDur(t.duration),
    quality: t.audioQuality || '',
    tags: t.mediaMetadata?.tags || [],
    url: t.url || '',
    source: 'tidal',
  };
}

// invidious api //

async function ivSearch(query) {
  const data = await fetchJSON(
    `${IV_BASE}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`
  );
  return (data || []).slice(0, 40).map(normalizeIvTrack);
}

async function ivGetStream(videoId) {
  const data = await fetchJSON(`${IV_BASE}/api/v1/videos/${videoId}?local=true`);
  const audioFmts = (data.adaptiveFormats || []).filter(f =>
    f.type?.startsWith('audio/')
  );
  audioFmts.sort((a, b) => {
    const aOp = a.type.includes('opus') ? 1 : 0;
    const bOp = b.type.includes('opus') ? 1 : 0;
    if (aOp !== bOp) return bOp - aOp;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
  const url =
    audioFmts[0]?.url ||
    data.formatStreams?.[data.formatStreams.length - 1]?.url ||
    `${IV_BASE}/videoplayback?id=${videoId}&itag=140&local=true`;

  return {
    type: 'direct',
    url,
    mimeType: audioFmts[0]?.type?.split(';')[0] || 'audio/webm',
  };
}

function normalizeIvTrack(v) {
  return {
    id: v.videoId,
    title: v.title || 'Unknown',
    artist: v.author || '',
    album: '',
    cover: `${IV_BASE}/vi/${v.videoId}/maxresdefault.jpg`,
    coverSmall: `${IV_BASE}/vi/${v.videoId}/mqdefault.jpg`,
    duration: v.lengthSeconds || 0,
    dur: fmtDur(v.lengthSeconds),
    quality: 'YT',
    tags: [],
    source: 'youtube',
  };
}

// unified search //

async function search(query, mode = 'auto') {
  if (mode === 'youtube') return ivSearch(query);

  try {
    const tracks = await hifiSearch(query);
    if (tracks.length > 0) return tracks;
    throw new Error('No TIDAL results');
  } catch {
    return ivSearch(query);
  }
}

async function getStream(track) {
  if (track.source === 'youtube') return ivGetStream(track.id);

  // try lossless first, then hi-res
  const qualities = ['LOSSLESS', 'HI_RES_LOSSLESS', 'HIGH'];
  for (const q of qualities) {
    try {
      return await hifiGetStream(track.id, q);
    } catch { /* try next */ }
  }

  // fallback to youtube search
  try {
    const ytResults = await ivSearch(`${track.title} ${track.artist} audio`);
    if (ytResults.length) return ivGetStream(ytResults[0].id);
  } catch { /* nothing */ }

  throw new Error('Stream unavailable from all providers');
}

// utils //

function fmtDur(s) {
  if (!s || isNaN(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function escHtml(s) {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function qualityBadge(track) {
  const tags = track.tags || [];
  if (tags.includes('HIRES_LOSSLESS')) return { label: 'HiRes', cls: 'hires' };
  if (tags.includes('LOSSLESS') || track.quality === 'LOSSLESS') return { label: 'FLAC', cls: 'lossless' };
  if (track.quality === 'YT') return { label: 'YT', cls: 'yt' };
  return null;
}
