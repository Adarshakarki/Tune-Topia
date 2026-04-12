// Album
import { getAlbumTracks, searchTracks, searchVideos } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import * as UI from '../app/ui.js'
import { toggle, has } from '../modules/likedSongs.js'
import { toggleAlbum, hasAlbum } from '../modules/library.js'
import Queue from '../modules/queue.js'
import * as Player from '../modules/player.js'
import * as BulkDownloader from '../modules/bulkdownloader.js'

const $ = (id) => document.getElementById(id)

let _album = null, _tracks = [], _sheetTrack = null, _playFn = null;

// Init
export function init(playTrackFn) {
  _playFn = playTrackFn;
  $('album-back-btn')?.addEventListener('click', close);

  const _toggle = () => { if (_album) { toggleAlbum(_album); _syncLike(); } };
  $('album-save-btn')?.addEventListener('click', _toggle);
  $('album-hero-like')?.addEventListener('click', _toggle);

  $('album-play-all')?.addEventListener('click', () => _tracks.length && (_playFn(_tracks, 0), close()));
  $('album-shuffle')?.addEventListener('click', () => {
    if (!_tracks.length) return;
    _playFn(_tracks, Math.floor(Math.random() * _tracks.length));
    Player.toggleShuffle(); close();
  });

  $('album-download')?.addEventListener('click', () => {
    if (_tracks.length) BulkDownloader.downloadTracks(_tracks, _album?.title);
    else UI.toast('Wait for tracks to load...');
  });

  // Sheet
  $('album-track-sheet-overlay')?.addEventListener('click', _closeSheet);
  $('album-sheet-play-next')?.addEventListener('click', () => { if (_sheetTrack) { Queue.addNext(_sheetTrack); _closeSheet(); } });
  $('album-sheet-add-queue')?.addEventListener('click', () => { if (_sheetTrack) { Queue.add(_sheetTrack); _closeSheet(); } });
  $('album-sheet-like')?.addEventListener('click', () => { if (_sheetTrack) { toggle(_sheetTrack); _syncSheetLike(); _closeSheet(); } });
  $('album-sheet-share')?.addEventListener('click', () => {
    if (!_sheetTrack) return;
    const u = _sheetTrack.source === 'youtube' ? `https://youtu.be/${_sheetTrack.id}` : `https://tidal.com/track/${_sheetTrack.id}`;
    if (navigator.share) navigator.share({ title: `${_sheetTrack.title} — ${_sheetTrack.artist}`, url: u });
    else navigator.clipboard.writeText(u);
    _closeSheet();
  });
}

