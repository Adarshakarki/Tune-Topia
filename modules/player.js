//modules/player.js
import State from '../app/state.js'
import Queue from './queue.js'
import History from './history.js'
import {
  getStream as tidalStream,
  getTrackRecommendations,
} from '../api/index.js'
import { getAudioStream as ytStream, searchVideos } from '../api/index.js'

//audio-elements
const audioA = document.getElementById('audio')
const audioB = new Audio()
audioB.preload = 'auto'

let _active = audioA
let _inactive = audioB
let _dash = null
let _preloaded = null
let _preloading = false
let _swapping = false
let _sleepAfterTrack = false
let _handlersRegistered = false
let _switching = false

const _preloadLead = 20
const _listeners = {}
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

//events
export function on(event, cb) {
  if (!_listeners[event]) _listeners[event] = []
  _listeners[event].push(cb)
  return () => {
    _listeners[event] = _listeners[event].filter((fn) => fn !== cb)
  }
}
function _emit(event, data) {
  ;(_listeners[event] || []).forEach((cb) => cb(data))
}

//mediasession-metadata
function _updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || '',
    artist: track.artist || '',
    album: track.album || '',
    artwork: track.cover
      ? [
          {
            src: track.coverSmall || track.cover,
            sizes: '96x96',
            type: 'image/jpeg',
          },
          { src: track.cover, sizes: '192x192', type: 'image/jpeg' },
          { src: track.cover, sizes: '512x512', type: 'image/jpeg' },
        ]
      : [],
  })

  navigator.mediaSession.playbackState = State.get('player.isPlaying')
    ? 'playing'
    : 'paused'

  const _setPosition = () => {
    if (!_active.duration || !isFinite(_active.duration)) return
    try {
      //ios: omit duration to force next/prev buttons
      const posState = isIOS
        ? {
            playbackRate: _active.playbackRate || 1,
            position: _active.currentTime,
          }
        : {
            duration: _active.duration,
            playbackRate: _active.playbackRate || 1,
            position: Math.min(_active.currentTime, _active.duration),
          }
      navigator.mediaSession.setPositionState(posState)
    } catch {}
  }

  const _onLoaded = () => {
    _setPosition()
    _active.removeEventListener('loadedmetadata', _onLoaded)
    _active.removeEventListener('playing', _onPlaying)
  }
  const _onPlaying = () => {
    _setPosition()
    _active.removeEventListener('loadedmetadata', _onLoaded)
    _active.removeEventListener('playing', _onPlaying)
  }

  _active.addEventListener('loadedmetadata', _onLoaded, { once: true })
  _active.addEventListener('playing', _onPlaying, { once: true })

  if (_active.readyState >= 1) _setPosition()
}

//mediasession-state
function _syncMediaSessionState(isPlaying) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
}

//mediasession-handlers
function _ensureMediaSessionHandlers() {
  if (!('mediaSession' in navigator) || _handlersRegistered) return
  _handlersRegistered = true

  //ios: disable seek to enforce next/prev
  try {
    navigator.mediaSession.setActionHandler('seekbackward', null)
  } catch {}
  try {
    navigator.mediaSession.setActionHandler('seekforward', null)
  } catch {}

  const handlers = {
    previoustrack: () => prev(),
    nexttrack: () => next(),
    play: () => {
      _active.play()
      _syncMediaSessionState(true)
    },
    pause: () => {
      _active.pause()
      _syncMediaSessionState(false)
    },
    seekto: (e) => {
      if (e.seekTime != null && _active.duration && !isIOS) {
        _active.currentTime = e.seekTime
        _updatePositionState()
      }
    },
  }

  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {}
  })
}

//mediasession-position
function _updatePositionState() {
  if (!('mediaSession' in navigator)) return
  if (!_active?.duration || !isFinite(_active.duration)) return
  try {
    const posState = isIOS
      ? {
          playbackRate: _active.playbackRate || 1,
          position: _active.currentTime,
        }
      : {
          duration: _active.duration,
          playbackRate: _active.playbackRate || 1,
          position: Math.min(_active.currentTime, _active.duration),
        }
    navigator.mediaSession.setPositionState(posState)
  } catch {}
}

