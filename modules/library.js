import State from '../app/state.js'

const KEYS = {
  albums: 'tt_albums',
  artists: 'tt_artists',
  playlists: 'tt_playlists',
}

// ── Albums ────────────────────────────────────────────────────

function _saveAlbums(arr) {
  localStorage.setItem(KEYS.albums, JSON.stringify(arr))
  State.set('library.savedAlbums', arr)
}

export function getSavedAlbums() {
  return State.get('library.savedAlbums')
}
export function hasAlbum(id) {
  return getSavedAlbums().some((a) => a.id === String(id))
}
export function saveAlbum(album) {
  if (!hasAlbum(album.id))
    _saveAlbums([{ ...album, id: String(album.id) }, ...getSavedAlbums()])
}
export function removeAlbum(id) {
  _saveAlbums(getSavedAlbums().filter((a) => a.id !== String(id)))
}
export function toggleAlbum(album) {
  hasAlbum(album.id) ? removeAlbum(album.id) : saveAlbum(album)
  return hasAlbum(album.id)
}

// ── Artists ───────────────────────────────────────────────────

function _saveArtists(arr) {
  localStorage.setItem(KEYS.artists, JSON.stringify(arr))
  State.set('library.followedArtists', arr)
}

export function getFollowedArtists() {
  return State.get('library.followedArtists')
}
export function hasArtist(id) {
  return getFollowedArtists().some((a) => a.id === String(id))
}
export function followArtist(artist) {
  if (!hasArtist(artist.id))
    _saveArtists([
      { ...artist, id: String(artist.id) },
      ...getFollowedArtists(),
    ])
}
export function unfollowArtist(id) {
  _saveArtists(getFollowedArtists().filter((a) => a.id !== String(id)))
}
export function toggleArtist(artist) {
  hasArtist(artist.id) ? unfollowArtist(artist.id) : followArtist(artist)
  return hasArtist(artist.id)
}

// ── Playlists ─────────────────────────────────────────────────

function _savePlaylists(arr) {
  localStorage.setItem(KEYS.playlists, JSON.stringify(arr))
}

export function getPlaylists() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.playlists) || '[]')
  } catch {
    return []
  }
}

export function createPlaylist(name) {
  const pl = {
    id: Date.now().toString(),
    name,
    tracks: [],
    created: Date.now(),
  }
  _savePlaylists([...getPlaylists(), pl])
  return pl
}

export function addToPlaylist(playlistId, track) {
  _savePlaylists(
    getPlaylists().map((p) => {
      if (p.id !== playlistId) return p
      return p.tracks.some((t) => t.id === track.id)
        ? p
        : { ...p, tracks: [...p.tracks, track] }
    })
  )
}

export function removeFromPlaylist(playlistId, trackId) {
  _savePlaylists(
    getPlaylists().map((p) =>
      p.id !== playlistId
        ? p
        : { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
    )
  )
}

export function deletePlaylist(playlistId) {
  _savePlaylists(getPlaylists().filter((p) => p.id !== playlistId))
}
