import State from '../app/state.js'
import {
  searchTracks, searchAlbums, searchArtists, searchPlaylists, 
  searchTidalVideos, searchVideos
} from '../api/index.js';

const _setLoading = (v) => State.set('search.isLoading', v);
const _top = (ts) => ts?.[0] || null;

let _timer = null;
const DELAY = 300;

export async function runSearch(query, tab = 'music') {
  if (!query.trim()) return;
  State.set('search.query', query);
  State.set('search.activeTab', tab);
  _setLoading(true);

  try {
    let res = [];
    if (tab === 'music') {
      res = await searchTracks(query).catch(() => []);
      State.set('search.topResult', _top(res));
    } else if (tab === 'video') {
      const [t, y] = await Promise.allSettled([searchTidalVideos(query), searchVideos(query)]);
      res = [...(t.status === 'fulfilled' ? t.value : []), ...(y.status === 'fulfilled' ? y.value : [])];
      State.set('search.topResult', null);
    } else {
      const f = { albums: searchAlbums, artists: searchArtists, playlists: searchPlaylists }[tab];
      if (f) res = await f(query);
      State.set('search.topResult', null);
    }
    State.set('search.results', res);
  } catch {
    State.set('search.results', []);
    State.set('search.topResult', null);
  } finally { _setLoading(false); }
}

export function debouncedSearch(query, tab = 'music') {
  clearTimeout(_timer);
  State.set('search.query', query);
  if (!query.trim()) return _setLoading(false);
  _setLoading(true);
  _timer = setTimeout(() => runSearch(query, tab), DELAY);
}

export const setMood = (m) => State.set('search.mood', m);

export function clearSearch() {
  clearTimeout(_timer);
  State.set('search.query', ''); State.set('search.results', []); State.set('search.topResult', null);
  State.set('search.isLoading', false); State.set('search.mood', null);
}

export function setTab(tab) {
  State.set('search.activeTab', tab);
  const q = State.get('search.query');
  if (q) debouncedSearch(q, tab);
}