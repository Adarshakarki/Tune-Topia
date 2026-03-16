import { fetchJSON } from '../api/utils.js'

const LRCLIB_BASE = 'https://lrclib.net/api'

export async function fetchLyrics(title, artist, album = '', duration = 0) {
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      ...(album && { album_name: album }),
      ...(duration && { duration: Math.round(duration) }),
    })
    const data = await fetchJSON(`${LRCLIB_BASE}/get?${params}`)
    if (!data) throw new Error('No lyrics')
    return {
      plain: data.plainLyrics || null,
      synced: parseSynced(data.syncedLyrics),
    }
  } catch {
    return { plain: null, synced: [] }
  }
}

// Parse '[mm:ss.xx] line' into [{time, text}]
export function parseSynced(raw) {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => {
      const m = line.match(/^\[(\d+):(\d+\.\d+)\]\s*(.*)/)
      if (!m) return null
      return {
        time: parseFloat(m[1]) * 60 + parseFloat(m[2]),
        text: m[3].trim(),
      }
    })
    .filter(Boolean)
}

// Active lyric line index for current playback time
export function getActiveLine(syncedLyrics, currentTime) {
  if (!syncedLyrics?.length) return -1
  let active = 0
  for (let i = 0; i < syncedLyrics.length; i++) {
    if (currentTime >= syncedLyrics[i].time) active = i
    else break
  }
  return active
}
