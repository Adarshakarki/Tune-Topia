// pages/userplaylist.js

import { escHtml } from '../api/utils.js';
import * as Playlists from '../modules/playlists.js';
import { openTrackSheet } from '../ui/sheets.js';
import { openEditModal } from './playlists-ui.js';

const $ = (id) => document.getElementById(id);

let _playTrack = null;
let _onRemove = null;
let _currentPl = null;
let _uplSort = 'default'; // 'default' | 'az' | 'recent'

export function init(playTrack, onRemove) {
  _playTrack = playTrack;
  _onRemove = onRemove;

  // Expose refresh hook for playlists-ui.js after edit save
  window._uplRefresh = (id) => {
    if (_currentPl?.id === id) {
      _currentPl = Playlists.get(id);
      _render();
    }
  };

  $('upl-back-btn')?.addEventListener('click', close);

  // Edit button — wired here so _currentPl is always current
  $('upl-edit-btn')?.addEventListener('click', () => {
    if (_currentPl) openEditModal(_currentPl.id);
  });

  $('upl-play-all')?.addEventListener('click', () => {
    if (_currentPl?.tracks?.length) _playTrack(_currentPl.tracks, 0);
  });

  $('upl-shuffle-btn')?.addEventListener('click', () => {
    if (!_currentPl?.tracks?.length) return;
    _playTrack(
      [..._currentPl.tracks].sort(() => Math.random() - 0.5),
      0,
    );
  });

  // Sort cycle: Default → A–Z → Recent → Default
  $('upl-sort-label')?.addEventListener('click', () => {
    const opts = ['default', 'az', 'recent'];
    const labels = { default: 'Default', az: 'A–Z', recent: 'Recent' };
    _uplSort = opts[(opts.indexOf(_uplSort) + 1) % opts.length];
    const lbl = $('upl-sort-label');
    if (lbl) lbl.textContent = labels[_uplSort];
    _render();
  });

  // Search filter
  $('upl-filter-input')?.addEventListener('input', _render);
}

export function open(playlistId) {
  const pl = Playlists.get(playlistId);
  if (!pl) return;
  _currentPl = pl;
  _uplSort = 'default';
  const lbl = $('upl-sort-label');
  if (lbl) lbl.textContent = 'Default';
  const inp = $('upl-filter-input');
  if (inp) inp.value = '';
  _render();
  $('page-user-playlist')?.classList.add('open');
}

export function close() {
  $('page-user-playlist')?.classList.remove('open');
  _currentPl = null;
}

function _getFilteredTracks() {
  let tracks = [...(_currentPl?.tracks || [])];
  // Filter
  const q = $('upl-filter-input')?.value.trim().toLowerCase() || '';
  if (q)
    tracks = tracks.filter(
      (t) =>
        t.title?.toLowerCase().includes(q) ||
        t.artist?.toLowerCase().includes(q),
    );
  // Sort
  if (_uplSort === 'az')
    tracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  if (_uplSort === 'recent') tracks.reverse();
  return tracks;
}

function _render() {
  const pl = _currentPl;
  if (!pl) return;

  const topTitle = $('upl-topbar-title');
  if (topTitle) topTitle.textContent = pl.name;

  const heroArt = $('upl-hero-art');
  if (heroArt) {
    heroArt.src = pl.cover || '';
    heroArt.style.display = pl.cover ? 'block' : 'none';
  }
  const heroPlaceholder = $('upl-hero-placeholder');
  if (heroPlaceholder)
    heroPlaceholder.style.display = pl.cover ? 'none' : 'flex';

  const titleEl = $('upl-title'),
    descEl = $('upl-desc'),
    metaEl = $('upl-meta');
  if (titleEl) titleEl.textContent = pl.name;
  if (descEl) descEl.textContent = pl.description || '';
  if (metaEl)
    metaEl.textContent = `${pl.tracks.length} song${pl.tracks.length !== 1 ? 's' : ''}`;

  const listEl = $('upl-tracklist');
  if (!listEl) return;
  const tracks = _getFilteredTracks();

  if (!pl.tracks.length) {
    listEl.innerHTML = `<div class="empty">
      <i class="bi bi-music-note"></i>
      <p>No songs yet</p>
      <small>Add songs from the now playing menu</small>
    </div>`;
    return;
  }

  if (!tracks.length) {
    listEl.innerHTML = `<div class="empty">
      <i class="bi bi-search"></i>
      <p>No results</p>
    </div>`;
    return;
  }

  listEl.innerHTML = tracks
    .map(
      (t, i) => `
    <div class="track-card upl-track" data-index="${i}" data-tid="${escHtml(t.id)}">
      <img class="track-thumb" src="${escHtml(t.cover || '')}" alt="" onerror="this.style.display='none'"/>
      <div class="track-info">
        <div class="track-name">${escHtml(t.title)}</div>
        <div class="track-meta">${escHtml(t.artist)}</div>
      </div>
      <button class="upl-track-more track-more-btn-local">
        <i class="bi bi-three-dots-vertical"></i>
      </button>
    </div>`,
    )
    .join('');

  // Store tracks for refreshActiveTracks
  listEl._tracks = tracks;

  listEl.querySelectorAll('.upl-track').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.upl-track-more')) return;
      _playTrack(tracks, +card.dataset.index);
    });
  });

  listEl.querySelectorAll('.upl-track-more').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.upl-track');
      const idx = +card.dataset.index;
      const track = tracks[idx];
      if (!track) return;
      const origIdx = _currentPl.tracks.findIndex((t) => t.id === track.id);
      openTrackSheet(track, {
        onRemove: () => {
          Playlists.removeTrack(_currentPl.id, track.id);
          _currentPl = Playlists.get(_currentPl.id);
          _render();
          _onRemove?.(_currentPl);
        },
        onMoveUp:
          origIdx > 0
            ? () => {
                Playlists.moveTrack(_currentPl.id, origIdx, origIdx - 1);
                _currentPl = Playlists.get(_currentPl.id);
                _render();
              }
            : null,
        onMoveDown:
          origIdx < _currentPl.tracks.length - 1
            ? () => {
                Playlists.moveTrack(_currentPl.id, origIdx, origIdx + 1);
                _currentPl = Playlists.get(_currentPl.id);
                _render();
              }
            : null,
      });
    });
  });
}
