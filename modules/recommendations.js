import {
  COLD_START_ARTISTS,
  COLD_START_PICK_COUNT,
  COLD_START_YT_FALLBACK,
  GENRE_SEEDS,
  DISCOVERY_QUERY_COUNT,
  MAX_PERSONALISED_QUERIES,
} from '../data/defaults.js'

/**
 * Returns ordered query strings for home page Tidal searches.
 * @returns {{ queries: string[], isColdStart: boolean, ytFallback: string }}
 */
export function getHomeQueries(State, History) {
  const sources = _collectSources(State, History)
  if (!sources.length) {
    return {
      queries: _coldStartQueries(),
      isColdStart: true,
      ytFallback: COLD_START_YT_FALLBACK,
    }
  }
  return {
    queries: _dedupe([
      ..._buildPersonalisedQueries(sources),
      ..._buildDiscoveryQueries(sources),
    ]),
    isColdStart: false,
    ytFallback: COLD_START_YT_FALLBACK,
  }
}

// Gather artist signals from library; each entry has a weight
function _collectSources(State, History) {
  const scores = {}
  const bump = (artist, weight) => {
    if (!artist || typeof artist !== 'string') return
    const key = artist.trim().toLowerCase()
    if (key) scores[key] = (scores[key] || 0) + weight
  }

  ;(State.get('library.followedArtists') || []).forEach((a) =>
    bump(a.name || a, 5)
  )
  ;(State.get('library.likedSongs') || []).forEach((t) => bump(t.artist, 3))
  ;(State.get('library.savedAlbums') || []).forEach((a) => bump(a.artist, 2))

  const hist = History.getAll() || []
  const playCounts = {}
  hist.forEach((t) => {
    const k = (t.artist || '').trim().toLowerCase()
    playCounts[k] = (playCounts[k] || 0) + 1
  })
  Object.entries(playCounts).forEach(([key, count]) => {
    const original =
      hist.find((t) => t.artist?.trim().toLowerCase() === key)?.artist || key
    bump(original, count * 1.5)
  })

  const followed = State.get('library.followedArtists') || []
  const liked = State.get('library.likedSongs') || []
  const albums = State.get('library.savedAlbums') || []
  const seen = new Set()

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => {
      const match =
        followed.find((a) => (a.name || a)?.trim().toLowerCase() === key) ||
        liked.find((t) => t.artist?.trim().toLowerCase() === key) ||
        albums.find((a) => a.artist?.trim().toLowerCase() === key) ||
        hist.find((t) => t.artist?.trim().toLowerCase() === key)
      return match ? match.name || match.artist || match : key
    })
    .filter((a) => {
      const k = (typeof a === 'string' ? a : a?.name || '').toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((a) => (typeof a === 'string' ? a : a?.name || ''))
}

function _buildPersonalisedQueries(sources) {
  return sources.slice(0, MAX_PERSONALISED_QUERIES)
}
function _buildDiscoveryQueries() {
  return _shuffle(Object.values(GENRE_SEEDS)).slice(0, DISCOVERY_QUERY_COUNT)
}
function _coldStartQueries() {
  return _shuffle([...COLD_START_ARTISTS]).slice(0, COLD_START_PICK_COUNT)
}

function _dedupe(arr) {
  const seen = new Set()
  return arr.filter((q) => {
    const k = q.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function _shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
