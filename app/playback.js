// Playback
import * as Player from '../modules/player.js'
import History from '../modules/history.js'

export let currentId = null
let _cur = null, _start = null

// Play
export function playTrack(tracks, index) {
  const t = tracks[index];
  if (!t) return;
  _flush();
  currentId = t.id;
  _start = Date.now();
  _cur = t;
  Player.play(t, tracks, index);
  History.push(t);
  _record(t);
  refreshActiveTracks()
}

// Sync
export function refreshActiveTracks() {
  document.querySelectorAll('[data-tid]').forEach(el => {
    const act = el.dataset.tid === currentId;
    if (el.classList.contains('track-card') || el.classList.contains('alb-track')) {
      el.classList.toggle('playing', act);
      el.querySelector('.alb-track-title, .track-name, .vc-title')?.classList.toggle('playing', act);
    } else {
      const c = el.querySelector('.track-card');
      c?.classList.toggle('playing', act);
      c?.querySelector('.track-name, .alb-track-title')?.classList.toggle('playing', act);
    }
  });
}

export function setCurrentId(id) { currentId = id; }

// History
function _record(t) {
  if (!t?.id) return;
  try {
    const h = JSON.parse(localStorage.getItem('tt_play_history') || '[]');
    h.unshift({ ...t, type: t.type || 'track', listenedMs: 0, playedAt: Date.now() });
    localStorage.setItem('tt_play_history', JSON.stringify(h.slice(0, 2000)));
  } catch {}
  _notify();
}

// Flush
function _flush() {
  if (!_cur || !_start) return;
  const ms = Date.now() - _start;
  if (ms < 10000) return;
  try {
    const h = JSON.parse(localStorage.getItem('tt_play_history') || '[]');
    const entry = h.find(e => e.id === _cur.id && e.listenedMs === 0);
    if (entry) {
      entry.listenedMs = ms;
      const s = Math.floor(ms / 1000);
      entry.duration = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      localStorage.setItem('tt_play_history', JSON.stringify(h));
    }
  } catch {}
}

// Notify
function _notify() {
  if (document.getElementById('page-account')?.classList.contains('active')) {
    import('./router.js').then(R => import('../pages/capsule.js').then(C => C.render()));
  }
}
