// modules/search.js

import State from '../app/state.js';
import {
  searchTracks,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchTidalVideos,
} from '../api/index.js';
import { searchVideos } from '../api/index.js';

function _setLoading(val) {
  State.set('search.isLoading', val);
}
function _detectTopResult(tracks) {
  return tracks.length ? tracks[0] : null;
}

export async function runSearch(query, tab = 'music') {
  if (!query.trim()) return;
  State.set('search.query', query);
  State.set('search.activeTab', tab);
  _setLoading(true);
  try {
    let results = [];
    if (tab === 'music') {
      try {
        results = await searchTracks(query);
      } catch {}
      if (!results.length) results = await searchVideos(query);
      State.set('search.topResult', _detectTopResult(results));
    } else if (tab === 'video') {
      // Tidal videos (api.monochrome.tf only) + YouTube in parallel
      const [tidal, yt] = await Promise.allSettled([
        searchTidalVideos(query),
        searchVideos(query),
      ]);
      const tidalResults = tidal.status === 'fulfilled' ? tidal.value : [];
      const ytResults = yt.status === 'fulfilled' ? yt.value : [];
      results = [...tidalResults, ...ytResults];
      State.set('search.topResult', null);
    } else if (tab === 'albums') {
      results = await searchAlbums(query);
      State.set('search.topResult', null);
    } else if (tab === 'artists') {
      results = await searchArtists(query);
      State.set('search.topResult', null);
    } else if (tab === 'playlists') {
      results = await searchPlaylists(query);
      State.set('search.topResult', null);
    }
    State.set('search.results', results);
  } catch {
    State.set('search.results', []);
    State.set('search.topResult', null);
  } finally {
    _setLoading(false);
  }
}

export function setMood(mood) {
  State.set('search.mood', mood);
}

export function clearSearch() {
  State.set('search.query', '');
  State.set('search.results', []);
  State.set('search.topResult', null);
  State.set('search.isLoading', false);
  State.set('search.mood', null);
}

export function setTab(tab) {
  State.set('search.activeTab', tab);
  const query = State.get('search.query');
  if (query) runSearch(query, tab);
}
