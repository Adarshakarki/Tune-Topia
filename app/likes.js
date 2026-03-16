import * as UI from './ui.js'
import State from './state.js'
import { toggle } from '../modules/likedSongs.js'

const $ = (id) => document.getElementById(id)

export function onLike(track) {
  if (!track) return
  const nowLiked = toggle(track)
  UI.syncLikeButtons(track.id)
  UI.toast(nowLiked ? `♥ Liked "${track.title}"` : 'Removed from Liked Songs')
  _updateLikedCount()
}

export function updateLikedCount() {
  _updateLikedCount()
}

function _updateLikedCount() {
  const n = State.get('library.likedSongs').length
  const label = `${n} song${n !== 1 ? 's' : ''}`
  ;['liked-count-label', 'liked-hero-sub'].forEach((id) => {
    const el = $(id)
    if (el) el.textContent = label
  })
}
