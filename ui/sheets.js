// ui/sheets.js — bottom sheets and popup event wiring

import * as UI from '../app/ui.js'
import * as Player from '../modules/player.js'
import Queue from '../modules/queue.js'
import State from '../app/state.js'
import { escHtml } from '../api/utils.js'
import { openPicker } from '../pages/playlists-ui.js'
import { onLike } from '../app/likes.js'
import { has as isLiked } from '../modules/likedSongs.js'
import { ICONS } from '../app/icons.js'
import { downloadTrack } from '../modules/downloader.js'

const $ = id => document.getElementById(id);
let _timer = null, _qIdx = -1, _tsTrack = null, _tsOpts = {};

// Track Options
export function openTrackSheet(t, opts = {}) {
  _tsTrack = t; _tsOpts = opts;
  const p = $('track-sheet-preview');
  if (p) {
    p.innerHTML = ''; // Clear existing
    const img = document.createElement('img');
    img.src = t.coverSmall || t.cover || '';
    img.onerror = () => { img.src = ''; };
    const info = document.createElement('div');
    info.innerHTML = `<div class="bs-title"></div><div class="bs-artist"></div>`;
    info.querySelector('.bs-title').textContent = t.title;
    info.querySelector('.bs-artist').textContent = t.artist || '';
    p.append(img, info);
  }

  const l = isLiked(t.id), btn = $('tsheet-like'), lbl = $('tsheet-like-label'), ico = btn?.querySelector('i');
  if (btn) btn.classList.toggle('liked', l);
  if (lbl) lbl.textContent = l ? 'Unlike' : 'Like';
  if (ico) ico.className = `bi ${l ? ICONS.heartFill : ICONS.heart}`;

  const show = (id, v) => { const e = $(id); if (e) e.style.display = v ? '' : 'none'; };
  const visibility = {
    'add-playlist': !opts.onRemove,
    'move-up': !!opts.onMoveUp,
    'move-down': !!opts.onMoveDown,
    'remove': !!opts.onRemove
  };
  Object.entries(visibility).forEach(([k, v]) => show(`tsheet-${k}`, v));
  show('tsheet-go-album', !!(t.album || t.albumId));
  $('track-options-sheet')?.classList.add('open');
}

const _closeTS = () => { $('track-options-sheet')?.classList.remove('open'); _tsTrack = null; _tsOpts = {}; };
const _openSleep = () => { $('sleep-timer-popup')?.classList.add('open'); UI.closeMoreSheet(); };
const _closeSleep = () => $('sleep-timer-popup')?.classList.remove('open');

function _cancelSleep() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  Player.setSleepAfterTrack(false);
  document.querySelectorAll('.sleep-timer-opt').forEach(b => b.classList.remove('active'));
  ['sleep-timer-status', 'sleep-timer-cancel-btn'].forEach(id => { if ($(id)) $(id).style.display = 'none'; });
  UI.toast('Sleep timer cancelled');
}

