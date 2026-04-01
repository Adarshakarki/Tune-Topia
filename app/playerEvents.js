import * as Player from '../modules/player.js'
import * as UI from './ui.js'
import State from './state.js'
import Queue from '../modules/queue.js';
import { setCurrentId, refreshActiveTracks } from './playback.js';
import { fetchLyrics } from '../modules/lyrics.js';

let _amEl, _cleanup;

// Load AM-Lyrics
import('@uimaxbai/am-lyrics/am-lyrics.js').catch(() => {
  const s = document.createElement('script');
  Object.assign(s, { type: 'module', src: 'https://cdn.jsdelivr.net/npm/@uimaxbai/am-lyrics/dist/src/am-lyrics.min.js' });
  document.head.appendChild(s);
});

// Bind player events
export function bind() {
  Player.on('trackChanged', t => {
    UI.setTrackInfo(t); setCurrentId(t.id); refreshActiveTracks(); _loadLyrics(t);
    UI.renderQueue(State.get('queue.tracks') || [], State.get('player.queuePosition') || 0);
  });
  Player.on('sleepTimerFired', () => UI.toast('Sleep timer: playback stopped'));
  Player.on('playStateChanged', UI.setPlayState);
  Player.on('progress', ({ pct, current, duration }) => UI.updateProgress(pct, current, duration));
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
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    const vol = () => State.get('player.volume') ?? 0.8;
    switch (e.code) {
      case 'Space': e.preventDefault(); Player.toggle(); break;
      case 'ArrowRight': e.preventDefault(); (e.shiftKey || e.metaKey) ? Player.next() : Player.seekSeconds(10); break;
      case 'ArrowLeft': e.preventDefault(); (e.shiftKey || e.metaKey) ? Player.prev() : Player.seekSeconds(-10); break;
      case 'ArrowUp': e.preventDefault(); Player.setVolume(Math.min(1, vol() + 0.1)); break;
      case 'ArrowDown': e.preventDefault(); Player.setVolume(Math.max(0, vol() - 0.1)); break;
      case 'KeyM': Player.toggleMute(); break;
      case 'KeyN': Player.next(); break;
      case 'KeyP': Player.prev(); break;
      case 'KeyS': Player.toggleShuffle(); break;
      case 'KeyR': Player.toggleRepeat(); break;
    }
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

  // Clear previous lyrics and satisfy .every() checks by initializing as an empty array.
  // We avoid setting songTitle/Artist as attributes to prevent the component's slow internal fetch.
  el.lyrics = [];
  Object.assign(el, { 
    songTitle: title, 
    songArtist: artist, 
    highlightColor: _getHi() 
  });

  // Use our app's optimized lyrics module (LRCLIB)
  fetchLyrics(title, artist, track.album, track.duration).then(res => {
    if (res.synced && res.synced.length > 0) {
      // The parser now ensures every synced line has a .words array, 
      // forcing the component into word-by-word mode consistently.
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

  const obs = new MutationObserver(() => el.setAttribute('highlight-color', _getHi()));
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  _cleanup = () => {
    onPause();
    ['timeupdate', 'seeked'].forEach(ev => audio.removeEventListener(ev, sync));
    audio.removeEventListener('play', onPlay); audio.removeEventListener('pause', onPause);
    obs.disconnect();
  };
}