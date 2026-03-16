const KEY = 'followedArtists'

function _load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
function _save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {}
}

export function isFollowed(id) {
  return !!_load()[String(id)]
}

export function toggleFollow(artist) {
  const data = _load()
  const id = String(artist.id || artist.name)
  if (data[id]) {
    delete data[id]
  } else {
    data[id] = {
      id,
      name: artist.name,
      cover: artist.cover || '',
      followedAt: Date.now(),
    }
  }
  _save(data)
  window.dispatchEvent(new CustomEvent('followedArtistsChanged'))
}

export function getAll() {
  return Object.values(_load()).sort((a, b) => b.followedAt - a.followedAt)
}

export function getCount() {
  return Object.keys(_load()).length
}
