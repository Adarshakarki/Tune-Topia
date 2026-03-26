import { fetchJSON } from '../api/utils.js'

const LRCLIB_BASE = 'https://lrclib.net/api'
const GENIUS_TOKEN = 'QmS9OvsS-7ifRBKx_ochIPQU7oejIS9Eo_z5iWHmCPyhwLVQID3pYTHJmJTa6z8z'
const GENIUS_PROXY = 'https://api.allorigins.win/raw?url='

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const cleanQuery = (str) => str.split('(')[0].split('-')[0].split('feat.')[0].trim()
const normalize = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// ─── LRCLIB (TIMED & WORD-LEVEL) ─────────────────────────────────────────────

export async function fetchLyrics(title, artist, album = '', duration = 0) {
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
    ...(album && { album_name: album }),
    ...(duration && { duration: Math.round(duration) }),
  })

  try {
    let data = await fetchJSON(`${LRCLIB_BASE}/get?${params}`)
    if (!data) {
      const searchData = await fetchJSON(`${LRCLIB_BASE}/search?${params}`)
      data = searchData?.[0]
    }

    if (!data) return { plain: null, synced: [] }

    return {
      plain: data.plainLyrics || null,
      synced: parseSynced(data.syncedLyrics),
    }
  } catch (e) {
    return { plain: null, synced: [] }
  }
}

/**
 * Parses Enhanced LRC format for word-by-word sync.
 * Standard: [mm:ss.xx] Line Text
 * Enhanced: [mm:ss.xx] <mm:ss.xx> Word <mm:ss.xx> Word
 */
export function parseSynced(raw) {
  if (!raw) return []

  const parseTime = (timeStr) => {
    const [m, s] = timeStr.split(':')
    return parseInt(m) * 60 + parseFloat(s)
  }

  return raw.split('\n').map(line => {
    // 1. Extract line start time: [00:00.00]
    const lineMatch = line.match(/^\[(\d+:\d+\.\d+)\](.*)/)
    if (!lineMatch) return null

    const startTime = parseTime(lineMatch[1])
    const content = lineMatch[2].trim()

    // 2. Check for word-level timestamps: <00:00.00>
    const words = []
    const wordRegex = /<(\d+:\d+\.\d+)>\s*([^\s<]+)/g
    let match
    
    while ((match = wordRegex.exec(content)) !== null) {
      words.push({
        time: parseTime(match[1]),
        text: match[2]
      })
    }

    // Return structured line
    return {
      time: startTime,
      text: content.replace(/<\d+:\d+\.\d+>/g, '').trim(), // Clean text for display
      words: words.length > 0 ? words : null // Array of {time, text} if enhanced
    }
  }).filter(l => l && (l.text || l.words))
}

export function getActiveLine(syncedLyrics, currentTime) {
  if (!syncedLyrics?.length) return -1
  return syncedLyrics.findLastIndex(line => currentTime >= line.time)
}

/**
 * Returns the index of the currently active word within a line
 */
export function getActiveWord(line, currentTime) {
  if (!line?.words) return -1
  return line.words.findLastIndex(word => currentTime >= word.time)
}

// ─── GENIUS (REMAINING LOGIC) ────────────────────────────────────────────────

const geniusCache = new Map()

async function geniusFetch(endpoint) {
  const url = `https://api.genius.com${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${GENIUS_TOKEN}`
  const res = await fetch(`${GENIUS_PROXY}${encodeURIComponent(url)}`)
  return res.json()
}

export async function getGeniusData(track) {
  if (geniusCache.has(track.id)) return geniusCache.get(track.id)
  try {
    const artistName = Array.isArray(track.artists) ? track.artists[0].name : (track.artist?.name || '')
    const query = encodeURIComponent(`${cleanQuery(track.title)} ${artistName}`)
    const search = await geniusFetch(`/search?q=${query}`)
    const hits = search.response.hits
    if (!hits?.length) return null

    const targetArtist = normalize(artistName)
    const bestMatch = hits.find(h => normalize(h.result.primary_artist.name).includes(targetArtist))?.result || hits[0].result
    const refs = await geniusFetch(`/referents?song_id=${bestMatch.id}&text_format=plain`)
    
    const result = { song: bestMatch, referents: refs.response.referents }
    geniusCache.set(track.id, result)
    return result
  } catch (e) { return null }
}