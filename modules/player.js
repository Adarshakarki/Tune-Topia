// Player
import State from '../app/state.js'
import Queue from './queue.js'
import History from './history.js'
import * as Recommendations from './recommendations.js'
import * as processor from './processor.js'
import {
  getStream as tidalStream,
  getTrackRecommendations,
  searchTracks,
} from '../api/index.js'
import { getAudioStream as ytStream, searchVideos } from '../api/index.js'
import * as AnimatedArtwork from './animatedArtwork.js'

// Audio
export const audioA = document.getElementById('audio')
if (audioA) audioA.crossOrigin = 'anonymous'
export const audioB = new Audio()
audioB.crossOrigin = 'anonymous'
audioB.preload = 'auto'
audioB.style.display = 'none'
document.body.appendChild(audioB)

let _active = audioA
let _inactive = audioB
let _dash = null
let _swapping = false
let _sleepAfterTrack = false
let _handlersRegistered = false
let _switching = false
let _radioMode = false
const _radioHistory = new Set()
let _loadingRadio = false
let _playRequestId = 0

const _preloadLead = 20
const _listeners = {}
let _preloaded = null
let _preloading = false
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

// Unified API base for Tidal requests
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '/api' 
  : '/proxy';

export const _proxify = (url) => {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  // Route Tidal API calls through the path-based proxy (handles both http and https)
  const tidalMatch = url.match(/^https?:\/\/api\.tidal\.com/);
  if (tidalMatch) {
    return url.replace(tidalMatch[0], API_BASE);
  }

  // Replace the URL below with the address of your hosted Node.js proxy server
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const proxyBase = isLocal ? '' : 'https://tune-topia.onrender.com';
  return `${proxyBase}/proxy?url=${encodeURIComponent(url)}`;
};

// Events
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

// Media
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

  navigator.mediaSession.playbackState = State.get('player.isPlaying') ? 'playing' : 'paused';

  const _setPosition = () => {
    if (!_active.duration || !isFinite(_active.duration)) return;
    try { navigator.mediaSession.setPositionState(isIOS ? { playbackRate: _active.playbackRate || 1, position: _active.currentTime } : { duration: _active.duration, playbackRate: _active.playbackRate || 1, position: Math.min(_active.currentTime, _active.duration) }); } catch {}
  };

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

function _syncMediaSessionState(isPlaying) {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
}

function _ensureMediaSessionHandlers() {
  if (!('mediaSession' in navigator) || _handlersRegistered) return
  _handlersRegistered = true

  try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch {}
  try { navigator.mediaSession.setActionHandler('seekforward', null); } catch {}

  const handlers = {
    previoustrack: prev, nexttrack: next,
    play: () => { _active.play(); _syncMediaSessionState(true); },
    pause: () => { _active.pause(); _syncMediaSessionState(false); },
    seekto: (e) => {
      if (e.seekTime != null && _active.duration && !isIOS) { _active.currentTime = e.seekTime; _updatePositionState(); }
    },
  }

  Object.entries(handlers).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {}
  })
}

function _updatePositionState() {
  if (!('mediaSession' in navigator)) return
  if (!_active?.duration || !isFinite(_active.duration)) return
  // Set rate to 0 if paused to stop the system seek bar from advancing
  const rate = (_active.paused || _active.ended) ? 0 : (_active.playbackRate || 1);
  try { 
    navigator.mediaSession.setPositionState(isIOS ? { playbackRate: rate, position: _active.currentTime } : { duration: _active.duration, playbackRate: rate, position: Math.min(_active.currentTime, _active.duration) }); 
  } catch {}
}


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
    _emit('error', 'Playback error');
    next()
  })
  el.addEventListener('timeupdate', () => {
    if (el !== _active || !el.duration) return
    const remaining = el.duration - el.currentTime;
    _emit('progress', { pct: (el.currentTime / el.duration) * 100, current: el.currentTime, duration: el.duration });
    if (!_preloading && !_preloaded && remaining <= _preloadLead) {
      if (localStorage.getItem('tt_gapless') !== 'false') _preloadNext()
    }
  })
}