function _setSleep(m) {
  if (_timer) clearTimeout(_timer);
  Player.setSleepAfterTrack(false);
  _timer = setTimeout(() => { Player.toggle(); _timer = null; UI.toast('Sleep timer: playback stopped'); }, m * 60000);
  const end = new Date(Date.now() + m * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const s = $('sleep-timer-status'), c = $('sleep-timer-cancel-btn');
  if (s) { s.textContent = `Pausing at ${end} (${m} min)`; s.style.display = ''; }
  if (c) c.style.display = '';
  document.querySelectorAll('.sleep-timer-opt').forEach(b => b.classList.remove('active'));
  UI.toast(`Sleep timer set for ${m} min`); _closeSleep();
}

const _closeQS = () => { $('np-queue-item-sheet')?.classList.remove('open'); _qIdx = -1; };
const _refQ = () => UI.renderQueue(State.get('queue.tracks') || [], State.get('player.queuePosition') || 0);

export function initEvents() {
  document.addEventListener('click', e => {
    const b = e.target.closest('.track-more-btn'); if (!b) return; e.stopPropagation();
    const w = b.closest('[data-index]'), idx = parseInt(w?.dataset.index), t = w?.parentElement?._tracks?.[idx];
    if (t) openTrackSheet(t);
  }, true);

  $('track-sheet-overlay')?.addEventListener('click', _closeTS);
  $('tsheet-like')?.addEventListener('click', () => {
    if (!_tsTrack) return; onLike(_tsTrack);
    const l = isLiked(_tsTrack.id), btn = $('tsheet-like'), lbl = $('tsheet-like-label'), ico = btn?.querySelector('i');
    if (btn) btn.classList.toggle('liked', l); if (lbl) lbl.textContent = l ? 'Unlike' : 'Like';
    if (ico) ico.className = `bi ${l ? ICONS.heartFill : ICONS.heart}`;
  });

  $('tsheet-add-queue')?.addEventListener('click', () => { if (_tsTrack) { Queue.addNext(_tsTrack); UI.toast('Added to queue'); _closeTS(); } });
  $('tsheet-add-playlist')?.addEventListener('click', () => { if (_tsTrack) { _closeTS(); setTimeout(() => openPicker(_tsTrack), 300); } });

  const _go = (path, fn) => {
    if (!_tsTrack) return; const t = _tsTrack; _closeTS();
    import(path).then(m => {
      $(path.includes('artist') ? 'page-artist' : 'page-album')?.classList.add('stacked');
      fn(m, t);
    }).catch(() => UI.toast('Could not open page'));
  };

  $('tsheet-go-artist')?.addEventListener('click', () => _go('../pages/artist.js', (m, t) => m.open(t.artistId ? { id: t.artistId, name: t.artist, cover: t.cover } : { id: '', name: t.artist?.split(',')[0].trim(), cover: t.cover })));
  $('tsheet-go-album')?.addEventListener('click', () => _go('../pages/album.js', (m, t) => t.albumId ? m.open({ id: t.albumId, title: t.album, cover: t.cover, artist: t.artist }) : UI.toast('Album info not available')));

  $('tsheet-download')?.addEventListener('click', async () => {
    if (!_tsTrack) return; const t = _tsTrack; _closeTS(); UI.toast('Preparing download…');
    try {
      const { getStream, getAudioStream } = await import('../api/index.js');
      const s = t.source === 'youtube' ? await getAudioStream(t.id) : await getStream(t.id);
      await downloadTrack(t, s);
    } catch (e) { UI.toast(e.message || 'Download failed'); }
  });

  $('tsheet-move-up')?.addEventListener('click', () => { _tsOpts.onMoveUp?.(); _closeTS(); });
  $('tsheet-move-down')?.addEventListener('click', () => { _tsOpts.onMoveDown?.(); _closeTS(); });
  $('tsheet-remove')?.addEventListener('click', () => { _tsOpts.onRemove?.(); _closeTS(); });

  $('sleep-timer-sheet-overlay')?.addEventListener('click', _closeSleep);
  $('sleep-timer-cancel-btn')?.addEventListener('click', () => { _cancelSleep(); _closeSleep(); });

  document.querySelectorAll('.sleep-timer-opt').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.sleep-timer-opt').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    if (btn.dataset.mins === 'eot') {
      if (_timer) { clearTimeout(_timer); _timer = null; }
      Player.setSleepAfterTrack(true);
      const s = $('sleep-timer-status'), c = $('sleep-timer-cancel-btn');
      if (s) { s.textContent = 'Pausing after current track'; s.style.display = ''; }
      if (c) c.style.display = '';
      UI.toast('Sleep timer: will stop after this track'); _closeSleep();
    } else _setSleep(parseInt(btn.dataset.mins));
  }));

  $('np-more-sheet-overlay')?.addEventListener('click', UI.closeMoreSheet);
  $('sheet-add-queue')?.addEventListener('click', () => { const t = Player.getCurrentTrack(); if (t) { Queue.addNext(t); UI.toast('Added to queue'); UI.closeMoreSheet(); } });

  const _share = t => {
    const u = t.source === 'youtube' ? `https://youtu.be/${t.id}` : `https://tidal.com/track/${t.id}`;
    if (navigator.share) navigator.share({ title: `${t.title} — ${t.artist}`, url: u });
    else navigator.clipboard.writeText(u).then(() => UI.toast('Link copied'));
  };

  $('sheet-share')?.addEventListener('click', () => { const t = Player.getCurrentTrack(); if (t) { _share(t); UI.closeMoreSheet(); } });
  $('sheet-open-source')?.addEventListener('click', () => {
    const t = Player.getCurrentTrack(); if (t) window.open(t.source === 'youtube' ? `https://youtu.be/${t.id}` : `https://tidal.com/track/${t.id}`, '_blank'); UI.closeMoreSheet();
  });

  $('sheet-download')?.addEventListener('click', async () => {
    const t = Player.getCurrentTrack(); if (!t) return; UI.closeMoreSheet(); UI.toast('Preparing download…');
    try {
      const { getStream, getAudioStream } = await import('../api/index.js'), { downloadTrack } = await import('../modules/downloader.js');
      const s = t.source === 'youtube' ? await getAudioStream(t.id) : await getStream(t.id);
      await downloadTrack(t, s);
    } catch (e) { UI.toast(e.message || 'Download failed'); }
  });
  $('sheet-add-playlist')?.addEventListener('click', () => { const t = Player.getCurrentTrack(); if (t) { UI.closeMoreSheet(); setTimeout(() => openPicker(t), 300); } });

  $('np-queue-item-sheet-overlay')?.addEventListener('click', _closeQS);
  $('np-queue-list')?.addEventListener('click', e => {
    if (e.target.closest('.q-stack-btn')) return;

    const item = e.target.closest('.npq-item'); if (!item) return;
    const idx = parseInt(item.dataset.index), ts = State.get('queue.tracks') || [], t = ts[idx]; if (!t) return;
    _qIdx = idx; const p = $('np-queue-item-preview');
    if (p) {
      p.innerHTML = '';
      const img = document.createElement('img');
      img.src = t.coverSmall || t.cover || '';
      img.onerror = () => { img.src = ''; };
      const info = document.createElement('div');
      info.innerHTML = '<div class="bs-title"></div><div class="bs-artist"></div>';
      info.querySelector('.bs-title').textContent = t.title;
      info.querySelector('.bs-artist').textContent = t.artist || '';
      p.append(img, info);
    }
    const pos = State.get('player.queuePosition') || 0, act = idx === pos;
    $('qsheet-move-up').style.display = idx <= pos + 1 ? 'none' : '';
    $('qsheet-move-down').style.display = idx >= ts.length - 1 ? 'none' : '';
    $('qsheet-play-now').style.display = act ? 'none' : '';
    $('qsheet-remove').style.display = act ? 'none' : '';
    $('np-queue-item-sheet')?.classList.add('open');
  });

  $('qsheet-play-now')?.addEventListener('click', () => { if (_qIdx >= 0) { Player.playFromQueue(_qIdx); _closeQS(); } });
  $('qsheet-move-up')?.addEventListener('click', () => {
    if (_qIdx < 0) return; const pos = State.get('player.queuePosition') || 0;
    if (_qIdx <= pos + 1) { UI.toast('Already at the top'); _closeQS(); return; }
    Queue.reorder(_qIdx, _qIdx - 1); _closeQS(); _refQ();
  });
  $('qsheet-move-down')?.addEventListener('click', () => {
    if (_qIdx < 0) return; const ts = State.get('queue.tracks') || [];
    if (_qIdx >= ts.length - 1) { UI.toast('Already at the bottom'); _closeQS(); return; }
    Queue.reorder(_qIdx, _qIdx + 1); _closeQS(); _refQ();
  });
  $('qsheet-remove')?.addEventListener('click', () => { if (_qIdx >= 0) { Queue.remove(_qIdx); _closeQS(); _refQ(); } });
  $('np-queue-clear-btn')?.addEventListener('click', () => { Queue.clear(); _refQ(); UI.toast('Queue cleared'); });
}
