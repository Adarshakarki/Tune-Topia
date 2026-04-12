// Mix
import State from '../app/state.js';
import { getMix, getTrackById } from '../api/services/tidal.service.js';
import { escHtml } from '../api/utils.js';
import * as UI from '../app/ui.js';
import * as Player from '../modules/player.js';
import * as BulkDownloader from '../modules/bulkdownloader.js';

const $ = (id) => document.getElementById(id);

let _mix = null;
let _tracks = [];
let _playFn = null;
let _loadingId = null;

// Events
export function init(playTrackFn) {
  _playFn = playTrackFn;

  $('mix-back-btn')?.addEventListener('click', close);

  $('mix-play-all')?.addEventListener('click', () => {
    if (_tracks.length && _playFn) {
      _playFn(_tracks, 0);
      close();
    }
  });

  $('mix-shuffle-btn')?.addEventListener('click', () => {
    if (!_tracks.length) return;
    const randomIndex = Math.floor(Math.random() * _tracks.length);
    _playFn(_tracks, randomIndex);
    Player.setShuffle(true);
    close();
  });

  $('mix-download')?.addEventListener('click', () => {
    if (_tracks.length) {
      BulkDownloader.downloadTracks(_tracks, _mix?.title || 'Mix');
    } else {
      UI.toast('Wait for tracks to load...');
    }
  });
}

// Load
export async function open(trackOrId) {
  const page = $('page-mix');
  if (!page) return;

  const isTrackObject = typeof trackOrId === 'object' && trackOrId !== null;
  const id = isTrackObject ? trackOrId.id : trackOrId;

  _loadingId = id;
  _mix = null;
  _tracks = [];

  UI.applyTheme(State.get('ui.themeMode'));
  $('mix-tracklist').innerHTML = UI.skeletons(10);
  page.classList.add('open');
  document.body.style.overflow = 'hidden';
  UI.updatePlayerPosition();

  try {
    let finalMixId = null;

    if (isTrackObject) {
      finalMixId = trackOrId.mixes?.TRACK_MIX || null;
    }

    if (!finalMixId) {
      if (/^\d+$/.test(id)) {
        const t = await getTrackById(id);
        finalMixId = t.mixes?.TRACK_MIX || null;
      } else {
        finalMixId = id;
      }
    }

    if (_loadingId !== id) return;

    let data;
    if (finalMixId) {
      data = await getMix(finalMixId);
    } else {
      const t = isTrackObject ? trackOrId : await getTrackById(id);
      data = {
        mix: {
          id,
          title: t.title,
          description: t.album?.title || '',
          cover: t.cover,
          coverSmall: t.coverSmall || t.cover,
          trackCount: 1,
          type: 'mix',
        },
        tracks: [t],
      };
    }

    if (_loadingId !== id) return;

    _mix = data.mix;
    _tracks = data.tracks || [];

    if (_mix?.cover) {
      UI.extractColor(_mix.cover, (r, g, b) => _applyColor(r, g, b));
    }

    _renderHeader(_mix);
    _renderTracklist(_tracks);

  } catch (err) {
    if (_loadingId === id) {
      $('mix-tracklist').innerHTML = UI.errorState(
        err.message || 'Failed to load mix',
        () => open(trackOrId)
      );
    }
  }
}

// Close
export function close() {
  _loadingId = null;
  $('page-mix')?.classList.remove('open');
  document.body.style.overflow = '';
  UI.revertThemeColor();
  UI.updatePlayerPosition();
}

function _applyColor(r, g, b) {
  const page = $('page-mix');
  if (!page) return;

  const dr = Math.round(r * 0.95),
        dg = Math.round(g * 0.95),
        db = Math.round(b * 0.95);
  const dark = `rgb(${dr},${dg},${db})`;

  page.style.setProperty('--pl-dark', dark);
  page.style.setProperty('--pl-accent', `rgb(${r},${g},${b})`);
  page.style.background = dark;
  page.setAttribute('data-light', 0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false');
}

function _renderHeader(mix) {
  if ($('mix-hero-art')) $('mix-hero-art').src = mix.cover || '';
  if ($('mix-hero-title')) $('mix-hero-title').textContent = mix.title || 'Mix';
  if ($('mix-hero-desc')) $('mix-hero-desc').textContent = mix.description || '';
  if ($('mix-topbar-title')) $('mix-topbar-title').textContent = mix.title || '';

  const metaEl = $('mix-hero-meta');
  if (metaEl) metaEl.textContent = `${_tracks.length} tracks`;
}

function _renderTracklist(tracks) {
  const container = $('mix-tracklist');
  if (!container) return;

  const processedTracks = tracks.map(t => ({
    ...t,
    isUnavailable: t.streamReady === false || t.allowStreaming === false
  }));

  UI.renderTracks(processedTracks, container, Player.getCurrentTrack()?.id);

  container.querySelectorAll('.track-card').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.track-more-btn')) {
        _playFn(processedTracks, +row.dataset.index);
      }
    });
  });

  container.querySelectorAll('.track-more-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const track = processedTracks[+btn.closest('[data-index]').dataset.index];
      if (track) UI.openMoreSheet(track);
    });
  });
}