_bindAudio(audioA)
_bindAudio(audioB)

// Logic
function _onEnded() {
  if (_sleepAfterTrack) {
    _sleepAfterTrack = false; _emit('playStateChanged', false); _emit('sleepTimerFired', null); return;
  }
  if (State.get('player.isRepeat')) { _active.currentTime = 0; _active.play(); return; }
  if (_preloaded && !_swapping) { _swapToPreloaded(); return; }

  const hasNext = Queue.getNext();
  if (hasNext) { next(); return; }

  if (_radioMode) {
    _fillRadioQueue().then(() => {
      if (Queue.getNext()) next();
    });
  }
}

async function _fillRadioQueue() {
  if (_loadingRadio) return;
  _loadingRadio = true;

  try {
    const current = State.get('player.currentTrack');
    let tracks = [];

    // Recommendations
    if (current?.id && current.source !== 'youtube') {
      const recs = await getTrackRecommendations(current.id);
      tracks = recs.filter(t => !_radioHistory.has(t.id));
    }

    // Fallback
    if (tracks.length === 0) {
      const { queries } = Recommendations.getHomeQueries(State, History);
      const query = queries[Math.floor(Math.random() * queries.length)];
      if (query) {
        const results = await searchTracks(query);
        tracks = results.filter(t => !_radioHistory.has(t.id));
      }
    }

    // Batch
    const batch = tracks.slice(0, 4);
    if (batch.length > 0) {
      batch.forEach(r => {
        _radioHistory.add(r.id);
        Queue.add(r, false);
      });
      _emit('queueUpdated', { tracks: State.get('queue.tracks'), position: State.get('player.queuePosition') });
    }
  } catch {
  } finally {
    _loadingRadio = false;
  }
}

// Preload
async function _preloadNext() {
  const upcoming = Queue.getUpcoming();
  let nextTrack = upcoming.priority[0] || upcoming.incoming[0];

  if (!nextTrack && _radioMode) {
    await _fillRadioQueue();
    const updated = Queue.getUpcoming();
    nextTrack = updated.priority[0] || updated.incoming[0];
  }

  if (!nextTrack) return;
  _preloading = true;
  try {
    const stream = await _getStream(nextTrack);
    if (stream.type === 'dash') { _preloading = false; return; }

    _inactive.pause()
    _inactive.src = ''
    _inactive.load()
    _inactive.src = stream.url
    _inactive.volume = 0
    _inactive.load()
    _preloaded = { track: nextTrack }
  } catch {}
  _preloading = false
}

// Gapless
function _swapToPreloaded() {
  if (_swapping) return
  _swapping = true;
  const track = _preloaded.track;

  _inactive.volume = 1; _inactive.play().catch(() => {});
  _ensureMediaSessionHandlers();

  _active.pause(); _active.src = ''; _active.volume = 1;
  [_active, _inactive] = [_inactive, _active];

  Queue.advance(1);
  State.set('player.currentTrack', track); _emit('trackChanged', track);
  _emit('queueUpdated', { tracks: State.get('queue.tracks'), position: State.get('player.queuePosition') });

  AnimatedArtwork.getAnimatedUrl(track).then(url => {
    _emit('animatedArtworkAvailable', { trackId: track.id, url });
  });

  History.push(track); _updateMediaSession(track);

  _preloaded = null; _preloading = false; _swapping = false;
  _preloadNext();
}

// DASH
async function _loadDashJs() {
  return new Promise((res, rej) => {
    if (window.dashjs) {
      res()
      return
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/dashjs/4.7.4/dash.all.min.js'; s.onload = res;
    s.onerror = rej
    document.head.appendChild(s)
  })
}

async function _playDash(manifestXml) {
  await _loadDashJs()
  if (_dash) { try { _dash.destroy(); } catch {} }
  _dash = dashjs.MediaPlayer().create();
  const blob = new Blob([manifestXml], { type: 'application/dash+xml' });
  _dash.initialize(_active, URL.createObjectURL(blob), true);
  _dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { audio: false } } } });
}

