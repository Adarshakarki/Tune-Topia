import { getPlaylist } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import { extractColor } from '../app/ui.js'
import { toggle, has } from '../modules/likedSongs.js'
import Queue from '../modules/queue.js'
import * as Player from '../modules/player.js'

const $ = (id) => document.getElementById(id)

let _playlist = null
let _tracks = []
let _sheetTrack = null
let _playFn = null

export function init(playTrackFn) {
  _playFn = playTrackFn

  $('pl-back-btn')?.addEventListener('click', close)
  $('pl-play-all')?.addEventListener('click', () => {
    if (_tracks.length) {
      _playFn(_tracks, 0)
      close()
    }
  })
  $('pl-shuffle-btn')?.addEventListener('click', () => {
    if (!_tracks.length) return
    _playFn(_tracks, Math.floor(Math.random() * _tracks.length))
    Player.toggleShuffle()
    close()
  })

  $('pl-track-sheet-overlay')?.addEventListener('click', _closeSheet)
  $('pl-sheet-play-next')?.addEventListener('click', () => {
    if (_sheetTrack) {
      Queue.addNext(_sheetTrack)
      _closeSheet()
    }
  })
  $('pl-sheet-add-queue')?.addEventListener('click', () => {
    if (_sheetTrack) {
      Queue.add(_sheetTrack)
      _closeSheet()
    }
  })
  $('pl-sheet-like')?.addEventListener('click', () => {
    if (!_sheetTrack) return
    toggle(_sheetTrack)
    _syncSheetLike()
    _closeSheet()
  })
  $('pl-sheet-share')?.addEventListener('click', () => {
    if (!_sheetTrack) return
    const url =
      _sheetTrack.source === 'youtube'
        ? `https://youtu.be/${_sheetTrack.id}`
        : `https://tidal.com/track/${_sheetTrack.id}`
    if (navigator.share)
      navigator.share({
        title: `${_sheetTrack.title} — ${_sheetTrack.artist}`,
        url,
      })
    else navigator.clipboard.writeText(url)
    _closeSheet()
  })
}

export async function open(playlist) {
  _playlist = playlist
  _tracks = []
  const page = $('page-playlist')
  if (!page) return

  _applyColor(30, 28, 38)
  _setHeader(playlist)
  $('pl-tracklist').innerHTML = _skeleton()
  page.classList.add('open')
  document.body.style.overflow = 'hidden'

  if (playlist.cover)
    extractColor(playlist.cover, (r, g, b) => _applyColor(r, g, b))

  if (playlist.tracks?.length) {
    _tracks = playlist.tracks
    _renderTracklist(_tracks)
    _setMeta(_tracks)
    return
  }

  try {
    const result = await getPlaylist(playlist.id)
    _tracks = result.tracks
    _renderTracklist(_tracks)
    _setMeta(_tracks)
  } catch {
    $('pl-tracklist').innerHTML =
      '<div class="empty"><i class="bi bi-wifi-off"></i><p>Failed to load</p></div>'
  }
}

export function close() {
  $('page-playlist')?.classList.remove('open')
  document.body.style.overflow = ''
}

function _applyColor(r, g, b) {
  const dr = Math.round(r * 0.88),
    dg = Math.round(g * 0.88),
    db = Math.round(b * 0.88)
  const page = $('page-playlist')
  if (!page) return
  const dark = `rgb(${dr},${dg},${db})`
  page.style.setProperty('--pl-dark', dark)
  page.style.setProperty('--pl-accent', `rgb(${r},${g},${b})`)
  page.style.background = dark
  page.setAttribute(
    'data-light',
    0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false'
  )
}

function _setHeader(pl) {
  $('pl-hero-art').src = pl.cover || ''
  $('pl-hero-title').textContent = pl.title || ''
  $('pl-hero-desc').textContent = pl.description || ''
  $('pl-topbar-title').textContent = pl.title || ''
}

function _setMeta(tracks) {
  const mins = Math.floor(
    tracks.reduce((s, t) => {
      const p = (t.dur || '0:00').split(':').map(Number)
      return s + p[0] * 60 + (p[1] || 0)
    }, 0) / 60
  )
  const parts = [`${tracks.length} songs`]
  if (mins) parts.push(`${mins} min`)
  $('pl-hero-meta').textContent = parts.join(' · ')
}

function _renderTracklist(tracks) {
  const el = $('pl-tracklist')
  if (!el) return
  if (!tracks.length) {
    el.innerHTML =
      '<div class="empty"><i class="bi bi-music-note-beamed"></i><p>No tracks found</p></div>'
    return
  }
el.innerHTML = tracks
    .map(
      (t, i) => `
    <div class="alb-track" data-index="${i}" data-tid="${escHtml(t.id)}">
      <span class="alb-track-num">${i + 1}</span>
      <img class="alb-track-thumb" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.style.display='none'" alt=""/>
      <div class="alb-track-info">
        <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ' <span class="explicit-tag">E</span>' : ''}</div>
        <div class="alb-track-artist">${escHtml(t.artist || '')}</div>
      </div>
      <span class="alb-track-dur">${t.dur || ''}</span>
      <button class="alb-track-more" data-index="${i}"><i class="bi bi-three-dots"></i></button>
    </div>`
    )
    .join('')

  el.querySelectorAll('.alb-track').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.alb-track-more'))
        _playFn(_tracks, +row.dataset.index)
    })
  })
  el.querySelectorAll('.alb-track-more').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      _openSheet(_tracks[+btn.dataset.index])
    })
  })
}

function _openSheet(track) {
  _sheetTrack = track
  const p = $('pl-sheet-preview')
  if (p && track)
    p.innerHTML = `
    <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
    <div><div class="bs-title">${escHtml(track.title)}</div><div class="bs-artist">${escHtml(track.artist || '')}</div></div>`
  _syncSheetLike()
  $('pl-track-sheet')?.classList.add('open')
}
function _closeSheet() {
  $('pl-track-sheet')?.classList.remove('open')
  _sheetTrack = null
}
function _syncSheetLike() {
  const btn = $('pl-sheet-like')
  if (!btn || !_sheetTrack) return
  const liked = has(_sheetTrack.id)
  btn.innerHTML = `<i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i> ${liked ? 'Unlike' : 'Like'}`
}

function _skeleton() {
  return Array(10)
    .fill(0)
    .map(
      (_, i) => `
    <div class="alb-track alb-track-skel">
      <span class="alb-track-num">${i + 1}</span>
      <div class="alb-track-info">
        <div class="skeleton" style="height:13px;width:${50 + Math.random() * 35}%;border-radius:6px;margin-bottom:6px"></div>
        <div class="skeleton" style="height:11px;width:${25 + Math.random() * 20}%;border-radius:6px"></div>
      </div>
    </div>`
    )
    .join('')
}
