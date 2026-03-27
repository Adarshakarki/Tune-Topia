import { getAlbumTracks, searchTracks, searchVideos } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import { extractColor, revertThemeColor } from '../app/ui.js'
import { toggle, has } from '../modules/likedSongs.js'
import { toggleAlbum, hasAlbum } from '../modules/library.js'
import Queue from '../modules/queue.js'
import * as Player from '../modules/player.js'

const $ = (id) => document.getElementById(id)

let _album = null
let _tracks = []
let _sheetTrack = null
let _playFn = null

export function init(playTrackFn) {
  _playFn = playTrackFn

  $('album-back-btn')?.addEventListener('click', close)
  $('album-save-btn')?.addEventListener('click', () => {
    if (_album) {
      toggleAlbum(_album)
      _syncSaveBtn()
    }
  })
  $('album-play-all')?.addEventListener('click', () => {
    if (_tracks.length) {
      _playFn(_tracks, 0)
      close()
    }
  })
  $('album-shuffle')?.addEventListener('click', () => {
    if (!_tracks.length) return
    _playFn(_tracks, Math.floor(Math.random() * _tracks.length))
    Player.toggleShuffle()
    close()
  })
  $('album-hero-like')?.addEventListener('click', () => {
    if (_album) {
      toggleAlbum(_album)
      _syncHeroLike()
    }
  })

  $('album-track-sheet-overlay')?.addEventListener('click', _closeSheet)
  $('album-sheet-play-next')?.addEventListener('click', () => {
    if (_sheetTrack) {
      Queue.addNext(_sheetTrack)
      _closeSheet()
    }
  })
  $('album-sheet-add-queue')?.addEventListener('click', () => {
    if (_sheetTrack) {
      Queue.add(_sheetTrack)
      _closeSheet()
    }
  })
  $('album-sheet-like')?.addEventListener('click', () => {
    if (!_sheetTrack) return
    toggle(_sheetTrack)
    _syncSheetLike()
    _closeSheet()
  })
  $('album-sheet-share')?.addEventListener('click', () => {
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

export async function open(album) {
  _album = album
  _tracks = []
  const page = $('page-album')
  if (!page) return

  _applyColor(30, 28, 38)
  _setHeader(album)
  _syncHeroLike()
  $('album-tracklist').innerHTML = _skeleton()
  page.classList.add('open')
  document.body.style.overflow = 'hidden'

  if (album.cover) extractColor(album.cover, (r, g, b) => _applyColor(r, g, b))

  try {
    let tracks = []
    if (album.id) {
      try {
        tracks = await getAlbumTracks(album.id)
      } catch {}
    }
    if (!tracks.length) {
      try {
        tracks = await searchTracks(`${album.title} ${album.artist || ''}`)
      } catch {}
    }
    if (!tracks.length)
      tracks = await searchVideos(`${album.title} ${album.artist || ''}`)

    // dedupe
    const seen = new Set()
    tracks = tracks.filter((t) => {
      const key = `${t.title?.toLowerCase()}|${t.artist?.toLowerCase()}`
      return seen.has(key) ? false : (seen.add(key), true)
    })

    _tracks = tracks
    _renderTracklist(tracks)
    _setMeta(album, tracks)
    _syncHeroLike()
  } catch {
    $('album-tracklist').innerHTML =
      '<div class="empty"><i class="bi bi-wifi-off"></i><p>Failed to load</p></div>'
  }
}

export function close() {
  const page = $('page-album')
  page?.classList.remove('open', 'stacked')
  document.body.style.overflow = ''
  revertThemeColor()
}

function _applyColor(r, g, b) {
  const dr = Math.round(r * 0.88),
    dg = Math.round(g * 0.88),
    db = Math.round(b * 0.88)
  const page = $('page-album')
  if (!page) return
  const dark = `rgb(${dr},${dg},${db})`
  page.style.setProperty('--alb-dark', dark)
  page.style.setProperty('--alb-accent', `rgb(${r},${g},${b})`)
  page.style.background = dark
  page.setAttribute(
    'data-light',
    0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false'
  )
}

function _setHeader(album) {
  const art = album.cover || ''
  $('album-hero-art').src = art
  $('album-hero-title').textContent = album.title || ''
  $('album-hero-artist').textContent = album.artist || ''
  $('album-hero-meta').textContent = album.year ? String(album.year) : ''
  const bg = $('album-hero-bg'),
    bl = $('album-hero-img-left'),
    br = $('album-hero-img-right')
  if (bg && art) bg.style.backgroundImage = `url('${art}')`
  if (bl) bl.src = art
  if (br) br.src = art
}

function _setMeta(album, tracks) {
  const mins = Math.floor(
    tracks.reduce((s, t) => {
      const p = (t.dur || '0:00').split(':').map(Number)
      return s + p[0] * 60 + (p[1] || 0)
    }, 0) / 60
  )
  const parts = []
  if (album.year) parts.push(String(album.year))
  parts.push(`${tracks.length} songs`)
  if (mins) parts.push(`${mins} min`)
  $('album-hero-meta').textContent = parts.join(' · ')
}

function _syncSaveBtn() {
  const btn = $('album-save-btn')
  if (!btn || !_album) return
  btn.classList.toggle('saved', hasAlbum(_album.id))
}

function _syncHeroLike() {
  const btn = $('album-hero-like')
  if (!btn || !_album) return
  const saved = hasAlbum(_album.id)
  btn.innerHTML = `<i class="bi ${saved ? 'bi-heart-fill' : 'bi-heart'}"></i>`
  btn.classList.toggle('liked', saved)
}

function _renderTracklist(tracks) {
  const el = $('album-tracklist')
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
  const p = $('album-sheet-preview')
  if (p && track)
    p.innerHTML = `
    <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
    <div><div class="bs-title">${escHtml(track.title)}</div><div class="bs-artist">${escHtml(track.artist || '')}</div></div>`
  _syncSheetLike()
  $('album-track-sheet')?.classList.add('open')
}
function _closeSheet() {
  $('album-track-sheet')?.classList.remove('open')
  _sheetTrack = null
}
function _syncSheetLike() {
  const btn = $('album-sheet-like')
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
