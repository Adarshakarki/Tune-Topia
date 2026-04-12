// Playlist
import { getPlaylist } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import { extractColor } from '../app/ui.js'
import { toggle, has } from '../modules/likedSongs.js'
import Queue from '../modules/queue.js'
import * as Player from '../modules/player.js'
import * as BulkDownloader from '../modules/bulkdownloader.js'
import { openTrackSheet } from '../ui/sheets.js'

const $ = (id) => document.getElementById(id)

let _collection = null, _tracks = [], _sheetTrack = null, _playFn = null;
let _sortMode = 'default' // Sorting

export function init(playTrackFn) {
  _playFn = playTrackFn

  $('pl-back-btn')?.addEventListener('click', close)
  $('pl-play-all')?.addEventListener('click', () => {
    if (_tracks.length) {
      _playFn(_tracks, 0);
      close();
    }
  })

  $('pl-shuffle-btn')?.addEventListener('click', () => {
    if (!_tracks.length) return;
    _playFn(_tracks, Math.floor(Math.random() * _tracks.length));
    Player.toggleShuffle();
    close();
  })

  $('pl-sort-label')?.addEventListener('click', () => {
    const opts = ['default', 'az', 'recent']
    const labels = { default: 'Default', az: 'A–Z', recent: 'Recent' }
    
    _sortMode = opts[(opts.indexOf(_sortMode) + 1) % opts.length]
    if ($('pl-sort-label')) $('pl-sort-label').textContent = labels[_sortMode]
    _renderTracklist(_getFilteredTracks());
  })

  $('pl-filter-input')?.addEventListener('input', () => {
    _renderTracklist(_getFilteredTracks());
  })

  $('pl-download')?.addEventListener('click', () => {
    if (_tracks.length) BulkDownloader.downloadTracks(_tracks, _collection?.title);
    else UI.toast('Wait for tracks to load...');
  })

  const _share = (url) => {
    if (navigator.share)
      navigator.share({
        title: `${_sheetTrack.title} — ${_sheetTrack.artist}`,
        url,
      })
    else navigator.clipboard.writeText(url)
    _closeSheet()
  }

  $('pl-track-sheet-overlay')?.addEventListener('click', _closeSheet)
  $('pl-sheet-play-next')?.addEventListener('click', () => { if (_sheetTrack) { Queue.addNext(_sheetTrack); _closeSheet(); } })
  $('pl-sheet-add-queue')?.addEventListener('click', () => { if (_sheetTrack) { Queue.add(_sheetTrack); _closeSheet(); } })
  $('pl-sheet-like')?.addEventListener('click', () => { if (_sheetTrack) { toggle(_sheetTrack); _syncSheetLike(); _closeSheet(); } })
  $('pl-sheet-share')?.addEventListener('click', () => {
    if (!_sheetTrack) return
    const url = _sheetTrack.source === 'youtube' ? `https://youtu.be/${_sheetTrack.id}` : `https://tidal.com/track/${_sheetTrack.id}`
    _share(url);
  })
}

