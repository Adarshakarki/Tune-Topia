import * as Player from '../modules/player.js'
import * as UI from './ui.js'
import State from './state.js'
import Queue from '../modules/queue.js'
import { setCurrentId, refreshActiveTracks } from './playback.js'

let _amEl = null
let _cleanup = null

// Dynamically load the Apple Music Lyrics Web Component
import('@uimaxbai/am-lyrics/am-lyrics.js').catch(() => {
  const s = document.createElement('script')
  s.type = 'module'
  s.src = 'https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics/dist/src/am-lyrics.min.js'
  document.head.appendChild(s)
})

/**
 * 1. Main Binding Function
 */
export function bind() {
  Player.on('trackChanged', (track) => {
    UI.setTrackInfo(track)
    setCurrentId(track.id)
    refreshActiveTracks()
    _loadLyrics(track)
    UI.renderQueue(
      State.get('queue.tracks') || [],
      State.get('player.queuePosition') || 0
    )
  })

  Player.on('sleepTimerFired', () => UI.toast('Sleep timer: playback stopped'))
  Player.on('playStateChanged', UI.setPlayState)

  Player.on('progress', ({ pct, current, duration }) => {
    UI.updateProgress(pct, current, duration)
  })

  Player.on('shuffleChanged', UI.setShuffle)
  Player.on('repeatChanged', UI.setRepeat)
  Player.on('volumeChanged', UI.updateVolume)
  Player.on('queueUpdated', ({ tracks, position }) =>
    UI.renderQueue(tracks, position, Queue.getUpcoming())
  )
  Player.on('error', (msg) => UI.toast(msg))

  _bindKeyboard()
}

/**
 * 2. Metadata Cleaning (Fixes "Source: Unavailable")
 * Strips "Remastered", "Live", and featured artists that break API searches.
 */
function _cleanMetadata(text) {
  if (typeof text !== 'string') return ''
  return text
    .split(/[-(\[](?:remaster|remix|mix|live|deluxe|edition|version|from|feat|ft)/i)[0]
    .trim()
}

function _primaryArtist(track) {
  const raw = Array.isArray(track.artists)
    ? (track.artists[0]?.name ?? track.artists[0] ?? '')
    : (track.artist?.name ?? track.artist ?? '')
  return _cleanMetadata(raw)
}

function _getLyricsHighlightColor() {
  const isLight = getComputedStyle(document.documentElement).colorScheme === 'light'
  return isLight ? '#000' : '#fff'
}

/**
 * 3. Keyboard Controller (Fixes ReferenceError)
 */
function _bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return

    switch (e.code) {
      case 'Space':      e.preventDefault(); Player.toggle(); break
      case 'ArrowRight': e.preventDefault(); e.shiftKey || e.metaKey ? Player.next() : Player.seekSeconds(10); break
      case 'ArrowLeft':  e.preventDefault(); e.shiftKey || e.metaKey ? Player.prev() : Player.seekSeconds(-10); break
      case 'ArrowUp':    e.preventDefault(); Player.setVolume(Math.min(1, (State.get('player.volume') ?? 0.8) + 0.1)); break
      case 'ArrowDown':  e.preventDefault(); Player.setVolume(Math.max(0, (State.get('player.volume') ?? 0.8) - 0.1)); break
      case 'KeyM': Player.toggleMute(); break
      case 'KeyN': Player.next(); break
      case 'KeyP': Player.prev(); break
      case 'KeyS': Player.toggleShuffle(); break
      case 'KeyR': Player.toggleRepeat(); break
    }
  })
}

/**
 * 4. Component Creation (Singleton)
 */
function _getOrCreateAmLyrics() {
  const body = document.getElementById('np-lyrics-body')
  if (!body) return null

  if (!_amEl) {
    _amEl = document.createElement('am-lyrics')
    _amEl.setAttribute('autoscroll', '')
    _amEl.setAttribute('interpolate', '')
    _amEl.style.cssText = 'display:block;width:100%;height:100%'

    _amEl.addEventListener('line-click', (e) => {
      if (e.detail?.timestamp !== undefined) {
        Player.seekTo(e.detail.timestamp / 1000)
        Player.play()
      }
    })
  }

  if (!body.contains(_amEl)) {
    body.innerHTML = ''
    body.appendChild(_amEl)
  }

  return _amEl
}

/**
 * 5. Main Logic: Loading & Syncing
 */
async function _loadLyrics(track) {
  // Teardown previous song's logic
  if (_cleanup) {
    _cleanup()
    _cleanup = null
  }

  const el = _getOrCreateAmLyrics()
  if (!el) return

  await customElements.whenDefined('am-lyrics')

  const cleanTitle = _cleanMetadata(track.title ?? '')
  const cleanArtist = _primaryArtist(track)
  
  // LRCLIB Fix: Convert duration to seconds
  const durationMs = track.duration ?? 0
  const durationSec = durationMs > 5000 ? Math.round(durationMs / 1000) : Math.round(durationMs)

  // Update Component
  el.innerHTML = '' // Clear error states
  el.setAttribute('song-title', cleanTitle)
  el.setAttribute('song-artist', cleanArtist)
  el.setAttribute('highlight-color', _getLyricsHighlightColor())
  
  if (track.album) el.setAttribute('song-album', _cleanMetadata(track.album))
  if (durationSec > 0) el.setAttribute('song-duration', String(durationSec))
  if (track.isrc) el.setAttribute('isrc', track.isrc)
  el.setAttribute('query', `${cleanTitle} ${cleanArtist}`.trim())

  // High-Precision Sync Loop
  const audio = document.querySelector('audio')
  if (!audio) return

  let frameId = null
  let lastTimestamp = performance.now()
  let baseTimeMs = audio.currentTime * 1000

  const tick = () => {
    if (!audio.paused) {
      const now = performance.now()
      const elapsed = now - lastTimestamp
      el.currentTime = baseTimeMs + elapsed
      frameId = requestAnimationFrame(tick)
    }
  }

  const syncPosition = () => {
    baseTimeMs = audio.currentTime * 1000
    lastTimestamp = performance.now()
    el.currentTime = baseTimeMs
  }

  const onPlay = () => {
    syncPosition()
    if (!frameId) tick()
  }

  const onPause = () => {
    if (frameId) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  audio.addEventListener('timeupdate', syncPosition)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)
  audio.addEventListener('seeked', syncPosition)

  if (!audio.paused) tick()

  // Theme Syncing
  const themeObserver = new MutationObserver(() => {
    el.setAttribute('highlight-color', _getLyricsHighlightColor())
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style', 'class'],
  })

  // Cleanup for next track change
  _cleanup = () => {
    onPause()
    audio.removeEventListener('timeupdate', syncPosition)
    audio.removeEventListener('play', onPlay)
    audio.removeEventListener('pause', onPause)
    audio.removeEventListener('seeked', syncPosition)
    themeObserver.disconnect()
  }
}