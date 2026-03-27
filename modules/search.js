import State from '../app/state.js'
import {
  searchTracks,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchTidalVideos,
} from '../api/index.js'
import { searchVideos } from '../api/index.js'

function _setLoading(val) {
  State.set('search.isLoading', val)
}
function _detectTopResult(tracks) {
  return tracks.length ? tracks[0] : null
}

let _debounceTimer = null
const DEBOUNCE_DELAY = 300

export async function runSearch(query, tab = 'music') {
  if (!query.trim()) return
  State.set('search.query', query)
  State.set('search.activeTab', tab)
  _setLoading(true)
  try {
    let results = []
    if (tab === 'music') {
      results = await searchTracks(query).catch(() => [])
      State.set('search.topResult', _detectTopResult(results))
    } else if (tab === 'video') {
      const [tidal, yt] = await Promise.allSettled([
        searchTidalVideos(query),
        searchVideos(query),
      ])
      const tidalResults = tidal.status === 'fulfilled' ? tidal.value : []
      const ytResults = yt.status === 'fulfilled' ? yt.value : []
      results = [...tidalResults, ...ytResults]
      State.set('search.topResult', null)
    } else if (tab === 'albums') {
      results = await searchAlbums(query)
      State.set('search.topResult', null)
    } else if (tab === 'artists') {
      results = await searchArtists(query)
      State.set('search.topResult', null)
    } else if (tab === 'playlists') {
      results = await searchPlaylists(query)
      State.set('search.topResult', null)
    }
    State.set('search.results', results)
  } catch {
    State.set('search.results', [])
    State.set('search.topResult', null)
  } finally {
    _setLoading(false)
  }
}

export function debouncedSearch(query, tab = 'music') {
  clearTimeout(_debounceTimer)
  State.set('search.query', query)

  if (!query.trim()) {
    _setLoading(false)
    return
  }

  _setLoading(true)
  _debounceTimer = setTimeout(() => runSearch(query, tab), DEBOUNCE_DELAY)
}

export function setMood(mood) {
  State.set('search.mood', mood)
}

export function clearSearch() {
  clearTimeout(_debounceTimer)
  State.set('search.query', '')
  State.set('search.results', [])
  State.set('search.topResult', null)
  State.set('search.isLoading', false)
  State.set('search.mood', null)
}

export function setTab(tab) {
  State.set('search.activeTab', tab)
  const query = State.get('search.query')
  if (query) debouncedSearch(query, tab)
}