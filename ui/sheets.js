// ui/sheets.js — bottom sheets and popup event wiring

import * as UI from '../app/ui.js'
import * as Player from '../modules/player.js'
import Queue from '../modules/queue.js'
import State from '../app/state.js'
import { escHtml } from '../api/utils.js'
import { openPicker } from '../pages/playlists-ui.js'
import { onLike } from '../app/likes.js'
import { has as isLiked } from '../modules/likedSongs.js'
import { downloadTrack } from '../modules/downloader.js'

const $ = (id) => document.getElementById(id)

let _sleepTimerId = null
let _queueSheetIndex = -1

// ── TRACK OPTIONS SHEET ───────────────────────────────────
let _tsTrack = null
let _tsOpts = {}

export function openTrackSheet(track, opts = {}) {
  _tsTrack = track
  _tsOpts = opts

  const preview = $('track-sheet-preview')
  if (preview)
    preview.innerHTML = `
    <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
    <div>
      <div class="bs-title">${escHtml(track.title)}</div>
      <div class="bs-artist">${escHtml(track.artist || '')}</div>
    </div>`

  const liked = isLiked(track.id)
  const likeBtn = $('tsheet-like')
  const likeLabel = $('tsheet-like-label')
  if (likeBtn) likeBtn.classList.toggle('liked', liked)
  if (likeLabel) likeLabel.textContent = liked ? 'Unlike' : 'Like'
  const likeIcon = likeBtn?.querySelector('i')
  if (likeIcon)
    likeIcon.className = `bi ${liked ? 'bi-heart-fill' : 'bi-heart'}`

  const show = (id, visible) => {
    const el = $(id)
    if (el) el.style.display = visible ? '' : 'none'
  }
  show('tsheet-add-playlist', !opts.onRemove)
  show('tsheet-move-up', !!opts.onMoveUp)
  show('tsheet-move-down', !!opts.onMoveDown)
  show('tsheet-remove', !!opts.onRemove)

  // - hide go-to buttons for youtube tracks that have no album -
  show('tsheet-go-album', !!(track.album || track.albumId))

  $('track-options-sheet')?.classList.add('open')
}

function _closeTrackSheet() {
  $('track-options-sheet')?.classList.remove('open')
  _tsTrack = null
  _tsOpts = {}
}

// ── SLEEP ─────────────────────────────────────────────────
function _openSleepSheet() {
  $('sleep-timer-popup')?.classList.add('open')
  UI.closeMoreSheet()
}
function _closeSleepSheet() {
  $('sleep-timer-popup')?.classList.remove('open')
}

function _cancelSleepTimer() {
  if (_sleepTimerId) {
    clearTimeout(_sleepTimerId)
    _sleepTimerId = null
  }
  Player.setSleepAfterTrack(false)
  document
    .querySelectorAll('.sleep-timer-opt')
    .forEach((b) => b.classList.remove('active'))
  const status = $('sleep-timer-status'),
    cancel = $('sleep-timer-cancel-btn')
  if (status) status.style.display = 'none'
  if (cancel) cancel.style.display = 'none'
  UI.toast('Sleep timer cancelled')
}

function _setSleepTimer(mins) {
  if (_sleepTimerId) clearTimeout(_sleepTimerId)
  Player.setSleepAfterTrack(false)
  const ms = mins * 60 * 1000
  _sleepTimerId = setTimeout(() => {
    Player.toggle()
    _sleepTimerId = null
    UI.toast('Sleep timer: playback stopped')
  }, ms)
  const endTime = new Date(Date.now() + ms)
  const hhmm = endTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  const status = $('sleep-timer-status'),
    cancel = $('sleep-timer-cancel-btn')
  if (status) {
    status.textContent = `Pausing at ${hhmm} (${mins} min)`
    status.style.display = ''
  }
  if (cancel) cancel.style.display = ''
  document
    .querySelectorAll('.sleep-timer-opt')
    .forEach((b) => b.classList.remove('active'))
  UI.toast(`Sleep timer set for ${mins} min`)
  _closeSleepSheet()
}

// ── QUEUE SHEET ───────────────────────────────────────────
function _closeQueueSheet() {
  $('np-queue-item-sheet')?.classList.remove('open')
  _queueSheetIndex = -1
}

function _refreshQueue() {
  UI.renderQueue(
    State.get('queue.tracks') || [],
    State.get('player.queuePosition') || 0
  )
}

