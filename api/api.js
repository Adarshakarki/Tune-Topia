
const BASE_TIMEOUT = 12000 //12s for slower networks
const RETRY_DELAY = 500

async function fetchJSON(url, timeout = BASE_TIMEOUT) {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), timeout)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    clearTimeout(tid)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } catch (e) {
    clearTimeout(tid)
    throw e
  }
}

//retry
async function tryBases(bases, path, retries = 2) {
  const errs = []
  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const base of bases) {
      try {
        const data = await fetchJSON(`${base}${path}`)
        return { data, base }
      } catch (e) {
        errs.push(`${base}: ${e.message}`)
        //exponential backoff before retry
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        }
      }
    }
  }
  throw new Error('All providers failed:\n' + errs.join('\n'))
}

function tidalCover(coverId, size = 320) {
  if (!coverId) return ''
  return `https://resources.tidal.com/images/${coverId.replace(/-/g, '/')}/${size}x${size}.jpg`
}

function decodeManifest(payload) {
  const raw = atob(payload.manifest)
  const mime = payload.manifestMimeType || ''

  if (mime === 'application/vnd.tidal.bts') {
    const manifest = JSON.parse(raw)
    return {
      type: 'direct',
      url: manifest.urls[0],
      mimeType: manifest.mimeType || 'audio/flac',
      codecs: manifest.codecs || 'flac',
      quality: payload.audioQuality,
      bitDepth: payload.bitDepth,
      sampleRate: payload.sampleRate,
    }
  }

  if (mime === 'application/dash+xml') {
    return {
      type: 'dash',
      manifest: raw,
      quality: payload.audioQuality,
      bitDepth: payload.bitDepth,
      sampleRate: payload.sampleRate,
    }
  }

  throw new Error('Unknown manifest: ' + mime)
}

function normalizeTrack(t, source = 'tidal') {
  const artists = (t.artists || [t.artist]).filter(Boolean)
  return {
    id: String(t.id),
    title: t.title || 'Unknown',
    artist: artists.map((a) => a.name).join(', '),
    album: t.album?.title || '',
    cover: tidalCover(t.album?.cover, 640),
    coverSmall: tidalCover(t.album?.cover, 160),
    duration: t.duration || 0,
    dur: fmtDur(t.duration),
    quality: t.audioQuality || '',
    tags: t.mediaMetadata?.tags || [],
    explicit: t.explicit || false,
    source,
  }
}

function qualityBadge(track) {
  const tags = track.tags || []
  if (tags.includes('HIRES_LOSSLESS')) return { label: 'HiRes', cls: 'hires' }
  if (tags.includes('LOSSLESS') || track.quality === 'LOSSLESS')
    return { label: 'FLAC', cls: 'lossless' }
  if (track.quality === 'YT') return { label: 'YT', cls: 'yt' }
  return null
}

function fmtDur(s) {
  if (!s || isNaN(s)) return ''
  return `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, '0')}`
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, '0')}`
}

function escHtml(s) {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export {
  fetchJSON,
  tryBases,
  tidalCover,
  decodeManifest,
  normalizeTrack,
  qualityBadge,
  fmtDur,
  fmtTime,
  escHtml,
}
