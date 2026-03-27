import { searchArtists, searchTracks, searchAlbums } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import { extractColor, revertThemeColor } from '../app/ui.js'
import { toggle, has } from '../modules/likedSongs.js'
import { toggleArtist, hasArtist } from '../modules/library.js'
import Queue from '../modules/queue.js'
import * as Player from '../modules/player.js'

const $ = (id) => document.getElementById(id)

let _artist = null
let _tracks = []
let _albums = []
let _playFn = null
let _openAlbum = null
let _sheetTrack = null

export function init(playTrackFn, openAlbumFn) {
  _playFn = playTrackFn
  _openAlbum = openAlbumFn

  $('artist-back-btn')?.addEventListener('click', close)
  $('artist-follow-btn')?.addEventListener('click', () => {
    if (_artist) {
      toggleArtist(_artist)
      _syncFollow()
    }
  })
  $('artist-play-btn')?.addEventListener('click', () => {
    if (_tracks.length) {
      _playFn(_tracks[0], _tracks, 0)
      close()
    }
  })

  $('artist-track-sheet-overlay')?.addEventListener('click', _closeSheet)
  $('artist-sheet-play-next')?.addEventListener('click', () => {
    if (_sheetTrack) {
      Queue.addNext(_sheetTrack)
      _closeSheet()
    }
  })
  $('artist-sheet-add-queue')?.addEventListener('click', () => {
    if (_sheetTrack) {
      Queue.add(_sheetTrack)
      _closeSheet()
    }
  })
  $('artist-sheet-like')?.addEventListener('click', () => {
    if (!_sheetTrack) return
    toggle(_sheetTrack)
    _syncSheetLike()
    _closeSheet()
  })
  $('artist-sheet-share')?.addEventListener('click', () => {
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

export async function open(artistInput) {
  _artist = artistInput
  _tracks = []
  _albums = []
  const page = $('page-artist')
  if (!page) return

  _applyColor(30, 28, 38)
  _setHeader(artistInput)
  $('artist-tracklist').innerHTML = _skeletonTracks()
  $('artist-discography').innerHTML = _skeletonAlbums()
  $('artist-wiki-section').style.display = 'none'
  page.classList.add('open')
  document.body.style.overflow = 'hidden'

  // resolve full artist if only name given
  let artist = artistInput
  if (!artist.id) {
    try {
      const r = await searchArtists(artist.name)
      if (r.length) artist = { ...r[0], ...artist }
    } catch {}
  }
  artist = { ...artist, id: String(artist.id || '') }
  _artist = artist

  if (artist.cover) {
    extractColor(artist.cover, (r, g, b) => _applyColor(r, g, b))
    $('artist-hero-img').src = artist.cover
  }
  _syncFollow()

  await Promise.allSettled([
    _loadTracks(artist),
    _loadAlbums(artist),
    _loadWiki(artist.name),
  ])
}

export function close() {
  const page = $('page-artist')
  page?.classList.remove('open', 'stacked')
  document.body.style.overflow = ''
  revertThemeColor()
}

function _applyColor(r, g, b) {
  const dr = Math.round(r * 0.52),
    dg = Math.round(g * 0.52),
    db = Math.round(b * 0.52)
  const page = $('page-artist')
  if (!page) return
  const dark = `rgb(${dr},${dg},${db})`
  page.style.setProperty('--art-dark', dark)
  page.style.setProperty('--art-accent', `rgb(${r},${g},${b})`)
  page.style.background = dark
  page.setAttribute(
    'data-light',
    0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false'
  )
}

function _setHeader(artist) {
  $('artist-topbar-title').textContent = artist.name || ''
  $('artist-hero-name').textContent = artist.name || ''
  if (artist.cover) $('artist-hero-img').src = artist.cover
}

function _syncFollow() {
  const btn = $('artist-follow-btn')
  if (!btn || !_artist) return
  const following = hasArtist(_artist.id || _artist.name)
  btn.textContent = following ? 'Following' : 'Follow'
  btn.classList.toggle('following', following)
}

async function _loadTracks(artist) {
  try {
    let tracks = await searchTracks(artist.name)
    const seen = new Set()
    tracks = tracks.filter((t) => {
      const key = `${t.title?.toLowerCase()}|${t.artist?.toLowerCase()}`
      return seen.has(key) ? false : (seen.add(key), true)
    })
    _tracks = tracks.slice(0, 5)
    _renderTracks(_tracks)
  } catch {
    $('artist-tracklist').innerHTML =
      '<div class="empty"><i class="bi bi-wifi-off"></i><p>Failed to load</p></div>'
  }
}

async function _loadAlbums(artist) {
  try {
    const [a, b] = await Promise.allSettled([
      searchAlbums(artist.name),
      searchAlbums(artist.name + ' album'),
    ])
    const raw = [
      ...(a.status === 'fulfilled' ? a.value : []),
      ...(b.status === 'fulfilled' ? b.value : []),
    ]
    const seen = new Set()
    _albums = raw.filter((al) => !seen.has(al.id) && seen.add(al.id))
    _renderAlbums(_albums)
  } catch {
    $('artist-discography').innerHTML =
      '<div class="empty"><i class="bi bi-disc"></i><p>Failed to load</p></div>'
  }
}

async function _loadWiki(name) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
    )
    if (!res.ok) return
    const data = await res.json()
    if (!data.extract) return

    const section = $('artist-wiki-section')
    const img = $('artist-wiki-img')
    if (data.thumbnail?.source) {
      img.src = data.thumbnail.source
      img.style.display = 'block'
    } else img.style.display = 'none'
    $('artist-wiki-extract').textContent = data.extract
    $('artist-wiki-link').href =
      data.content_urls?.desktop?.page ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`
    section.style.display = 'block'
  } catch {}
}

function _renderTracks(tracks) {
  const el = $('artist-tracklist')
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
      <img class="art-track-thumb" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.style.display='none'" alt=""/>
      <div class="alb-track-info">
        <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ' <span class="explicit-tag">E</span>' : ''}</div>
        <div class="alb-track-artist">${escHtml(t.album || '')}</div>
      </div>
      <span class="alb-track-dur">${t.dur || ''}</span>
      <button class="alb-track-more" data-index="${i}"><i class="bi bi-three-dots"></i></button>
    </div>`
    )
    .join('')

  el.querySelectorAll('.alb-track').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.alb-track-more'))
        _playFn(_tracks[+row.dataset.index], _tracks, +row.dataset.index)
    })
  })
  el.querySelectorAll('.alb-track-more').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      _openSheet(_tracks[+btn.dataset.index])
    })
  })
}

