// API utilities
const BASE_TIMEOUT = 9000;
const CORS_PROXY = 'https://corsproxy.io/?'; // Use a public proxy to bypass CORS blocks

export async function fetchJSON(url, timeout = BASE_TIMEOUT) {
  const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    // If the URL is known to have CORS issues (like spotisaver or binimum), prefix it
    const finalUrl = (url.includes('spotisaver.net') || url.includes('binimum.org')) 
      ? `${CORS_PROXY}${encodeURIComponent(url)}` 
      : url;

    const r = await fetch(finalUrl, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tid); }
}

export async function tryBases(bases, path) {
  const errs = [];
  for (const b of bases) {
    try {
      return { data: await fetchJSON(`${b}${path}`), base: b };
    } catch (e) { errs.push(`${b}: ${e.message}`); }
  }
  throw new Error(`All providers failed:\n${errs.join('\n')}`);
}

export const tidalCover = (id, s = 320) => id ? `https://resources.tidal.com/images/${id.replace(/-/g, '/')}/${s}x${s}.jpg` : '';

export function decodeManifest(p) {
  const raw = atob(p.manifest), mime = p.manifestMimeType || '';
  if (mime === 'application/vnd.tidal.bts') {
    const m = JSON.parse(raw);
    return { type: 'direct', url: m.urls[0], mimeType: m.mimeType || 'audio/flac', codecs: m.codecs || 'flac', quality: p.audioQuality, bitDepth: p.bitDepth, sampleRate: p.sampleRate };
  }
  if (mime === 'application/dash+xml') return { type: 'dash', manifest: raw, quality: p.audioQuality, bitDepth: p.bitDepth, sampleRate: p.sampleRate };
  throw new Error(`Unknown manifest: ${mime}`);
}

export function normalizeTrack(t, source = 'tidal') {
  const arts = (t.artists || [t.artist]).filter(Boolean);
  return {
    id: String(t.id), title: t.title || 'Unknown', artist: arts.map(a => a.name).join(', '),
    artistId: String(arts[0]?.id || ''), album: t.album?.title || '', albumId: String(t.album?.id || ''),
    cover: tidalCover(t.album?.cover, 640), coverSmall: tidalCover(t.album?.cover, 160),
    duration: t.duration || 0, dur: fmtDur(t.duration), quality: t.audioQuality || '',
    tags: t.mediaMetadata?.tags || [], explicit: !!t.explicit, source
  };
}

export const qualityBadge = t => {
  const ts = t.tags || [];
  if (ts.includes('HIRES_LOSSLESS')) return { label: 'HiRes', cls: 'hires' };
  if (ts.includes('LOSSLESS') || t.quality === 'LOSSLESS') return { label: 'FLAC', cls: 'lossless' };
  return t.quality === 'YT' ? { label: 'YT', cls: 'yt' } : null;
};

const _pad = n => String(Math.floor(n)).padStart(2, '0');
export const fmtDur = s => (!s || isNaN(s) || !isFinite(s)) ? '' : `${Math.floor(s / 60)}:${_pad(s % 60)}`;
export const fmtTime = s => (!s || isNaN(s) || !isFinite(s)) ? '0:00' : `${Math.floor(s / 60)}:${_pad(s % 60)}`;
export const escHtml = s => s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