//audio-binding
function _bindAudio(el) {
  el.addEventListener('play', () => {
    if (el !== _active) return
    State.set('player.isPlaying', true)
    _emit('playStateChanged', true)
    _syncMediaSessionState(true)
  })
  el.addEventListener('pause', () => {
    if (el !== _active || _switching) return
    State.set('player.isPlaying', false)
    _emit('playStateChanged', false)
    _syncMediaSessionState(false)
  })
  el.addEventListener('ended', () => {
    if (el !== _active) return
    _onEnded()
  })
  el.addEventListener('error', () => {
    if (el !== _active) return
    if (!el.src || el.src === window.location.href) return
    _emit('error', 'Playback error')
    next()
  })
  el.addEventListener('timeupdate', () => {
    if (el !== _active || !el.duration) return
    const remaining = el.duration - el.currentTime
    _emit('progress', {
      pct: (el.currentTime / el.duration) * 100,
      current: el.currentTime,
      duration: el.duration,
    })
    if (!_preloading && !_preloaded && remaining <= _preloadLead) {
      if (localStorage.getItem('tt_gapless') !== 'false') _preloadNext()
    }
  })
}

_bindAudio(audioA)
_bindAudio(audioB)

//queue-ended
function _onEnded() {
  if (_sleepAfterTrack) {
    _sleepAfterTrack = false
    _emit('playStateChanged', false)
    _emit('sleepTimerFired', null)
    return
  }
  if (State.get('player.isRepeat')) {
    _active.currentTime = 0
    _active.play()
    return
  }
  if (_preloaded && !_swapping) {
    _swapToPreloaded()
    return
  }
  if (_swapping) return
  const hasNext = Queue.getNext()
  if (hasNext) {
    next()
    return
  }
  const current = State.get('player.currentTrack')
  if (!current) return
  getTrackRecommendations(current.id).then((recs) => {
    if (!recs.length) return
    recs.forEach((r) => Queue.add(r))
    next()
  })
}

//preload
async function _preloadNext() {
  const nextTrack = Queue.getUpcoming()[0]
  if (!nextTrack) return
  _preloading = true
  try {
    const stream = await _getStream(nextTrack)
    if (stream.type === 'dash') {
      _preloading = false
      return
    }
    _inactive.src = stream.url
    _inactive.volume = 0
    _inactive.load()
    _preloaded = { track: nextTrack }
  } catch {}
  _preloading = false
}

//gapless-swap
function _swapToPreloaded() {
  if (_swapping) return
  _swapping = true
  const track = _preloaded.track

  _inactive.volume = 1
  _inactive.play().catch(() => {})
  _ensureMediaSessionHandlers()

  _active.pause()
  _active.src = ''
  _active.volume = 1
  ;[_active, _inactive] = [_inactive, _active]

  Queue.advance(1)
  State.set('player.currentTrack', track)
  _emit('trackChanged', track)
  _emit('queueUpdated', {
    tracks: State.get('queue.tracks'),
    position: State.get('player.queuePosition'),
  })
  History.push(track)
  _updateMediaSession(track)

  _preloaded = null
  _preloading = false
  _swapping = false
  _preloadNext()
}

//dash-support
async function _loadDashJs() {
  return new Promise((res, rej) => {
    if (window.dashjs) {
      res()
      return
    }
    const s = document.createElement('script')
    s.src =
      'https://cdnjs.cloudflare.com/ajax/libs/dashjs/4.7.4/dash.all.min.js'
    s.onload = res
    s.onerror = rej
    document.head.appendChild(s)
  })
}

async function _playDash(manifestXml) {
  await _loadDashJs()
  if (_dash) {
    try {
      _dash.destroy()
    } catch {}
  }
  _dash = dashjs.MediaPlayer().create()
  const blob = new Blob([manifestXml], { type: 'application/dash+xml' })
  _dash.initialize(_active, URL.createObjectURL(blob), true)
  _dash.updateSettings({
    streaming: { abr: { autoSwitchBitrate: { audio: false } } },
  })
}

//stream-resolver
async function _getStream(track) {
  if (track.source === 'youtube') return ytStream(track.id)
  try {
    return await tidalStream(track.id)
  } catch {}
  const yt = await searchVideos(`${track.title} ${track.artist} audio`)
  if (yt.length) return ytStream(yt[0].id)
  throw new Error('Stream unavailable')
}

