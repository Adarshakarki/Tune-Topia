import State from '../app/state.js'
import Queue from './queue.js'
import History from './history.js'
import {
  getStream as tidalStream,
  getTrackRecommendations,
} from '../api/index.js'
import { getAudioStream as ytStream, searchVideos } from '../api/index.js'

const audioA = document.getElementById('audio')
const audioB = new Audio()
audioB.preload = 'auto'

let _active = audioA
let _inactive = audioB

const _listeners = {}
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

let _sleepAfterTrack = false
export function setSleepAfterTrack(val) {
  _sleepAfterTrack = val
}

const _preloadLead = 20
let _preloaded = null
let _preloading = false
let _swapping = false

function _pauseVideo() {
  const vp = document.getElementById('vp-video')
  if (vp && !vp.paused) vp.pause()
}

function _bindAudio(el) {
  el.addEventListener('play', () => {
    if (el !== _active) return
    State.set('player.isPlaying', true)
    _emit('playStateChanged', true)
    _syncMediaSessionState(true)
  })
  el.addEventListener('pause', () => {
    if (el !== _active) return
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
  // queue exhausted — fetch recs for current track and continue
  const current = State.get('player.currentTrack')
  if (!current) return
  getTrackRecommendations(current.id).then((recs) => {
    if (!recs.length) return
    recs.forEach((r) => Queue.add(r))
    next()
  })
}

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

function _swapToPreloaded() {
  if (_swapping) return
  _swapping = true
  const track = _preloaded.track

  _inactive.volume = 1
  _inactive.play().catch(() => {})
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

let _dash = null

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

async function _getStream(track) {
  if (track.source === 'youtube') return ytStream(track.id)
  try {
    return await tidalStream(track.id)
  } catch {}
  const yt = await searchVideos(`${track.title} ${track.artist} audio`)
  if (yt.length) return ytStream(yt[0].id)
  throw new Error('Stream unavailable')
}

export async function play(track, tracks, startIndex) {
  if (tracks) Queue.load(tracks, startIndex ?? 0)

  // Pause any playing video
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

  navigator.mediaSession.playbackState = 'playing'

  // Wait for real duration to be available before setting position state
  const trySetPosition = () => {
    if (!_active.duration || !isFinite(_active.duration)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: _active.duration,
        playbackRate: _active.playbackRate || 1,
        position: Math.min(_active.currentTime, _active.duration),
      })
    } catch {}
  }

  // iOS needs this after play begins, not just metadata load
  _active.addEventListener('playing', function onPlaying() {
    _active.removeEventListener('playing', onPlaying)
    trySetPosition()
  })
}

navigator.mediaSession.playbackState = 'playing'

_active.onloadedmetadata = () => {
  navigator.mediaSession.setPositionState({
    duration: _active.duration || 0,
    playbackRate: _active.playbackRate || 1,
    position: 0,
  })
}

function _syncMediaSessionState(isPlaying) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('previoustrack', () => prev())
  navigator.mediaSession.setActionHandler('nexttrack', () => next())

  navigator.mediaSession.setActionHandler('play', () => {
    _active.play()
    _syncMediaSessionState(true)
  })

  navigator.mediaSession.setActionHandler('pause', () => {
    _active.pause()
    _syncMediaSessionState(false)
  })

  try {
    navigator.mediaSession.setActionHandler('seekbackward', null)
  } catch {}
  try {
    navigator.mediaSession.setActionHandler('seekforward', null)
  } catch {}

  navigator.mediaSession.setActionHandler('seekto', (e) => {
    if (e.seekTime != null && _active.duration) {
      _active.currentTime = e.seekTime
      navigator.mediaSession.setPositionState({
        duration: _active.duration,
        playbackRate: _active.playbackRate || 1,
        position: _active.currentTime,
      })
    }
  })
}

setInterval(() => {
  if (!('mediaSession' in navigator)) return
  if (!_active?.duration || !isFinite(_active.duration)) return

  try {
    navigator.mediaSession.setPositionState({
      duration: _active.duration,
      playbackRate: _active.playbackRate || 1,
      position: Math.min(_active.currentTime, _active.duration),
    })
  } catch {}
}, 1000)

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