export async function open(album) {
  _album = album; _tracks = [];
  const page = $('page-album'); if (!page) return;

  _applyColor(30, 28, 38);
  _setHeader(album);
  _syncLike();
  $('album-tracklist').innerHTML = _skeleton();
  page.classList.add('open');
  document.body.style.overflow = 'hidden';

  const Router = await import('../app/router.js');
  const slug = (album.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  Router.updateURL('album', { ...album, album: slug });

  UI.updatePlayerPosition();

  if (album.cover) UI.extractColor(album.cover, (r, g, b) => _applyColor(r, g, b));

  try {
    let ts = [];
    if (album.id) { try { ts = await getAlbumTracks(album.id); } catch {} }
    if (!ts.length) { try { ts = await searchTracks(`${album.title} ${album.artist || ''}`); } catch {} }

    const seen = new Set();
    _tracks = ts.filter(t => { const k = `${t.title}|${t.artist}`.toLowerCase(); return !seen.has(k) && seen.add(k); });

    _renderTracklist(_tracks);
    _setMeta(album, _tracks);
    _syncLike();
  } catch {
    $('album-tracklist').innerHTML = '<div class="empty"><i class="bi bi-wifi-off"></i><p>Failed to load</p></div>';
  }
}

export function close() {
  $('page-album')?.classList.remove('open', 'stacked');
  document.body.style.overflow = '';
  UI.revertThemeColor();
  UI.updatePlayerPosition();
}

// Utils
function _applyColor(r, g, b) {
  const dr = Math.round(r * 0.95), dg = Math.round(g * 0.95), db = Math.round(b * 0.95);
  const page = $('page-album'); if (!page) return;
  const dark = `rgb(${dr},${dg},${db})`;
  page.style.setProperty('--alb-dark', dark);
  page.style.setProperty('--alb-accent', `rgb(${r},${g},${b})`);
  page.style.background = dark;
  page.setAttribute('data-light', 0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false');
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', dark);
}

function _setHeader(a) {
  const art = a.cover || '';
  $('album-hero-art').src = art;
  $('album-hero-title').textContent = a.title || '';
  $('album-hero-artist').textContent = a.artist || '';
  $('album-hero-meta').textContent = a.year ? String(a.year) : '';
  [$('album-hero-img-left'), $('album-hero-img-right')].forEach(el => el && (el.src = art));
  const bg = $('album-hero-bg'); if (bg && art) bg.style.backgroundImage = `url('${art}')`;
}

function _setMeta(a, ts) {
  const totalSeconds = ts.reduce((acc, t) => {
    const p = (t.dur || '0:00').split(':').map(Number);
    if (p.length >= 3) return acc + (p[0] * 3600 + p[1] * 60 + p[2]);
    if (p.length === 2) return acc + (p[0] * 60 + p[1]);
    return acc + (p[0] || 0);
  }, 0);
  const mins = Math.floor(totalSeconds / 60);
  const p = []; if (a.year) p.push(String(a.year));
  p.push(`${ts.length} songs`); if (mins) p.push(`${mins} min`);
  $('album-hero-meta').textContent = p.join(' · ');
}

function _syncLike() {
  const saved = hasAlbum(_album?.id);
  const btn = $('album-hero-like');
  if (btn) {
    btn.innerHTML = UI.getIcon(saved ? 'heartFill' : 'heart');
    btn.classList.toggle('liked', saved);
  }
  $('album-save-btn')?.classList.toggle('saved', saved);
}

function _renderTracklist(ts) {
  const el = $('album-tracklist'); if (!el) return;
  if (!ts.length) return el.innerHTML = '<div class="empty"><i class="bi bi-music-note-beamed"></i><p>No tracks found</p></div>';

  el.innerHTML = ts.map((t, i) => `
    <div class="alb-track" data-index="${i}" data-tid="${escHtml(t.id)}">
      <span class="alb-track-num">${i + 1}</span>
      <div class="alb-track-info">
        <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ' <span class="explicit-tag">E</span>' : ''}</div>
        <div class="alb-track-artist">${escHtml(t.artist || '')}</div>
      </div>
      <span class="alb-track-dur">${t.dur || ''}</span>
      <button class="alb-track-more" data-index="${i}">${UI.getIcon('more')}</button>
    </div>`).join('');

  el.querySelectorAll('.alb-track').forEach(row => {
    row.addEventListener('click', e => !e.target.closest('.alb-track-more') && _playFn(_tracks, +row.dataset.index));
  });
  el.querySelectorAll('.alb-track-more').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); _openSheet(_tracks[+btn.dataset.index]); });
  });
}

function _openSheet(t) {
  _sheetTrack = t;
  const p = $('album-sheet-preview');
  if (p && t) p.innerHTML = `<img src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt=""/><div><div class="bs-title">${escHtml(t.title)}</div><div class="bs-artist">${escHtml(t.artist || '')}</div></div>`;
  _syncSheetLike();
  $('album-track-sheet')?.classList.add('open');
}

const _closeSheet = () => { $('album-track-sheet')?.classList.remove('open'); _sheetTrack = null; };

function _syncSheetLike() {
  if (!$('album-sheet-like') || !_sheetTrack) return;
  const l = has(_sheetTrack.id);
  $('album-sheet-like').innerHTML = `<i class="bi ${l ? 'bi-heart-fill' : 'bi-heart'}"></i> ${l ? 'Unlike' : 'Like'}`;
}

const _skeleton = () => Array(10).fill(0).map((_, i) => `
  <div class="alb-track alb-track-skel">
    <span class="alb-track-num">${i + 1}</span>
    <div class="alb-track-info">
      <div class="skeleton" style="height:13px;width:${50 + Math.random() * 35}%;border-radius:6px;margin-bottom:6px"></div>
      <div class="skeleton" style="height:11px;width:${25 + Math.random() * 20}%;border-radius:6px"></div>
    </div>
  </div>`).join('');