export async function open(playlist) {
  // Normalize input: handle both ID strings and result objects
  _collection = typeof playlist === 'object' ? playlist : { id: playlist };
  const playlistId = _collection.id || _collection.uuid;

  _tracks = []
  const page = $('page-playlist')
  if (!page) return

  _applyColor(30, 28, 38)
  _setHeader(_collection)
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
    const result = await getPlaylist(playlistId)
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
  const dr = Math.round(r * 0.95), dg = Math.round(g * 0.95), db = Math.round(b * 0.95)
  const page = $('page-playlist')
  if (!page) return

  const dark = `rgb(${dr},${dg},${db})`
  page.style.setProperty('--pl-dark', dark)
  page.style.setProperty('--pl-accent', `rgb(${r},${g},${b})`)
  page.style.background = dark
  page.setAttribute('data-light', 0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false')
  
  const meta = document.getElementById('theme-color-meta')
  if (meta) meta.setAttribute('content', dark)
}

function _setHeader(collection) {
  if ($('pl-hero-art')) $('pl-hero-art').src = collection.cover || ''
  if ($('pl-hero-title')) $('pl-hero-title').textContent = collection.title || ''
  if ($('pl-hero-desc')) $('pl-hero-desc').textContent = collection.description || ''
  if ($('pl-topbar-title')) $('pl-topbar-title').textContent = collection.title || ''
}

function _setMeta(tracks) {
  const totalSeconds = tracks.reduce((acc, t) => {
    const p = (t.dur || '0:00').split(':').map(Number);
    if (p.length >= 3) return acc + (p[0] * 3600 + p[1] * 60 + p[2]);
    if (p.length === 2) return acc + (p[0] * 60 + p[1]);
    return acc + (p[0] || 0);
  }, 0);

  const mins = Math.floor(totalSeconds / 60)
  const parts = [`${tracks.length} songs`]
  if (mins) parts.push(`${mins} min`)
  
  const metaEl = $('pl-hero-meta')
  if (metaEl) metaEl.textContent = parts.join(' · ')
}

function _getFilteredTracks() {
  let items = [...(_tracks || [])]
  const query = $('pl-filter-input')?.value.trim().toLowerCase()

  if (query) {
    items = items.filter(t => 
      t.title?.toLowerCase().includes(query) || 
      t.artist?.toLowerCase().includes(query) ||
      t.album?.toLowerCase().includes(query)
    )
  }

  if (_sortMode === 'az') {
    items.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  } else if (_sortMode === 'recent') {
    // Assuming 'recent' means the order they were added to the playlist,
    // which is the default order from the API. If we want actual "recently added"
    // we'd need a timestamp on tracks within the playlist.
    // For simplicity, we'll just use the default order for now.
    // items.reverse(); // This would reverse the original order, which might not be "recent"
  }

  return items
}

function _renderTracklist(filteredTracks) {
  const tracks = filteredTracks || _tracks;
  const el = $('pl-tracklist')
  if (!el) return

  if (!tracks.length) {
    el.innerHTML = '<div class="empty"><i class="bi bi-music-note-beamed"></i><p>No tracks found</p></div>'
    return
  }

  el.innerHTML = tracks.map((t, i) => `
    <div class="alb-track" data-index="${i}" data-tid="${escHtml(t.id)}">
      <span class="alb-track-num">${i + 1}</span>
      <img class="art-track-thumb" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.style.display='none'" alt=""/>
      <div class="alb-track-info">
        <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ' <span class="explicit-tag">E</span>' : ''}</div>
        <div class="alb-track-artist">${escHtml(t.artist || '')}</div>
      </div>
      <span class="alb-track-dur">${t.dur || ''}</span>
      <button class="alb-track-more" data-index="${i}"><i class="bi bi-three-dots"></i></button>
    </div>`).join('')

  el.querySelectorAll('.alb-track').forEach((row) => {
    row.addEventListener('click', (e) => { if (!e.target.closest('.alb-track-more')) _playFn(_tracks, +row.dataset.index) })
  })

  el.querySelectorAll('.alb-track-more').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); _openSheet(_tracks[+btn.dataset.index]); })
  })
}

function _openTrackOptions(track) {
  openTrackSheet(track, {
    // No remove/move options for API-fetched playlists/mixes
    // These options are typically for user-editable playlists
  });
}

function _openSheet(track) {
  _sheetTrack = track
  const p = $('pl-sheet-preview')
  if (p && track) {
    p.innerHTML = `
    <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
    <div><div class="bs-title">${escHtml(track.title)}</div><div class="bs-artist">${escHtml(track.artist || '')}</div></div>`
  }
  _syncSheetLike()
  $('pl-track-sheet')?.classList.add('open')
}

const _closeSheet = () => { $('pl-track-sheet')?.classList.remove('open'); _sheetTrack = null; }

const _syncSheetLike = () => {
  const btn = $('pl-sheet-like')
  if (!btn || !_sheetTrack) return
  const liked = has(_sheetTrack.id)
  btn.innerHTML = `<i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i> ${liked ? 'Unlike' : 'Like'}`
}
const _skeleton = () => Array(10).fill(0).map((_, i) => `<div class="alb-track alb-track-skel"><span class="alb-track-num">${i + 1}</span><div class="alb-track-info"><div class="skeleton" style="height:13px;width:${50 + Math.random() * 35}%;border-radius:6px;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:${25 + Math.random() * 20}%;border-radius:6px"></div></div></div>`).join('')