// Stream
async function _getStream(track) {
  if (track.source === 'youtube') return ytStream(track.id);
  
  try {
    const katzeUrl = `https://katze.qqdl.site/track/?id=${track.id}&quality=LOW`;

    const response = await fetch(katzeUrl);
    const json = await response.json();

    if (json?.data?.manifest) {
      const decodedManifest = JSON.parse(atob(json.data.manifest));

      return {
      url: decodedManifest.urls[0],
      type: 'url'
      };
    }
  } catch (err) {
    console.error('[Player] Katze fetch failed:', err);
  }

  throw new Error('Stream unavailable');
}

// Playback
export async function play(track, tracks, startIndex = 0) {
  const requestId = ++_playRequestId
  if (tracks) Queue.load(tracks, startIndex);
  await processor.resume();

  _radioHistory.add(track.id);
  _switching = true; _pauseVideo(); _preloaded = null; _preloading = false; _swapping = false;

  audioA.pause(); audioA.volume = 1; audioA.src = ''; audioA.load();
  audioB.pause(); audioB.volume = 1; audioB.src = ''; audioB.load();
  _active = audioA; _inactive = audioB; _switching = false;
  
  if (_dash) { try { _dash.destroy(); } catch {} _dash = null; }

  State.set('player.currentTrack', track);
  _emit('trackChanged', track);

AnimatedArtwork.getAnimatedUrl(track)
  .then((url) => {
    console.log('[ARTWORK PROMISE RESULT]', url);

    _emit('animatedArtworkAvailable', {
      trackId: track.id,
      url: url
    });
  })
  .catch((err) => {
    console.error('[ARTWORK PROMISE ERROR]', err);
  });

  try {
    const stream = await _getStream(track)
    if (requestId !== _playRequestId) return

    console.log('STREAM:', stream)

    if (stream.type === 'dash') {
      await _playDash(stream.manifest)
    } else {
      if (!stream.url) {
        throw new Error('Stream URL is missing');
      }

      _active.onerror = () => console.log('AUDIO ERROR:', _active.error)
      _active.oncanplay = () => console.log('AUDIO READY')
      _active.pause()
      _active.src = ''
      _active.load()
      _active.src = stream.url
      _active.load()
      await _active.play().catch(err => console.log('PLAY FAILED:', err))
      if (requestId !== _playRequestId) {
        _active.pause()
        return
      }
      _ensureMediaSessionHandlers()
    }

    if (requestId !== _playRequestId) return

    History.push(track);
    _emit('queueUpdated', { tracks: State.get('queue.tracks'), position: State.get('player.queuePosition') });
    _updateMediaSession(track);
  } catch (e) {
    if (requestId !== _playRequestId) return
    _emit('error', e.message || 'Playback error')
  }
}

export async function startRadio(track = null) {
  _radioMode = true;
  _radioHistory.clear();
  Queue.clear();

  if (track) {
    _radioHistory.add(track.id);
    await play(track, [track], 0);
  } else {
    await _fillRadioQueue();
    const first = Queue.advance(1);
    if (first) await play(first);
  }
  _fillRadioQueue();
}

export async function toggle() {
  // Check if the current active element has a valid source.
  // We also check networkState to avoid calling play() when the browser has already determined
  // that the source is unsupported or missing (NETWORK_NO_SOURCE = 3).
  const hasSource = _active.src && _active.src !== window.location.href && _active.networkState !== 3;
  
  if (!hasSource && !_dash) return;

  try {
    await processor.resume();
    if (State.get('player.isPlaying')) {
      _active.pause();
    } else {
      const playPromise = _active.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    }
  } catch (err) {
    console.warn('[Player] Toggle playback failed:', err);
    // Sync state if playback failed to start
    State.set('player.isPlaying', false);
    _emit('playStateChanged', false);
  }
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
  Queue.jump(index)
  await play(tracks[index])
}