// ── INIT ──────────────────────────────────────────────────
export function initEvents() {
  // - global track-more-btn delegation -
  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target.closest('.track-more-btn')
      if (!btn) return
      e.stopPropagation()
      const wrap = btn.closest('[data-index]')
      const container = wrap?.parentElement
      const idx = parseInt(wrap?.dataset.index)
      const track = container?._tracks?.[idx]
      if (track) openTrackSheet(track)
    },
    true
  )

  // - track sheet actions -
  $('track-sheet-overlay')?.addEventListener('click', _closeTrackSheet)

  $('tsheet-like')?.addEventListener('click', () => {
    if (!_tsTrack) return
    onLike(_tsTrack)
    const liked = isLiked(_tsTrack.id)
    const likeBtn = $('tsheet-like')
    const likeLabel = $('tsheet-like-label')
    if (likeBtn) likeBtn.classList.toggle('liked', liked)
    if (likeLabel) likeLabel.textContent = liked ? 'Unlike' : 'Like'
    const likeIcon = likeBtn?.querySelector('i')
    if (likeIcon)
      likeIcon.className = `bi ${liked ? 'bi-heart-fill' : 'bi-heart'}`
  })

  $('tsheet-add-queue')?.addEventListener('click', () => {
    if (!_tsTrack) return
    Queue.addNext(_tsTrack)
    UI.toast('Added to queue')
    _closeTrackSheet()
  })

  $('tsheet-add-playlist')?.addEventListener('click', () => {
    if (!_tsTrack) return
    _closeTrackSheet()
    setTimeout(() => openPicker(_tsTrack), 300)
  })

  $('tsheet-go-artist')?.addEventListener('click', () => {
    if (!_tsTrack) return
    const track = _tsTrack
    _closeTrackSheet()
    import('../pages/artist.js')
      .then((m) => {
        const page = document.getElementById('page-artist')
        if (page) page.classList.add('stacked')
        if (track.artistId) {
          m.open({ id: track.artistId, name: track.artist, cover: track.cover })
        } else {
          m.open({
            id: '',
            name: track.artist?.split(',')[0].trim(),
            cover: track.cover,
          })
        }
      })
      .catch(() => UI.toast('Could not open artist'))
  })

  $('tsheet-go-album')?.addEventListener('click', () => {
    if (!_tsTrack) return
    const track = _tsTrack
    _closeTrackSheet()
    import('../pages/album.js')
      .then((m) => {
        if (!track.albumId) {
          UI.toast('Album info not available for this track')
          return
        }
        const page = document.getElementById('page-album')
        if (page) page.classList.add('stacked')
        m.open({
          id: track.albumId,
          title: track.album,
          cover: track.cover,
          artist: track.artist,
        })
      })
      .catch(() => UI.toast('Could not open album'))
  })

  $('tsheet-download')?.addEventListener('click', async () => {
    if (!_tsTrack) return
    const track = _tsTrack
    _closeTrackSheet()
    UI.toast('Preparing download…')
    try {
      const { getStream, getAudioStream } = await import('../api/index.js')
      const stream =
        track.source === 'youtube'
          ? await getAudioStream(track.id)
          : await getStream(track.id)
      await downloadTrack(track, stream)
    } catch (e) {
      UI.toast(e.message || 'Download failed')
    }
  })

  $('tsheet-move-up')?.addEventListener('click', () => {
    _tsOpts.onMoveUp?.()
    _closeTrackSheet()
  })
  $('tsheet-move-down')?.addEventListener('click', () => {
    _tsOpts.onMoveDown?.()
    _closeTrackSheet()
  })
  $('tsheet-remove')?.addEventListener('click', () => {
    _tsOpts.onRemove?.()
    _closeTrackSheet()
  })

  // - sleep timer -
  $('sheet-sleep-timer')?.addEventListener('click', _openSleepSheet)
  $('sleep-timer-sheet-overlay')?.addEventListener('click', _closeSleepSheet)
  $('sleep-timer-cancel-btn')?.addEventListener('click', () => {
    _cancelSleepTimer()
    _closeSleepSheet()
  })

  document.querySelectorAll('.sleep-timer-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.sleep-timer-opt')
        .forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      if (btn.dataset.mins === 'eot') {
        if (_sleepTimerId) {
          clearTimeout(_sleepTimerId)
          _sleepTimerId = null
        }
        Player.setSleepAfterTrack(true)
        const status = $('sleep-timer-status'),
          cancel = $('sleep-timer-cancel-btn')
        if (status) {
          status.textContent = 'Pausing after current track'
          status.style.display = ''
        }
        if (cancel) cancel.style.display = ''
        UI.toast('Sleep timer: will stop after this track')
        _closeSleepSheet()
      } else {
        _setSleepTimer(parseInt(btn.dataset.mins))
      }
    })
  })

  // - more sheet -
  $('np-more-sheet-overlay')?.addEventListener('click', UI.closeMoreSheet)
  $('sheet-shuffle')?.addEventListener('click', () => {
    Player.toggleShuffle()
    UI.closeMoreSheet()
  })
  $('sheet-repeat')?.addEventListener('click', () => {
    Player.toggleRepeat()
    UI.closeMoreSheet()
  })
  $('sheet-add-queue')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (t) {
      Queue.addNext(t)
      UI.toast('Added to queue')
      UI.closeMoreSheet()
    }
  })
  $('sheet-share')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (!t) return
    const url =
      t.source === 'youtube'
        ? `https://youtu.be/${t.id}`
        : `https://tidal.com/track/${t.id}`
    if (navigator.share)
      navigator.share({ title: `${t.title} — ${t.artist}`, url })
    else navigator.clipboard.writeText(url).then(() => UI.toast('Link copied'))
    UI.closeMoreSheet()
  })
  $('sheet-open-source')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (!t) return
    window.open(
      t.source === 'youtube'
        ? `https://youtu.be/${t.id}`
        : `https://tidal.com/track/${t.id}`,
      '_blank'
    )
    UI.closeMoreSheet()
  })
  $('sheet-download')?.addEventListener('click', async () => {
    const t = Player.getCurrentTrack()
    if (!t) return
    UI.closeMoreSheet()
    UI.toast('Preparing download…')
    try {
      const { getStream, getAudioStream } = await import('../api/index.js')
      const { downloadTrack } = await import('../modules/downloader.js')
      const stream =
        t.source === 'youtube'
          ? await getAudioStream(t.id)
          : await getStream(t.id)
      await downloadTrack(t, stream)
    } catch (e) {
      UI.toast(e.message || 'Download failed')
    }
  })
  $('sheet-add-playlist')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (!t) return
    UI.closeMoreSheet()
    setTimeout(() => openPicker(t), 300)
  })

  // - queue item sheet -
  $('np-queue-item-sheet-overlay')?.addEventListener('click', _closeQueueSheet)

  $('np-queue-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('.npq-item')
    if (!item) return
    const index = parseInt(item.dataset.index)
    const tracks = State.get('queue.tracks') || []
    const track = tracks[index]
    if (!track) return
    _queueSheetIndex = index

    const preview = $('np-queue-item-preview')
    if (preview)
      preview.innerHTML = `
      <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
      <div>
        <div class="bs-title">${escHtml(track.title)}</div>
        <div class="bs-artist">${escHtml(track.artist || '')}</div>
      </div>`

    const pos = State.get('player.queuePosition') || 0
    const isActive = index === pos
    $('qsheet-move-up').style.display = index <= pos + 1 ? 'none' : ''
    $('qsheet-move-down').style.display =
      index >= tracks.length - 1 ? 'none' : ''
    $('qsheet-play-now').style.display = isActive ? 'none' : ''
    $('qsheet-remove').style.display = isActive ? 'none' : ''
    $('np-queue-item-sheet')?.classList.add('open')
  })

  $('qsheet-play-now')?.addEventListener('click', () => {
    if (_queueSheetIndex < 0) return
    Player.playFromQueue(_queueSheetIndex)
    _closeQueueSheet()
  })
  $('qsheet-move-up')?.addEventListener('click', () => {
    if (_queueSheetIndex < 0) return
    const pos = State.get('player.queuePosition') || 0
    if (_queueSheetIndex <= pos + 1) {
      UI.toast('Already at the top')
      _closeQueueSheet()
      return
    }
    Queue.reorder(_queueSheetIndex, _queueSheetIndex - 1)
    _closeQueueSheet()
    _refreshQueue()
  })
  $('qsheet-move-down')?.addEventListener('click', () => {
    if (_queueSheetIndex < 0) return
    const tracks = State.get('queue.tracks') || []
    if (_queueSheetIndex >= tracks.length - 1) {
      UI.toast('Already at the bottom')
      _closeQueueSheet()
      return
    }
    Queue.reorder(_queueSheetIndex, _queueSheetIndex + 1)
    _closeQueueSheet()
    _refreshQueue()
  })
  $('qsheet-remove')?.addEventListener('click', () => {
    if (_queueSheetIndex < 0) return
    Queue.remove(_queueSheetIndex)
    _closeQueueSheet()
    _refreshQueue()
  })

  $('np-queue-clear-btn')?.addEventListener('click', () => {
    Queue.clear()
    _refreshQueue()
    UI.toast('Queue cleared')
  })
}
