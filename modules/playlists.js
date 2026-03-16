const STATE_KEY = 'library.playlists'
let _State = null

export function init(State) {
  _State = State
  if (!_State.get(STATE_KEY)) _State.set(STATE_KEY, [])
}

export function getAll() {
  return _State.get(STATE_KEY) || []
}
export function get(id) {
  return getAll().find((p) => p.id === id) || null
}

export function create({ name, description = '', cover = '' }) {
  const playlist = {
    id: _uid(),
    name: name.trim(),
    description: description.trim(),
    cover: cover.trim(),
    createdAt: Date.now(),
    tracks: [],
  }
  _State.set(STATE_KEY, [...getAll(), playlist])
  return playlist
}

export function update(id, { name, description, cover }) {
  const all = getAll().map((p) => {
    if (p.id !== id) return p
    return {
      ...p,
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(cover !== undefined && { cover: cover.trim() }),
    }
  })
  _State.set(STATE_KEY, all)
}

export function deletePlaylist(id) {
  _State.set(
    STATE_KEY,
    getAll().filter((p) => p.id !== id)
  )
}

export function addTrack(playlistId, track) {
  _State.set(
    STATE_KEY,
    getAll().map((p) => {
      if (p.id !== playlistId) return p
      if (p.tracks.some((t) => t.id === track.id)) return p // no duplicates
      return { ...p, tracks: [...p.tracks, track] }
    })
  )
}

export function removeTrack(playlistId, trackId) {
  _State.set(
    STATE_KEY,
    getAll().map((p) => {
      if (p.id !== playlistId) return p
      return { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
    })
  )
}

export function moveTrack(playlistId, fromIdx, toIdx) {
  _State.set(
    STATE_KEY,
    getAll().map((p) => {
      if (p.id !== playlistId) return p
      const tracks = [...p.tracks]
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= tracks.length ||
        toIdx >= tracks.length
      )
        return p
      const [track] = tracks.splice(fromIdx, 1)
      tracks.splice(toIdx, 0, track)
      return { ...p, tracks }
    })
  )
}

function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