function _renderAlbums(albums) {
  const el = $('artist-discography')
  if (!el) return
  if (!albums.length) {
    el.innerHTML =
      '<div class="empty"><i class="bi bi-disc"></i><p>No releases found</p></div>'
    return
  }
  el.innerHTML = albums
    .map(
      (al) => `
    <div class="art-album-card" data-id="${escHtml(al.id)}">
      <div class="art-album-cover-wrap">
        <img class="art-album-cover" src="${escHtml(al.coverSmall || al.cover || '')}" onerror="this.src=''" alt=""/>
        <div class="art-album-play"><i class="bi bi-play-fill"></i></div>
      </div>
      <div class="art-album-title">${escHtml(al.title)}</div>
      <div class="art-album-year">${al.year || ''}</div>
    </div>`
    )
    .join('')

  el.querySelectorAll('.art-album-card').forEach((card) => {
    card.addEventListener('click', () => {
      const album = _albums.find((a) => a.id === card.dataset.id)
      if (album && _openAlbum) _openAlbum(album)
    })
  })
}

function _openSheet(track) {
  _sheetTrack = track
  const p = $('artist-sheet-preview')
  if (p && track)
    p.innerHTML = `
    <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
    <div><div class="bs-title">${escHtml(track.title)}</div><div class="bs-artist">${escHtml(track.artist || '')}</div></div>`
  _syncSheetLike()
  $('artist-track-sheet')?.classList.add('open')
}
function _closeSheet() {
  $('artist-track-sheet')?.classList.remove('open')
  _sheetTrack = null
}
function _syncSheetLike() {
  const btn = $('artist-sheet-like')
  if (!btn || !_sheetTrack) return
  const liked = has(_sheetTrack.id)
  btn.innerHTML = `<i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i> ${liked ? 'Unlike' : 'Like'}`
}

function _skeletonTracks() {
  return Array(5)
    .fill(0)
    .map(
      (_, i) => `
    <div class="alb-track alb-track-skel">
      <span class="alb-track-num">${i + 1}</span>
      <div class="art-track-thumb skeleton"></div>
      <div class="alb-track-info">
        <div class="skeleton" style="height:13px;width:${50 + Math.random() * 35}%;border-radius:6px;margin-bottom:6px"></div>
        <div class="skeleton" style="height:11px;width:${25 + Math.random() * 20}%;border-radius:6px"></div>
      </div>
    </div>`
    )
    .join('')
}

function _skeletonAlbums() {
  return Array(6)
    .fill(0)
    .map(
      () => `
    <div class="art-album-card art-album-skel">
      <div class="art-album-cover-wrap skeleton" style="aspect-ratio:1"></div>
      <div class="skeleton" style="height:12px;width:80%;border-radius:6px;margin-top:8px"></div>
      <div class="skeleton" style="height:10px;width:40%;border-radius:6px;margin-top:5px"></div>
    </div>`
    )
    .join('')
}
