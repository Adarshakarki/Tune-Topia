const BASE_TIMEOUT = 12000, RETRY_DELAY = 500;
export const CORS_PROXY = 'https://tune-topia.onrender.com/proxy?url=';

export async function fetchJSON(url, timeout = BASE_TIMEOUT) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);

  try {
    let finalUrl = url;
    try {
      const { hostname: host } = new URL(url);
      const isProxyDomain = d => host === d || host.endsWith('.' + d);
      if (isProxyDomain('spotisaver.net') || isProxyDomain('binimum.org')) {
        finalUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
      }
    } catch (e) { /* Fallback to raw URL */ }

    const r = await fetch(finalUrl, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tid); }
}

export async function tryBases(bases, path, retries = 2) {
  const errs = [];
  for (let i = 0; i <= retries; i++) {
    for (const b of bases) {
      try { return { data: await fetchJSON(`${b}${path}`), base: b }; }
      catch (e) { errs.push(`${b}: ${e.message}`); }
    }
    if (i < retries) await new Promise(r => setTimeout(r, RETRY_DELAY * (i + 1)));
  } 
  throw new Error(`All providers failed:\n${errs.join('\n')}`);
}

// Resource Helpers
export const tidalCover = (id, s = 320) => 
  id ? `https://resources.tidal.com/images/${id.replace(/-/g, '/')}/${s}x${s}.jpg` : '';

export function decodeManifest(p) {
  const raw = atob(p.manifest), mime = p.manifestMimeType || '';
  if (mime === 'application/vnd.tidal.bts') {
    const m = JSON.parse(raw);
    return { type: 'direct', url: m.urls[0], mimeType: m.mimeType || 'audio/flac', codecs: m.codecs || 'flac', ...p };
  }
  if (mime === 'application/dash+xml') return { type: 'dash', manifest: raw, ...p };
  throw new Error(`Unknown manifest: ${mime}`);
}

export function normalizeTrack(t, source = 'tidal') {
  const arts = (t.artists || [t.artist]).filter(Boolean);
  return {
    id: String(t.id), title: t.title || 'Unknown', 
    artist: arts.map(a => a.name).join(', '),
    artistId: String(arts[0]?.id || ''),
    album: t.album?.title || '', albumId: String(t.album?.id || ''),
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

// Formatting Utilities
const _pad = n => String(Math.floor(n)).padStart(2, '0');
export const fmtDur = s => (!s || isNaN(s) || !isFinite(s)) ? '' : `${Math.floor(s / 60)}:${_pad(s % 60)}`;
export const fmtTime = s => (!s || isNaN(s) || !isFinite(s)) ? '0:00' : `${Math.floor(s / 60)}:${_pad(s % 60)}`;
export const escHtml = s => s ? s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';