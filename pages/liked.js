import * as UI from '../app/ui.js'
import State from '../app/state.js'
import { playTrack } from '../app/playback.js'
import { updateLikedCount } from '../app/likes.js'
import { attachTrackEvents } from './home.js'
import { getIcon } from '../app/icons.js'

const $ = (id) => document.getElementById(id)
let _likedSort = 'recent'

export function render() {
  updateLikedCount()
  let songs = [...State.get('library.likedSongs')]
  if (_likedSort === 'az') songs.sort((a, b) => a.title.localeCompare(b.title))
  const q = $('liked-filter-input')?.value.trim().toLowerCase() || ''
  if (q)
    songs = songs.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    )
  const el = $('liked-tracks')
  if (!el) return
  if (!songs.length) {
    el.innerHTML = `<div class="empty">${getIcon('heart')}<p>No liked songs</p><small>Like songs to see them here</small></div>`
    return
  }
  UI.renderTracks(songs, el, null)
  el._tracks = songs // needed by the global .track-more-btn delegation in sheets.js
  attachTrackEvents(el)
}

export function initEvents() {
  $('liked-play-all')?.addEventListener('click', () => {
    const songs = State.get('library.likedSongs')
    if (songs.length) playTrack(songs, 0)
    else UI.toast('No liked songs yet')
  })
  $('liked-filter-input')?.addEventListener('input', render)
  $('liked-sort-btn')?.addEventListener('click', () => {
    _likedSort = _likedSort === 'recent' ? 'az' : 'recent'
    const lbl = $('liked-sort-label')
    if (lbl) lbl.textContent = _likedSort === 'az' ? 'A–Z' : 'Recent'
    render()
  })
}
