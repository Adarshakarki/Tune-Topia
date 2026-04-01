// ui/nowplaying.js — now playing panel + mini player (bar) event bindings

import * as Player from '../modules/player.js'
import * as UI from '../app/ui.js'
import * as PlaylistsUI from '../pages/playlists-ui.js'
import { onLike } from '../app/likes.js'

const $ = id => document.getElementById(id);
const isDesk = () => window.matchMedia('(min-width: 900px)').matches;

// Calculate click percentage on bars
const _getPos = (id, e) => {
  const r = $(id)?.getBoundingClientRect();
  return r ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0;
};

// Smooth scroll queue
const _scroll = () => requestAnimationFrame(() => $('np-queue-list')?.querySelector('.npq-item.active')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));

export function init() {
  UI.updatePlayerPosition(); window.addEventListener('resize', UI.updatePlayerPosition);
  // Mini player open triggers
  $('bar-track')?.addEventListener('click', () => !isDesk() && UI.openPlayer());
  $('bar-art')?.addEventListener('click', () => isDesk() && UI.openPlayer());

  // StopPropagation bindings
  const stopBind = (id, fn) => $(id)?.addEventListener('click', e => { e.stopPropagation(); fn(); });
  stopBind('bar-like-btn', () => onLike(Player.getCurrentTrack()));
  stopBind('mini-prev-btn', Player.prev);
  stopBind('mini-play-btn', Player.toggle);
  stopBind('mini-next-btn', Player.next);

  // Idle timer logic
  let idle;
  const np = $('now-playing'), refreshIdle = () => {
    np?.classList.remove('np-idle'); clearTimeout(idle);
    if (isDesk() && np?.classList.contains('open')) idle = setTimeout(() => np.classList.add('np-idle'), 3000);
  };
  np?.addEventListener('mousemove', refreshIdle);
  np?.addEventListener('click', refreshIdle);
  $('np-close-btn')?.addEventListener('click', () => { clearTimeout(idle); np?.classList.remove('np-idle'); }, { capture: true });

  // Global Action helper
  const act = (id, fn) => $(id)?.addEventListener('click', fn);
  act('bar-prev-btn', Player.prev); act('bar-play-btn', Player.toggle); act('bar-next-btn', Player.next);
  act('bar-shuffle-btn', Player.toggleShuffle); act('bar-repeat-btn', Player.toggleRepeat);
  act('bar-lyrics-btn', () => { UI.openPlayer(); UI.openPanel('np-lyrics-panel'); });
  act('bar-add-playlist-btn', () => { const t = Player.getCurrentTrack(); if (t) PlaylistsUI.openPicker(t); });
  act('bar-more-btn', () => { const t = Player.getCurrentTrack(); if (t) UI.openMoreSheet(t); });
  act('bar-queue-btn', () => { UI.openPlayer(); UI.openPanel('np-queue-panel'); _scroll(); });

  // Bars
  act('bar-progress-bar', e => Player.seek(_getPos('bar-progress-bar', e) * 100));
  act('bar-vol-bar', e => Player.setVolume(_getPos('bar-vol-bar', e)));

  // Now Playing Controls
  act('np-close-btn', () => { const o = document.querySelector('.np-overlay.open'); o ? UI.closePanel(o.id) : UI.closePlayer(); });
  act('np-play-btn', Player.toggle); act('np-prev-btn', Player.prev); act('np-next-btn', Player.next);
  act('np-love-btn', () => onLike(Player.getCurrentTrack()));
  ['np-more-btn', 'np-np-more-btn'].forEach(id => act(id, () => { const t = Player.getCurrentTrack(); if (t) UI.openMoreSheet(t); }));
  act('np-progress-bar', e => Player.seek(_getPos('np-progress-bar', e) * 100));
  act('vol-bar', e => Player.setVolume(_getPos('vol-bar', e)));

  // Panel Overlays
  act('np-lyrics-btn', () => UI.openPanel('np-lyrics-panel'));
  act('np-lyrics-play', Player.toggle); act('np-lyrics-prev', Player.prev); act('np-lyrics-next', Player.next);
  act('np-queue-toggle-btn', () => { UI.openPanel('np-queue-panel'); _scroll(); });
  ['np-lyrics-mini-bar', 'np-queue-mini-bar'].forEach(id => act(id, e => Player.seek(_getPos(id, e) * 100)));
}

export function syncMoreSheetPosition() {
  const s = $('np-more-sheet'), np = $('now-playing');
  if (!s) return;
  window.innerWidth >= 900 
    ? (s.parentNode !== document.body && document.body.appendChild(s)) 
    : (s.parentNode !== np && np.appendChild(s));
}
