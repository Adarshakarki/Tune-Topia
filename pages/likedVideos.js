// Liked Videos
import * as LikedVideos from '../modules/likedVideos.js'
import * as UI from '../app/ui.js'
import { escHtml } from '../api/utils.js'

const $ = (id) => document.getElementById(id)

let _playVideo = null
let _query = ''
let _sortMode = 'recent' // 'recent' | 'az'

// For search.js
export const toggle = (video) => {
  const result = LikedVideos.toggle(video)
  _updateGlobalCount()
  return result
}
export const isLiked = LikedVideos.has

export function init(playVideoFn) {
  _playVideo = playVideoFn
  _updateGlobalCount()

  $('lv-filter-input')?.addEventListener('input', (e) => {
    _query = e.target.value.trim().toLowerCase()
    _render()
  })

  $('lv-sort-label')?.addEventListener('click', () => {
    _sortMode = _sortMode === 'recent' ? 'az' : 'recent'
    _updateSortLabel()
    _render()
  })
}

export function onEnter() {
  _query = ''
  _sortMode = 'recent'
  
  const input = $('lv-filter-input')
  if (input) input.value = ''
  
  _updateSortLabel()
  _render()
}

export const refresh = () => _render()

function _updateSortLabel() {
  const lbl = $('lv-sort-label')
  if (lbl) lbl.textContent = _sortMode === 'recent' ? 'Recent' : 'A–Z'
}

function _getFilteredVideos() {
  let items = [...LikedVideos.getAll()]

  if (_query) {
    items = items.filter(v => 
      v.title?.toLowerCase().includes(_query) || 
      v.artist?.toLowerCase().includes(_query)
    )
  }

  if (_sortMode === 'az') {
    items.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  } else {
    items.reverse() // Newest first
  }

  return items
}

function _render() {
  const list = $('lv-list')
  if (!list) return

  const all = LikedVideos.getAll()
  const filtered = _getFilteredVideos()

  const countEl = $('lv-count')
  if (countEl) {
    countEl.textContent = `${all.length} video${all.length !== 1 ? 's' : ''}`
  }

  if (!all.length) {
    list.innerHTML = `
      ${UI.emptyState('camera', 'No liked videos yet', 'Like videos from search to save them here')}`
    return
  }

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty">
        <i class="bi bi-search"></i>
        <p>No results</p>
      </div>`
    return
  }

  list.innerHTML = filtered
    .map(
      (v) => `
    <div class="vc-row lv-row" data-id="${escHtml(v.id)}">
      <div class="vc-thumb-wrap">
        <img class="vc-thumb" src="${escHtml(v.cover || v.coverSmall || '')}" alt="" onerror="this.src=''"/>
        <div class="vc-overlay" style="color:#fff;font-size:22px">${UI.getIcon('play')}</div>
        <span class="vc-source-badge ${v.source === 'youtube' ? 'vc-badge-yt' : 'vc-badge-tidal'}">
          ${v.source === 'youtube' ? 'YT' : 'Tidal'}
        </span>
        ${v.dur ? `<span class="vc-dur">${escHtml(v.dur)}</span>` : ''}
      </div>
      <div class="vc-info">
        <div class="vc-title">${escHtml(v.title || '')}</div>
        <div class="vc-artist">${escHtml(v.artist || '')}</div>
      </div>
      <button class="vc-like-btn lv-unlike-btn" data-id="${escHtml(v.id)}" title="Unlike">
        <span class="vc-like-icon liked">${UI.getIcon('heartFill')}</span>
      </button>
    </div>`
    )
    .join('')

  list.querySelectorAll('.lv-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.lv-unlike-btn')) return;
      const video = all.find(v => v.id === row.dataset.id)
      if (video && _playVideo) _playVideo(video)
    })
  })

  list.querySelectorAll('.lv-unlike-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const video = all.find(v => v.id === btn.dataset.id)
      if (video) {
        LikedVideos.toggle(video)
        _updateGlobalCount()
        _render()
      }
    })
  })
}

function _updateGlobalCount() {
  const count = LikedVideos.count()
  const label = $('liked-videos-count-label')
  if (label) {
    label.textContent = `${count} video${count !== 1 ? 's' : ''}`
  }
}