export function seek(pct) {
  if (_active.duration) _active.currentTime = (pct / 100) * _active.duration
}

export function seekToTime(seconds) {
  if (_active) _active.currentTime = seconds;
}

export function seekSeconds(delta) {
  if (!_active.duration) return
  _active.currentTime = Math.max(
    0, Math.min(_active.duration, _active.currentTime + delta));
}

export function getCurrentTime() {
  return _active.currentTime
}
export function getDuration() {
  return _active.duration || 0
}

export function setVolume(v) {
  const vol = Math.max(0, Math.min(1, v));
  _active.volume = vol; State.set('player.volume', vol); localStorage.setItem('tt_vol', vol); _emit('volumeChanged', vol);
}

let _muted = false
let _volBeforeMute = 1
export function toggleMute() {
  if (_muted) {
    setVolume(_volBeforeMute); _muted = false;
  } else {
    _volBeforeMute = _active.volume || State.get('player.volume') || 0.8;
    _active.volume = 0; _muted = true; _emit('volumeChanged', 0);
  }
}

export function toggleShuffle() {
  const val = !State.get('player.isShuffle'); State.set('player.isShuffle', val); val ? Queue.onShuffleEnabled() : Queue.onShuffleDisabled(); _emit('shuffleChanged', val);
}

export function toggleRepeat() {
  const val = !State.get('player.isRepeat'); State.set('player.isRepeat', val); _active.loop = val; _emit('repeatChanged', val);
}


export function getCurrentTrack() {
  return State.get('player.currentTrack')
}

export function setSleepAfterTrack(val) {
  _sleepAfterTrack = val
}

// Video
function _pauseVideo() {
  const vp = document.getElementById('vp-video')
  if (vp && !vp.paused) vp.pause()
}

on('playStateChanged', (playing) => {
  const videos = document.querySelectorAll('.aa-video');
  videos.forEach(v => {
    if (playing) {
      v.play().catch(() => {});
      v.style.transform = 'scale(1.05)';
      v.style.filter = 'brightness(1)';
    } else {
      v.pause();
      v.style.transform = 'scale(1)';
      v.style.filter = 'brightness(0.8)';
    }
  });
});

on('animatedArtworkAvailable', ({ trackId, url }) => {
  console.log('[ARTWORK EVENT]', { trackId, url });

  const current = getCurrentTrack();
  if (!current) return;

  if (String(current.id) !== String(trackId)) return;

  const img = document.getElementById('np-artwork-img');

  const container =
    img?.parentElement ||
    document.querySelector('.now-playing-artwork');

  if (!container) {
    console.warn('[ARTWORK] No container found');
    return;
  }

  console.log('[ARTWORK] Updating UI');
  if (!url) {
  console.log('[ARTWORK] No animated URL → keeping image');
  return;
}
  AnimatedArtwork.updateDisplay(container, url, State.get('player.isPlaying'));
});

// UI
const _npPanel = document.getElementById('now-playing');
export const openNowPlaying = () => { _npPanel?.classList.add('open'); _emit('panelOpened', null); };
export const closeNowPlaying = () => { _npPanel?.classList.remove('open'); _emit('panelClosed', null); };

document.addEventListener('DOMContentLoaded', () => {
  const $el = id => document.getElementById(id);

  $el('player-bar')?.addEventListener('click', (e) => {
    if (
      !e.target.closest('#bar-like-btn') &&
      !e.target.closest('.bar-ctrl') &&
      !e.target.closest('.bar-play-btn')
    )
      openNowPlaying()
  })

  $el('np-down-btn')?.addEventListener('click', closeNowPlaying)

  $el('np-more-sheet-overlay')?.addEventListener('click', () => {
    $el('np-more-sheet')?.classList.remove('open')
  })
})

//mediasession-init
setInterval(_updatePositionState, 1000)
