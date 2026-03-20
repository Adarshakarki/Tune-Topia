import * as LikedVideos from '../modules/likedVideos.js'
import { escHtml } from '../api/utils.js'

// re-exports used by search.js
export const toggle = (video) => {
  const r = LikedVideos.toggle(video)
  _updateCount()
  return r
}
export const isLiked = LikedVideos.has

const $ = (id) => document.getElementById(id)

function _updateCount() {
  const n = LikedVideos.count()
  const lbl = $('liked-videos-count-label')
  if (lbl) lbl.textContent = `${n} video${n !== 1 ? 's' : ''}`
}

let _playVideo = null
let _filterQ = ''
let _sort = 'recent'

export function init(playVideoFn) {
  _playVideo = playVideoFn
  _updateCount()

  $('lv-filter-input')?.addEventListener('input', (e) => {
    _filterQ = e.target.value.trim().toLowerCase()
    _render()
  })

  $('lv-sort-label')?.addEventListener('click', () => {
    _sort = _sort === 'recent' ? 'az' : 'recent'
    const lbl = $('lv-sort-label')
    if (lbl) lbl.textContent = _sort === 'recent' ? 'Recent' : 'A–Z'
    _render()
  })
}

export function onEnter() {
  _filterQ = ''
  _sort = 'recent'
  const inp = $('lv-filter-input')
  if (inp) inp.value = ''
  const lbl = $('lv-sort-label')
  if (lbl) lbl.textContent = 'Recent'
  _render()
}

export function refresh() {
  _render()
}

function _getVideos() {
  let videos = LikedVideos.getAll()
  if (_filterQ)
    videos = videos.filter(
      (v) =>
        v.title?.toLowerCase().includes(_filterQ) ||
        v.artist?.toLowerCase().includes(_filterQ)
    )
  if (_sort === 'az')
    videos.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  return videos
}

function _render() {
  const list = $('lv-list')
  if (!list) return
  const all = LikedVideos.getAll()
  const videos = _getVideos()

  const countEl = $('lv-count')
  if (countEl)
    countEl.textContent = `${all.length} video${all.length !== 1 ? 's' : ''}`

  if (!all.length) {
    list.innerHTML = `
      <div class="empty">
        <i class="bi bi-camera-video"></i>
        <p>No liked videos yet</p>
        <small>Like videos from search to save them here</small>
      </div>`
    return
  }

  if (!videos.length) {
    list.innerHTML = `<div class="empty"><i class="bi bi-search"></i><p>No results</p></div>`
    return
  }

  list.innerHTML = videos
    .map(
      (v) => `
    <div class="vc-row lv-row" data-id="${escHtml(v.id)}">
      <div class="vc-thumb-wrap">
        <img class="vc-thumb" src="${escHtml(v.cover || v.coverSmall || '')}" alt="" onerror="this.src=''"/>
        <div class="vc-overlay"><i class="bi bi-play-fill" style="color:#fff;font-size:22px"></i></div>
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
        <i class="bi bi-heart-fill vc-like-icon liked"></i>
      </button>
    </div>`
    )
    .join('')

  list.querySelectorAll('.lv-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.lv-unlike-btn')) return
      const id = row.dataset.id
      const vid = LikedVideos.getAll().find((v) => v.id === id)
      if (vid && _playVideo) _playVideo(vid)
    })
  })

  list.querySelectorAll('.lv-unlike-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = btn.dataset.id
      const vid = LikedVideos.getAll().find((v) => v.id === id)
      if (vid) {
        LikedVideos.toggle(vid)
        _updateCount()
        _render()
      }
    })
  })
}
