// User Playlist
import { escHtml } from '../api/utils.js'
import * as UI from '../app/ui.js'
import * as Playlists from '../modules/playlists.js'
import { openTrackSheet } from '../ui/sheets.js'
import { openEditModal } from './playlists-ui.js'

const $ = (id) => document.getElementById(id)

let _playFn = null
let _onRemoveCallback = null
let _currentPlaylist = null
let _sortMode = 'default' // Sorting

export function init(playFn, onRemove) {
  _playFn = playFn
  _onRemoveCallback = onRemove

  window._uplRefresh = (id) => {
    if (_currentPlaylist?.id === id) {
      _currentPlaylist = Playlists.get(id)
      _render()
    }
  }

  $('upl-back-btn')?.addEventListener('click', close)

  $('upl-edit-btn')?.addEventListener('click', () => {
    if (_currentPlaylist) openEditModal(_currentPlaylist.id)
  })

  $('upl-play-all')?.addEventListener('click', () => {
    if (_currentPlaylist?.tracks?.length) _playFn(_currentPlaylist.tracks, 0)
  })

  $('upl-shuffle-btn')?.addEventListener('click', () => {
    if (!_currentPlaylist?.tracks?.length) return
    const shuffled = [..._currentPlaylist.tracks].sort(() => Math.random() - 0.5)
    _playFn(shuffled, 0)
  })

  $('upl-sort-label')?.addEventListener('click', () => {
    const opts = ['default', 'az', 'recent']
    const labels = { default: 'Default', az: 'A–Z', recent: 'Recent' }
    
    _sortMode = opts[(opts.indexOf(_sortMode) + 1) % opts.length]
    if ($('upl-sort-label')) $('upl-sort-label').textContent = labels[_sortMode]
    _render()
  })

  $('upl-filter-input')?.addEventListener('input', _render)
}

export function open(playlistId) {
  const pl = Playlists.get(playlistId)
  if (!pl) return

  _currentPlaylist = pl
  _sortMode = 'default'
  
  if ($('upl-sort-label')) $('upl-sort-label').textContent = 'Default'
  if ($('upl-filter-input')) $('upl-filter-input').value = ''

  _render()
  $('page-user-playlist')?.classList.add('open')
}

export function close() {
  $('page-user-playlist')?.classList.remove('open')
  _currentPlaylist = null
}

function _getFilteredTracks() {
  let items = [...(_currentPlaylist?.tracks || [])]
  const query = $('upl-filter-input')?.value.trim().toLowerCase()

  if (query) {
    items = items.filter(t => 
      t.title?.toLowerCase().includes(query) || 
      t.artist?.toLowerCase().includes(query)
    )
  }

  if (_sortMode === 'az') {
    items.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  } else if (_sortMode === 'recent') {
    items.reverse()
  }

  return items
}

function _render() {
  const pl = _currentPlaylist
  if (!pl) return

  _updateHeaderUI(pl)

  const listEl = $('upl-tracklist')
  if (!listEl) return

  const tracks = _getFilteredTracks()
  if (!pl.tracks.length) {
    listEl.innerHTML = UI.emptyState('music', 'No songs yet', 'Add songs from the now playing menu');
    return
  }

  if (!tracks.length) {
    listEl.innerHTML = UI.emptyState('search', 'No results');
    return
  }

  listEl.innerHTML = tracks
    .map(
      (t, i) => `
    <div class="track-card upl-track" data-index="${i}" data-tid="${escHtml(t.id)}">
      <img class="track-thumb" src="${escHtml(t.cover || '')}" alt="" onerror="this.style.display='none'"/>
      <div class="track-info">
        <div class="track-name">${escHtml(t.title)}</div>
        <div class="track-meta">${escHtml(t.artist)}</div>
      </div>
      <button class="upl-track-more track-more-btn-local">
        ${UI.getIcon('more')}
      </button>
    </div>`
    )
    .join('')

  listEl._tracks = tracks

  listEl.querySelectorAll('.upl-track').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.upl-track-more')) return
      _playFn(tracks, +card.dataset.index)
    })
  })

  listEl.querySelectorAll('.upl-track-more').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const track = tracks[+btn.closest('.upl-track').dataset.index]
      if (!track) return
      _openTrackOptions(track)
    })
  })
}

function _updateHeaderUI(pl) {
  if ($('upl-topbar-title')) $('upl-topbar-title').textContent = pl.name
  if ($('upl-title')) $('upl-title').textContent = pl.name
  if ($('upl-desc')) $('upl-desc').textContent = pl.description || ''
  if ($('upl-meta')) $('upl-meta').textContent = `${pl.tracks.length} song${pl.tracks.length !== 1 ? 's' : ''}`

  const heroArt = $('upl-hero-art')
  const heroPlaceholder = $('upl-hero-placeholder')
  if (heroArt && heroPlaceholder) {
    heroArt.src = pl.cover || ''
    heroArt.style.display = pl.cover ? 'block' : 'none'
    heroPlaceholder.style.display = pl.cover ? 'none' : 'flex'
  }
}

function _openTrackOptions(track) {
  const origIdx = _currentPlaylist.tracks.findIndex((t) => t.id === track.id)
  
  openTrackSheet(track, {
    onRemove: () => {
      Playlists.removeTrack(_currentPlaylist.id, track.id)
      _currentPlaylist = Playlists.get(_currentPlaylist.id)
      _render()
      _onRemoveCallback?.(_currentPlaylist)
    },
    onMoveUp: origIdx > 0 ? () => {
      Playlists.moveTrack(_currentPlaylist.id, origIdx, origIdx - 1)
      _currentPlaylist = Playlists.get(_currentPlaylist.id)
      _render()
    } : null,
    onMoveDown: origIdx < _currentPlaylist.tracks.length - 1 ? () => {
      Playlists.moveTrack(_currentPlaylist.id, origIdx, origIdx + 1)
      _currentPlaylist = Playlists.get(_currentPlaylist.id)
      _render()
    } : null,
  })
}