//public-play
export async function play(track, tracks, startIndex) {
  if (tracks) Queue.load(tracks, startIndex ?? 0)

  _switching = true
  _pauseVideo()
  _preloaded = null
  _preloading = false
  _swapping = false

  audioA.pause()
  audioA.volume = 1
  audioA.src = ''
  audioB.pause()
  audioB.volume = 1
  audioB.src = ''
  _active = audioA
  _inactive = audioB
  _switching = false 
  
  if (_dash) {
    try {
      _dash.destroy()
    } catch {}
    _dash = null
  }

  State.set('player.currentTrack', track)
  _emit('trackChanged', track)

  try {
    const stream = await _getStream(track)
    if (stream.type === 'dash') {
      await _playDash(stream.manifest)
    } else {
      _active.src = stream.url
      await _active.play()
      _ensureMediaSessionHandlers() //ios: register after user gesture
    }
    History.push(track)
    _emit('queueUpdated', {
      tracks: State.get('queue.tracks'),
      position: State.get('player.queuePosition'),
    })
    _updateMediaSession(track)
  } catch (e) {
    _emit('error', e.message || 'Playback error')
  }
}

//public-controls
export async function toggle() {
  if (!_active.src && !_dash) return
  State.get('player.isPlaying') ? _active.pause() : await _active.play()
}

export async function next() {
  const track = Queue.advance(1)
  if (track) await play(track)
}

export async function prev() {
  if (_active.currentTime > 3) {
    _active.currentTime = 0
    return
  }
  const track = Queue.advance(-1)
  if (track) await play(track)
}

export async function playFromQueue(index) {
  const tracks = State.get('queue.tracks')
  if (!tracks[index]) return
  State.set('player.queuePosition', index)
  await play(tracks[index])
}

export function seek(pct) {
  if (_active.duration) _active.currentTime = (pct / 100) * _active.duration
}

export function seekSeconds(delta) {
  if (!_active.duration) return
  _active.currentTime = Math.max(
    0,
    Math.min(_active.duration, _active.currentTime + delta)
  )
}

export function getCurrentTime() {
  return _active.currentTime
}
export function getDuration() {
  return _active.duration || 0
}

export function setVolume(v) {
  const vol = Math.max(0, Math.min(1, v))
  _active.volume = vol
  State.set('player.volume', vol)
  localStorage.setItem('tt_vol', vol)
  _emit('volumeChanged', vol)
}

let _muted = false
let _volBeforeMute = 1
export function toggleMute() {
  if (_muted) {
    setVolume(_volBeforeMute)
    _muted = false
  } else {
    _volBeforeMute = _active.volume || State.get('player.volume') || 0.8
    _active.volume = 0
    _muted = true
    _emit('volumeChanged', 0)
  }
}

export function toggleShuffle() {
  const val = !State.get('player.isShuffle')
  State.set('player.isShuffle', val)
  val ? Queue.onShuffleEnabled() : Queue.onShuffleDisabled()
  _emit('shuffleChanged', val)
}

export function toggleRepeat() {
  const val = !State.get('player.isRepeat')
  State.set('player.isRepeat', val)
  _active.loop = val
  _emit('repeatChanged', val)
}

export function getCurrentTrack() {
  return State.get('player.currentTrack')
}

export function setSleepAfterTrack(val) {
  _sleepAfterTrack = val
}

//video-pause
function _pauseVideo() {
  const vp = document.getElementById('vp-video')
  if (vp && !vp.paused) vp.pause()
}

//nowplaying-ui
const _npPanel = document.getElementById('now-playing')

export function openNowPlaying() {
  _npPanel?.classList.add('open')
  _emit('panelOpened', null)
}

export function closeNowPlaying() {
  _npPanel?.classList.remove('open')
  _emit('panelClosed', null)
}

document.addEventListener('DOMContentLoaded', () => {
  const $el = (id) => document.getElementById(id)

  $el('player-bar')?.addEventListener('click', (e) => {
    if (
      !e.target.closest('#bar-like-btn') &&
      !e.target.closest('.bar-ctrl') &&
      !e.target.closest('.bar-play-btn')
    )
      openNowPlaying()
  })

  $el('np-down-btn')?.addEventListener('click', closeNowPlaying)

  $el('np-more-btn')?.addEventListener('click', () => {
    $el('np-more-sheet')?.classList.add('open')
  })
  $el('np-more-sheet-overlay')?.addEventListener('click', () => {
    $el('np-more-sheet')?.classList.remove('open')
  })
})

//mediasession-init
setInterval(_updatePositionState, 1000)
