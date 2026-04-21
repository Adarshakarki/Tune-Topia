import * as Player from '../modules/player.js'
import * as UI from './ui.js'
import State from './state.js'
import Queue from '../modules/queue.js';
import { setCurrentId, refreshActiveTracks } from './playback.js';
import { fetchLyrics } from '../modules/lyrics.js';

let _amEl, _cleanup;

let _raf;
let _lastTime = 0, _lastSync = performance.now();
let _cachedAudio = null;

const _tick = () => {
  const audio = _cachedAudio || (_cachedAudio = document.querySelector('audio'));
  if (audio && !audio.paused && audio.duration) {
    const now = performance.now();
    if (audio.currentTime !== _lastTime) {
      _lastTime = audio.currentTime;
      _lastSync = now;
    }
    const smoothTime = _lastTime + (now - _lastSync) / 1000;
    const pct = (Math.min(smoothTime, audio.duration) / audio.duration) * 100;
    UI.updateProgress(pct, smoothTime, audio.duration);
    _raf = requestAnimationFrame(_tick);
  } else {
    _raf = null;
  }
};


const _themeObs = new MutationObserver(() => {
  if (_amEl) _amEl.highlightColor = _getHi();
});
_themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

export function bind() {
  Player.on('trackChanged', t => {
    UI.setTrackInfo(t); setCurrentId(t.id); refreshActiveTracks(); _loadLyrics(t);
    UI.renderQueue(State.get('queue.tracks') || [], State.get('player.queuePosition'), Queue.getUpcoming());
  });
  Player.on('sleepTimerFired', () => UI.toast('Sleep timer: playback stopped'));
  Player.on('playStateChanged', playing => {
    UI.setPlayState(playing);
    if (playing && !_raf) _tick();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  });
  Player.on('progress', ({ pct, current, duration }) => { if (!_raf) UI.updateProgress(pct, current, duration); });
  Player.on('shuffleChanged', UI.setShuffle);
  Player.on('repeatChanged', UI.setRepeat);
  Player.on('volumeChanged', UI.updateVolume);
  Player.on('queueUpdated', ({ tracks, position }) => UI.renderQueue(tracks, position, Queue.getUpcoming()));
  Player.on('error', UI.toast);
  _bindKeyboard();
}

const _clean = s => typeof s === 'string' ? s.split(/[-(\[](?:remaster|remix|mix|live|deluxe|edition|version|from|feat|ft)/i)[0].trim() : '';
const _primary = t => _clean(Array.isArray(t.artists) ? (t.artists[0]?.name ?? t.artists[0] ?? '') : (t.artist?.name ?? t.artist ?? ''));
const _getHi = () => getComputedStyle(document.documentElement).colorScheme === 'light' ? '#000' : '#fff';

function _bindKeyboard() {
  const DEFAULT_MAP = { toggle: 'Space', next: 'KeyN', prev: 'KeyP', seekFwd: 'ArrowRight', seekBack: 'ArrowLeft', volUp: 'ArrowUp', volDown: 'ArrowDown', mute: 'KeyM', shuffle: 'KeyS', repeat: 'KeyR', home: 'KeyH', search: 'Slash', settings: 'KeyI' };

  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    
    const mods = [];
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Meta');

    const saved = JSON.parse(localStorage.getItem('tt_shortcuts') || '{}');
    const map = { ...DEFAULT_MAP, ...saved };
    const code = (mods.length ? mods.join('+') + '+' : '') + e.code;
    const baseCode = e.code;
    const vol = () => State.get('player.volume') ?? 0.8;

    if (code === map.toggle) { e.preventDefault(); Player.toggle(); }
    else if (code === map.next) { Player.next(); }
    else if (code === map.prev) { Player.prev(); }
    else if (baseCode === map.seekFwd) { e.preventDefault(); (e.shiftKey || e.metaKey) ? Player.next() : Player.seekSeconds(10); }
    else if (baseCode === map.seekBack) { e.preventDefault(); (e.shiftKey || e.metaKey) ? Player.prev() : Player.seekSeconds(-10); }
    else if (code === map.volUp) { e.preventDefault(); Player.setVolume(Math.min(1, vol() + 0.1)); }
    else if (code === map.volDown) { e.preventDefault(); Player.setVolume(Math.max(0, vol() - 0.1)); }
    else if (code === map.mute) { Player.toggleMute(); }
    else if (code === map.shuffle) { Player.toggleShuffle(); }
    else if (code === map.repeat) { Player.toggleRepeat(); }
    else if (code === map.home) { import('./router.js').then(R => R.showPage('home')); }
    else if (code === map.search) { e.preventDefault(); import('./router.js').then(R => { R.showPage('search'); setTimeout(() => document.getElementById('search-input')?.focus(), 100); }); }
    else if (code === map.settings) { import('./router.js').then(R => R.showPage('settings')); }
  });
}

function _getAm() {
  const b = document.getElementById('np-lyrics-body');
  if (!b) return null;
  if (!_amEl) {
    _amEl = document.createElement('am-lyrics');
    Object.assign(_amEl, { autoscroll: true, interpolate: true, lyrics: [] });
    _amEl.style.cssText = 'display:block;width:100%;height:100%';
    _amEl.addEventListener('line-click', e => {
      if (e.detail?.timestamp !== undefined) { Player.seekToTime(e.detail.timestamp / 1000); }
    });
  }
  if (!b.contains(_amEl)) { b.innerHTML = ''; b.appendChild(_amEl); }
  return _amEl;
}

async function _loadLyrics(track) {
  if (_cleanup) _cleanup();
  const el = _getAm();
  if (!el) return;
  await customElements.whenDefined('am-lyrics');

  const title = _clean(track.title ?? ''), artist = _primary(track);
  const dur = track.duration > 5000 ? Math.round(track.duration / 1000) : Math.round(track.duration ?? 0);

  el.lyrics = [];
  Object.assign(el, { 
    songTitle: title, 
    songArtist: artist, 
    highlightColor: _getHi() 
  });

  fetchLyrics(title, artist, track.album, track.duration).then(res => {
    if (res.synced && res.synced.length > 0) {
      el.lyrics = res.synced;
    } else if (res.plain) {
      el.lyrics = res.plain.split('\n').map(text => ({ text, time: 0 }));
    }
  });

  const audio = document.querySelector('audio');
  if (!audio) return;

  let frame;
  const tick = () => { 
    el.currentTime = audio.currentTime * 1000;
    if (!audio.paused) frame = requestAnimationFrame(tick);
  };
  const sync = () => { el.currentTime = audio.currentTime * 1000; };
  const onPlay = () => { sync(); if (!frame) tick(); };
  const onPause = () => { cancelAnimationFrame(frame); frame = null; };

  ['timeupdate', 'seeked'].forEach(ev => audio.addEventListener(ev, sync));
  audio.addEventListener('play', onPlay);
  audio.addEventListener('pause', onPause);
  if (!audio.paused) tick();

  _cleanup = () => {
    onPause();
    ['timeupdate', 'seeked'].forEach(ev => audio.removeEventListener(ev, sync));
    audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause);
  };
}