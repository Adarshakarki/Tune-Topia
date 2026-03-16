import * as Player from '../modules/player.js'

export let currentId = null

export function playTrack(tracks, index) {
  const track = tracks[index]
  if (!track) return
  // Record actual listen time for previous track before switching
  _flushCurrentTrack()
  currentId = track.id
  _trackStart = Date.now()
  _currentTrack = track
  Player.play(track, tracks, index)
  _recordPlay(track)
  refreshActiveTracks()
}

export function refreshActiveTracks() {
  document.querySelectorAll('[data-tid]').forEach((el) => {
    const isActive = el.dataset.tid === currentId
    if (
      el.classList.contains('track-card') ||
      el.classList.contains('alb-track')
    ) {
      el.classList.toggle('playing', isActive)
      el.querySelector('.alb-track-title, .track-name')?.classList.toggle(
        'playing',
        isActive
      )
    } else {
      const card = el.querySelector('.track-card')
      card?.classList.toggle('playing', isActive)
      card?.querySelector('.track-name')?.classList.toggle('playing', isActive)
    }
  })
}

export function setCurrentId(id) {
  currentId = id
}

// ── History recording ─────────────────────────────────────────────────────────

let _currentTrack = null
let _trackStart = null

// Called when a new track starts — records the entry immediately.
// Duration is updated to actual listen time when the next track starts.
function _recordPlay(track) {
  if (!track?.id) return
  try {
    const history = JSON.parse(localStorage.getItem('tt_play_history') || '[]')
    history.unshift({
      id: track.id,
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      cover: track.cover || '',
      coverSmall: track.coverSmall || '',
      duration: track.duration || '0:00',
      listenedMs: 0,
      playedAt: Date.now(),
    })
    localStorage.setItem(
      'tt_play_history',
      JSON.stringify(history.slice(0, 2000))
    )
  } catch {}
  // Notify capsule if profile page is open
  _notifyCapsule()
}

// Called before switching tracks — patches the previous entry with real listen time
function _flushCurrentTrack() {
  if (!_currentTrack || !_trackStart) return
  const listenedMs = Date.now() - _trackStart
  // Only count if listened for more than 10 seconds (skip spam)
  if (listenedMs < 10000) return
  try {
    const history = JSON.parse(localStorage.getItem('tt_play_history') || '[]')
    const entry = history.find(
      (e) => e.id === _currentTrack.id && e.listenedMs === 0
    )
    if (entry) {
      entry.listenedMs = listenedMs
      // Convert to mm:ss for compatibility
      const secs = Math.floor(listenedMs / 1000)
      entry.duration = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
      localStorage.setItem('tt_play_history', JSON.stringify(history))
    }
  } catch {}
}

// Live update capsule charts if profile page is currently visible
function _notifyCapsule() {
  if (document.getElementById('page-account')?.classList.contains('active')) {
    import('./router.js').then((R) => {
      import('../pages/capsule.js').then((C) => C.render())
    })
  }
}
