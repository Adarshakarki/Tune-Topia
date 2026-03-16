// pages/library.js

import * as UI from '../app/ui.js';
import State from '../app/state.js';
import History from '../modules/history.js';
import * as Playlists from '../modules/playlists.js';
import { playTrack } from '../app/playback.js';
import { updateLikedCount } from '../app/likes.js';
import { searchTracks, getPlaylist } from '../api/index.js';
import { searchVideos } from '../api/index.js';
import {
  attachTrackEvents,
  attachAlbumEvents,
  attachAlbumAsTrackEvents,
  attachHorizEvents,
} from './home.js';
import * as AlbumPage from './album.js';

const $ = (id) => document.getElementById(id);
const NEW_RELEASES_PLAYLIST_ID = '1b418bb8-90a7-4f87-901d-707993838346';

let _albumSort = 'recent'; // 'recent' | 'az' | 'artist'
let _artistSort = 'recent'; // 'recent' | 'az'

export function render() {
  updateLikedCount();

  const followed = State.get('library.followedArtists') || [];
  const savedAlbums = State.get('library.savedAlbums') || [];

  const artistLabel = $('followed-artists-label');
  if (artistLabel)
    artistLabel.textContent = `${followed.length} artist${followed.length !== 1 ? 's' : ''}`;

  const albumsLabel = $('saved-albums-label');
  if (albumsLabel)
    albumsLabel.textContent = `${savedAlbums.length} album${savedAlbums.length !== 1 ? 's' : ''}`;

  const hist = History.getAll();
  const recentSec = $('lib-recent-section');
  const recentRow = $('lib-recent-row');
  if (hist.length && recentSec && recentRow) {
    recentSec.style.display = '';
    UI.renderHorizCards(hist, recentRow);
    attachHorizEvents(recentRow);
  }

  const plCount = Playlists.getAll().length;
  const plLabel = $('playlists-count-label');
  if (plLabel)
    plLabel.textContent = `${plCount} playlist${plCount !== 1 ? 's' : ''}`;
}

export async function loadNew() {
  const el = $('new-grid');
  if (!el) return;
  el.innerHTML = UI.skeletonsGrid();
  try {
    const result = await getPlaylist(NEW_RELEASES_PLAYLIST_ID);
    const tracks = result.tracks || [];
    if (!tracks.length) throw new Error('Empty');
    UI.renderAlbums(
      tracks.map((t) => ({ cover: t.cover, title: t.title, artist: t.artist })),
      el,
    );
    el._albums = tracks;
    attachAlbumAsTrackEvents(el, tracks);
  } catch {
    try {
      const results = await Promise.allSettled(
        ['Sabrina Carpenter', 'Billie Eilish', 'SZA', 'Bad Bunny'].map((q) =>
          searchTracks(q).catch(() => []),
        ),
      );
      let tracks = results.flatMap((r) =>
        r.status === 'fulfilled' ? r.value : [],
      );
      if (!tracks.length)
        tracks = await searchVideos('new music 2025').catch(() => []);
      if (!tracks.length) throw new Error('No results');
      UI.renderAlbums(
        tracks.map((t) => ({
          cover: t.cover,
          title: t.title,
          artist: t.artist,
        })),
        el,
      );
      el._albums = tracks;
      attachAlbumAsTrackEvents(el, tracks);
    } catch (e) {
      el.innerHTML = UI.errorState('Could not load new releases', loadNew);
    }
  }
}

export function loadAlbums() {
  const el = $('albums-grid');
  if (!el) return;
  const albums = [...(State.get('library.savedAlbums') || [])];

  if (!albums.length) {
    el.innerHTML = UI.emptyState(
      'bi-disc-fill',
      'No saved albums',
      'Tap ♡ on any album to save it',
    );
    return;
  }

  // Sort
  if (_albumSort === 'az')
    albums.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  else if (_albumSort === 'artist')
    albums.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
  // 'recent' = saved order (reversed, newest first)
  else albums.reverse();

  _updateSortChips('albums-sort-chips', _albumSort);
  UI.renderAlbums(albums, el);
  el._albums = albums;
  attachAlbumEvents(el);

  // Wire sort chips
  document.querySelectorAll('#albums-sort-chips .sort-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      _albumSort = btn.dataset.sort;
      loadAlbums();
    });
  });
}

export function loadArtists() {
  const el = $('artists-grid');
  if (!el) return;
  const artists = [...(State.get('library.followedArtists') || [])];

  if (!artists.length) {
    el.innerHTML = UI.emptyState(
      'bi-people-fill',
      'No followed artists',
      'Follow artists to see them here',
    );
    return;
  }

  // Sort
  if (_artistSort === 'az')
    artists.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else artists.reverse();

  _updateSortChips('artists-sort-chips', _artistSort);
  UI.renderArtists(artists, el);
  import('./home.js').then((m) => m.attachArtistEvents(el));

  // Wire sort chips
  document.querySelectorAll('#artists-sort-chips .sort-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      _artistSort = btn.dataset.sort;
      loadArtists();
    });
  });
}

export async function loadSongs() {
  const el = $('songs-list');
  if (!el) return;
  el.innerHTML = UI.skeletons();
  try {
    const results = await Promise.allSettled(
      ['Ariana Grande', 'Post Malone', 'Doja Cat', 'Travis Scott'].map((q) =>
        searchTracks(q).catch(() => []),
      ),
    );
    let tracks = results.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : [],
    );
    if (!tracks.length)
      tracks = await searchVideos('popular songs').catch(() => []);
    if (!tracks.length) throw new Error('No results');
    UI.renderTracks(tracks, el, null);
    attachTrackEvents(el);
  } catch {
    el.innerHTML = UI.errorState('Could not load songs', loadSongs);
  }
}

export function loadHistory() {
  const el = $('history-list');
  if (!el) return;
  const hist = History.getAll();
  if (!hist.length) {
    el.innerHTML = UI.emptyState(
      'bi-clock-history',
      'No history yet',
      'Play some music to see it here',
    );
    return;
  }
  UI.renderTracks(hist, el, null);
  attachTrackEvents(el);
}

export function loadRecent() {
  const el = $('recent-grid');
  if (!el) return;
  const hist = History.getAll();
  if (!hist.length) {
    el.innerHTML = UI.emptyState('bi-clock-history', 'Nothing played yet');
    return;
  }
  UI.renderAlbums(
    hist.map((t) => ({ cover: t.cover, title: t.title, artist: t.artist })),
    el,
  );
  el._albums = hist;
  attachAlbumAsTrackEvents(el, hist);
}

function _updateSortChips(rowId, activeSort) {
  document.querySelectorAll(`#${rowId} .sort-chip`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sort === activeSort);
  });
}
