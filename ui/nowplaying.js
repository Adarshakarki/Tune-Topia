// ui/nowplaying.js — now playing panel + mini player (bar) event bindings

import * as Player from '../modules/player.js'
import * as UI from '../app/ui.js'
import * as PlaylistsUI from '../pages/playlists-ui.js'
import { onLike } from '../app/likes.js'

const $ = (id) => document.getElementById(id)

function _seekFrom(barId, e) {
  const r = $(barId)?.getBoundingClientRect()
  if (!r) return
  Player.seek(
    Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
  )
}

function _volFrom(barId, e) {
  const r = $(barId)?.getBoundingClientRect()
  if (!r) return
  Player.setVolume(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
}

function _scrollToActiveQueueItem() {
  requestAnimationFrame(() =>
    $('np-queue-list')
      ?.querySelector('.npq-item.active')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  )
}

export function init() {
  // ── Mini player / bar ─────────────────────────────────────
  // Tap track info (mobile) or art (desktop) to open NP
  $('bar-track')?.addEventListener('click', () => {
    if (!window.matchMedia('(min-width: 900px)').matches) UI.openPlayer()
  })
  $('bar-art')?.addEventListener('click', () => {
    if (window.matchMedia('(min-width: 900px)').matches) UI.openPlayer()
  })

  $('bar-like-btn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    onLike(Player.getCurrentTrack())
  })
  $('mini-prev-btn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    Player.prev()
  })
  $('mini-play-btn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    Player.toggle()
  })
  $('mini-next-btn')?.addEventListener('click', (e) => {
    e.stopPropagation()
    Player.next()
  })

  // Desktop bar controls
  $('bar-prev-btn')?.addEventListener('click', Player.prev)
  $('bar-play-btn')?.addEventListener('click', Player.toggle)
  $('bar-next-btn')?.addEventListener('click', Player.next)
  $('bar-shuffle-btn')?.addEventListener('click', Player.toggleShuffle)
  $('bar-repeat-btn')?.addEventListener('click', Player.toggleRepeat)

  $('bar-lyrics-btn')?.addEventListener('click', () => {
    UI.openPlayer()
    UI.openPanel('np-lyrics-panel')
  })
  $('bar-add-playlist-btn')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (t) PlaylistsUI.openPicker(t)
  })
  $('bar-more-btn')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (t) UI.openMoreSheet(t)
  })
  $('bar-queue-btn')?.addEventListener('click', () => {
    UI.openPlayer()
    UI.openPanel('np-queue-panel')
    _scrollToActiveQueueItem()
  })

  // Bar seek / volume
  $('bar-progress-bar')?.addEventListener('click', (e) =>
    _seekFrom('bar-progress-bar', e)
  )
  $('bar-vol-bar')?.addEventListener('click', (e) => _volFrom('bar-vol-bar', e))

  // ── Now playing panel ─────────────────────────────────────
  $('np-close-btn')?.addEventListener('click', () => {
    const open = document.querySelector('.np-overlay.open')
    if (open) UI.closePanel(open.id)
    else UI.closePlayer()
  })

  $('np-play-btn')?.addEventListener('click', Player.toggle)
  $('np-prev-btn')?.addEventListener('click', Player.prev)
  $('np-next-btn')?.addEventListener('click', Player.next)
  $('np-love-btn')?.addEventListener('click', () =>
    onLike(Player.getCurrentTrack())
  )
  $('np-more-btn')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (t) UI.openMoreSheet(t)
  })
  $('np-np-more-btn')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack()
    if (t) UI.openMoreSheet(t)
  })

  $('np-progress-bar')?.addEventListener('click', (e) =>
    _seekFrom('np-progress-bar', e)
  )
  $('vol-bar')?.addEventListener('click', (e) => _volFrom('vol-bar', e))

  // NP panel — lyrics
  $('np-lyrics-btn')?.addEventListener('click', () =>
    UI.openPanel('np-lyrics-panel')
  )
  $('np-lyrics-play')?.addEventListener('click', Player.toggle)
  $('np-lyrics-prev')?.addEventListener('click', Player.prev)
  $('np-lyrics-next')?.addEventListener('click', Player.next)

  // NP panel — queue
  $('np-queue-toggle-btn')?.addEventListener('click', () => {
    UI.openPanel('np-queue-panel')
    _scrollToActiveQueueItem()
  })

  // Mini seek bars inside lyrics + queue overlays
  ;['np-lyrics-mini-bar', 'np-queue-mini-bar'].forEach((id) => {
    $(id)?.addEventListener('click', (e) => _seekFrom(id, e))
  })
}

// Move the more sheet in/out of #now-playing depending on viewport
export function syncMoreSheetPosition() {
  const sheet = $('np-more-sheet')
  const nowPlaying = $('now-playing')
  if (!sheet) return
  if (window.innerWidth >= 900) {
    if (sheet.parentNode !== document.body) document.body.appendChild(sheet)
  } else {
    if (sheet.parentNode !== nowPlaying) nowPlaying.appendChild(sheet)
  }
}
