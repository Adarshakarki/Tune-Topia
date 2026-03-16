// app/playerEvents.js — player event bindings, lyrics, keyboard shortcuts

import * as Player from '../modules/player.js';
import * as UI from './ui.js';
import State from './state.js';
import Queue from '../modules/queue.js';
import { fetchLyrics } from '../modules/lyrics.js';
import { setCurrentId, refreshActiveTracks } from './playback.js';

let _syncedLyrics = [];

export function bind() {
  Player.on('trackChanged', (track) => {
    UI.setTrackInfo(track);
    setCurrentId(track.id);
    refreshActiveTracks();
    _loadLyrics(track);
    UI.renderQueue(
      State.get('queue.tracks') || [],
      State.get('player.queuePosition') || 0,
    );
  });

  Player.on('sleepTimerFired', () => UI.toast('Sleep timer: playback stopped'));
  Player.on('playStateChanged', UI.setPlayState);

  Player.on('progress', ({ pct, current, duration }) => {
    UI.updateProgress(pct, current, duration);
    if (_syncedLyrics.length) UI.updateActiveLyric(_syncedLyrics, current);
  });

  Player.on('shuffleChanged', UI.setShuffle);
  Player.on('repeatChanged', UI.setRepeat);
  Player.on('volumeChanged', UI.updateVolume);
  Player.on('queueUpdated', ({ tracks, position }) =>
    UI.renderQueue(tracks, position, Queue.getUpcoming()),
  );
  Player.on('error', (msg) => UI.toast(msg));

  _bindKeyboard();
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
function _bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input
    const tag = document.activeElement?.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      document.activeElement?.isContentEditable
    )
      return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        Player.toggle();
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey || e.metaKey) {
          Player.next();
        } else {
          Player.seekSeconds(10);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey || e.metaKey) {
          Player.prev();
        } else {
          Player.seekSeconds(-10);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        Player.setVolume(
          Math.min(1, (State.get('player.volume') ?? 0.8) + 0.1),
        );
        break;

      case 'ArrowDown':
        e.preventDefault();
        Player.setVolume(
          Math.max(0, (State.get('player.volume') ?? 0.8) - 0.1),
        );
        break;

      case 'KeyM':
        Player.toggleMute();
        break;

      case 'KeyN':
        Player.next();
        break;

      case 'KeyP':
        Player.prev();
        break;

      case 'KeyS':
        Player.toggleShuffle();
        break;

      case 'KeyR':
        Player.toggleRepeat();
        break;
    }
  });
}

// ── LYRICS ────────────────────────────────────────────────
async function _loadLyrics(track) {
  _syncedLyrics = [];
  UI.renderLyrics(null, null);
  const { synced, plain } = await fetchLyrics(
    track.title,
    track.artist,
    track.album,
    track.duration,
  );
  _syncedLyrics = synced || [];
  UI.renderLyrics(_syncedLyrics, plain);
}
