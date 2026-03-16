const KEY = 'tt_liked_videos'

function _load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function _save(videos) {
  try {
    localStorage.setItem(KEY, JSON.stringify(videos))
  } catch {}
}

export function getAll() {
  return _load()
}

export function has(id) {
  return _load().some((v) => v.id === id)
}

export const isLiked = has

export function toggle(video) {
  const all = _load()
  const idx = all.findIndex((v) => v.id === video.id)
  if (idx >= 0) all.splice(idx, 1)
  else all.unshift({ ...video, likedAt: Date.now() })
  _save(all)
  return idx < 0 // true = now liked
}

export function count() {
  return _load().length
}
