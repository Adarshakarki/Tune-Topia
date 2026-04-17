// Home
import * as UI from '../app/ui.js'
import State from '../app/state.js'
import History from '../modules/history.js'
import * as Cache from '../modules/cache.js'
import { playTrack } from '../app/playback.js'
import { searchTracks, getPlaylist, searchArtists, getTrackRecommendations, searchAlbums, searchVideos, searchPlaylists, searchTidalVideos } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import { getHomeQueries } from '../modules/recommendations.js'
import { PLAYLIST_QUERIES } from '../app/constants.js'
import * as PlaylistPage from './playlist.js'
import * as AlbumPage from './album.js'
import * as Playlists from '../modules/playlists.js'
import * as VideoPage from './video.js'
import * as UserPlaylistPage from './userplaylist.js'

let _homeCachedData = null;
const $ = (id) => document.getElementById(id)
const NEW_RELEASES_PLAYLIST_ID = '1b418bb8-90a7-4f87-901d-707993838346'
const ARTIST_CACHE_TTL = 3600000; // 1 hour

const _recs = (id) => getTrackRecommendations(id).then(rs => rs.length && import('../modules/queue.js').then(Q => rs.forEach(r => Q.default.add(r))));

const _interleave = (results) => {
  const ts = [], seen = new Set();
  const maxLen = Math.max(0, ...results.map(r => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (const res of results) {
      if (res[i] && !seen.has(res[i].id)) {
        seen.add(res[i].id);
        ts.push(res[i]);
      }
    }
  }
  return ts;
};

export async function load() {
  const tEl = $('home-tracks'), nRow = $('home-new-row'), pRow = $('home-playlists-row'), fRow = $('home-foryou-row'), aRow = $('home-artists-row'), albRow = $('home-albums-row'), vidRow = $('home-videos-row'), uplRow = $('home-user-playlists-row'), mRow = $('home-mixes-row');
  const rRow = $('home-recent-row'), rSec = $('home-recent-section'), uSec = $('home-user-playlists-section');
  const { queries, ytFallback } = getHomeQueries(State, History);

  // Sync check for local data to prevent layout shift before first paint
  const h = History.getAll();
  const up = Playlists.getAll();
  if (rSec) rSec.style.display = h.length ? '' : 'none';
  if (uSec) uSec.style.display = up.length ? '' : 'none';

  if (_homeCachedData) {
    _renderFromData(_homeCachedData);
    _performFetch(queries, ytFallback);
    return;
  }

  UI.renderHeroSkeleton();
  if (tEl) tEl.innerHTML = UI.skeletons(20);
  if (nRow) nRow.innerHTML = UI.skeletons(6, 'horiz');
  if (pRow) pRow.innerHTML = UI.skeletons(6, 'horiz');
  if (fRow) fRow.innerHTML = UI.skeletons(6, 'horiz');
  if (mRow) mRow.innerHTML = UI.skeletons(6, 'horiz');
  if (aRow) aRow.innerHTML = UI.skeletons(6, 'horiz');
  if (albRow) albRow.innerHTML = UI.skeletons(6, 'horiz');
  if (vidRow) vidRow.innerHTML = UI.skeletons(6, 'video');
  if (uplRow) uplRow.innerHTML = UI.skeletons(4, 'horiz');
  if (rRow) rRow.innerHTML = UI.skeletons(6, 'horiz');
  
  _performFetch(queries, ytFallback);
}

async function _performFetch(queries, ytFallback) {
  const tEl = $('home-tracks'), nRow = $('home-new-row'), rRow = $('home-recent-row');
  const h = History.getAll();

  // Render local history immediately to improve perceived performance and LCP
  if (h.length && rRow) { 
    UI.renderHorizCards(h, rRow); 
    attachHorizEvents(rRow); 
  }

  // Decouple fetches to allow the Hero (LCP element) to render as soon as it is ready
  const newPromise = _fetchNew();
  const recsPromise = _fetchRecs(queries, ytFallback);

  recsPromise.then(recTs => {
    if (recTs.length) {
      _homeCachedData = { ...(_homeCachedData || {}), recTs };
      UI.renderHero(recTs[0]);
      if (tEl) { UI.renderTracks(recTs.slice(0, 20), tEl, null); attachTrackEvents(tEl); }
      _loadArtists(recTs);
      _loadForYou(recTs);

      $('hero-card')?.addEventListener('click', () => { 
        const t = $('hero-card')?._track; 
        if (t) { playTrack([t], 0); _recs(t.id); } 
      });
    }
    // Load secondary content after primary recs are handled
    _loadUserPlaylists();
    _loadMixes(queries);
    _loadRecommendedAlbums(queries);
    _loadRecommendedVideos(queries);
    _loadFeaturedPlaylists();
  }).catch(() => {
    if (tEl) tEl.innerHTML = UI.errorState('Failed to load recommended content');
  });

  newPromise.then(newTs => {
    if (nRow) { 
      _homeCachedData = { ...(_homeCachedData || {}), newTs };
      UI.renderHorizCards(newTs, nRow); 
      attachHorizEvents(nRow); 
    }
  }).catch(() => {});

  $('home-search-trigger')?.addEventListener('click', () => import('../app/router.js').then(R => { R.showPage('search'); setTimeout(() => $('search-input')?.focus(), 150); }));
}

function _renderFromData(data) {
  const tEl = $('home-tracks'), nRow = $('home-new-row');
  if (data.recTs?.length) {
    UI.renderHero(data.recTs[0]);
    if (tEl) { UI.renderTracks(data.recTs.slice(0, 20), tEl, null); attachTrackEvents(tEl); }
    _loadArtists(data.recTs);
    _loadForYou(data.recTs);
    $('hero-card')?.addEventListener('click', () => { 
      const t = $('hero-card')?._track; 
      if (t) { playTrack([t], 0); _recs(t.id); } 
    });
  }
  if (data.newTs?.length && nRow) {
    UI.renderHorizCards(data.newTs, nRow);
    attachHorizEvents(nRow);
  }
}

async function _fetchNew() {
  try { const r = await getPlaylist(NEW_RELEASES_PLAYLIST_ID); if (r.tracks?.length) return r.tracks; } catch {}
  try { 
    const rs = await Promise.allSettled(['new music', 'new albums'].map(q => searchTracks(q).catch(() => []))); 
    const results = rs.map(r => r.status === 'fulfilled' ? r.value : []);
    return _interleave(results);
  } catch { return []; }
}

async function _fetchRecs(queries, ytFallback) {
  try {
    const rs = await Promise.allSettled(queries.map(q => searchTracks(q).catch(() => [])));
    const results = rs.map(r => r.status === 'fulfilled' ? r.value : []);
    return _interleave(results);
  } catch { return []; }
}

function _loadUserPlaylists() {
  const s = $('home-user-playlists-section'), r = $('home-user-playlists-row');
  if (!s || !r) return;
  const all = Playlists.getAll(); // Fetches user-created/saved playlists
  if (all.length) {
    s.style.display = '';
    r.innerHTML = all.slice(0, 12).map(pl => `
      <div class="horiz-card user-pl-card" data-id="${pl.id}">
        <div class="horiz-art-wrap">
          <div class="horiz-art" style="${pl.cover ? `background-image:url('${escHtml(pl.cover)}');background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#5b21b6,#7c3aed);display:flex;align-items:center;justify-content:center'}">
            ${pl.cover ? '' : UI.getIcon('queue')}
          </div>
        </div>
        <div class="horiz-title">${escHtml(pl.name)}</div>
        <div class="horiz-artist">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}</div>
      </div>`).join('');
    r.querySelectorAll('.user-pl-card').forEach(c => c.addEventListener('click', () => import('../app/router.js').then(R => R.showPage('user-playlist', true, {id: c.dataset.id}))));
  } else {
    s.style.display = 'none';
  }
}

async function _loadMixes(queries = []) {
  const s = $('home-mixes-section'), r = $('home-mixes-row');
  if (!s || !r) return;
  try {
    // Broaden search queries to increase hit rate
    const searchQueries = queries.length > 0 
      ? [ `${queries[0]} Mix`, queries[1] ? `${queries[1]} Mix` : 'Daily Mix', 'Discovery Mix' ]
      : ['My Mix', 'Daily Mix', 'Discovery Mix', 'Editorial Mix'];

    const rs = await Promise.allSettled(searchQueries.map(q => searchPlaylists(q, 8)));
    let mixes = _interleave(rs.map(r => r.status === 'fulfilled' ? r.value : []));

    // Fallback: If personalized searches yield nothing, fetch generic mixes
    if (!mixes.length) {
      mixes = await searchPlaylists('Mix', 12).catch(() => []);
    }

    if (mixes.length) {
      _homeCachedData = { ...(_homeCachedData || {}), mixes };
      s.style.display = '';
      UI.renderHorizCards(mixes, r);
      r.querySelectorAll('.horiz-card').forEach((el, i) => el.addEventListener('click', () => import('../app/router.js').then(R => R.showPage('playlist', true, mixes[i]))));
    } else s.style.display = 'none';
  } catch { s.style.display = 'none'; }
}

async function _loadRecommendedAlbums(queries) {
  const s = $('home-albums-section'), r = $('home-albums-row');
  if (!s || !r) return;
  try {
    const albums = await searchAlbums(queries[0] || 'new albums');
    if (albums.length) {
      _homeCachedData = { ...(_homeCachedData || {}), albums };
      s.style.display = '';
      UI.renderHorizCards(albums.slice(0, 15), r);
      r.querySelectorAll('.horiz-card').forEach((el, i) => el.addEventListener('click', () => import('../app/router.js').then(R => R.showPage('album', true, albums[i]))));
    } else s.style.display = 'none';
  } catch { s.style.display = 'none'; }
}

async function _loadRecommendedVideos(queries) {
  const s = $('home-videos-section'), r = $('home-videos-row');
  if (!s || !r) return;
  try {
    const mainQuery = queries[1] || queries[0] || 'music videos';
    let vids = await searchTidalVideos(mainQuery).catch(() => []);
    if (!vids.length && mainQuery !== 'music videos') {
      vids = await searchTidalVideos('music videos').catch(() => []);
    }
    if (vids.length) {
      _homeCachedData = { ...(_homeCachedData || {}), videos : vids };
      s.style.display = '';
      UI.renderHorizCards(vids.slice(0, 15), r, 'video');
      r.querySelectorAll('.horiz-card').forEach((el, i) => el.addEventListener('click', () => VideoPage.open(vids[i])));
    } else s.style.display = 'none';
  } catch { s.style.display = 'none'; }
}

async function _loadForYou(recTracks) {
  const s = $('home-foryou-section'), r = $('home-foryou-row');
  if (!s || !r) return;

  s.style.display = '';

  let tracksToRender = recTracks.slice(6, 20);
  if (!tracksToRender.length) {
    try {
      const rs = await Promise.allSettled(['indie hits', 'viral songs'].map(q => searchTracks(q).catch(() => [])));
      tracksToRender = rs.flatMap(x => x.status === 'fulfilled' ? x.value : []);
    } catch {}
  }

  if (tracksToRender.length) { UI.renderHorizCards(tracksToRender, r); attachHorizEvents(r); }
  else { r.innerHTML = UI.emptyState('music', 'No recommendations for you right now'); }
}

async function _loadArtists(recTracks) {
  const s = $('home-artists-section'), r = $('home-artists-row'); if (!s || !r) return;
  const seen = new Set(), arts = [];
  
  // Extraction
  for (const t of recTracks) {
    if (!t.artist) continue;
    const names = t.artist.split(',').map(n => n.trim());
    for (const name of names) {
      if (name && !seen.has(name)) { seen.add(name); arts.push(name); }
      if (arts.length >= 10) break;
    }
    if (arts.length >= 10) break;
  }
  if (!arts.length) {
    s.style.display = 'none'; 
    r.innerHTML = UI.emptyState('person', 'No artists found');
    return;
  }

  // Fetch profiles
  const artistProfiles = await Promise.all(arts.map(async (name) => {
    const cacheKey = `artist_profile:${name.toLowerCase()}`;
    const cached = Cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = await searchArtists(name);
      const profile = results.find(a => a.name.toLowerCase() === name.toLowerCase()) || results[0] || { name, cover: '' };
      Cache.set(cacheKey, profile, ARTIST_CACHE_TTL);
      return profile;
    } catch { return { name, cover: '' }; }
  })).then(profiles => profiles.filter(Boolean));

  s.style.display = '';
  r.innerHTML = artistProfiles.filter(Boolean).map((a, i) => `
    <div class="horiz-card artist-pill" data-index="${i}">
      <div class="artist-pill-img"><img src="${a.cover || ''}" alt="" onerror="this.style.display='none'"/><div class="artist-pill-fallback">${UI.getIcon('person')}</div></div>
      <div class="horiz-title">${escHtml(a.name)}</div>
    </div>`).join('');

  r.querySelectorAll('.artist-pill').forEach((pill, i) => {
    const profile = artistProfiles[i];
    if (profile) pill.addEventListener('click', () => import('./artist.js').then(m => m.open(profile)));
  });
}

async function _loadFeaturedPlaylists() {
  const r = $('home-playlists-row'); if (!r) return;
  const rs = await Promise.allSettled(PLAYLIST_QUERIES.map(q => searchPlaylists(q, 1)));
  const resolved = rs.map(x => (x.status === 'fulfilled' && x.value?.[0]) || null).filter(Boolean);
  if (resolved.length) {
    _homeCachedData = { ...(_homeCachedData || {}), playlists: resolved };
    _renderFeaturedPlaylists(resolved);
  }
}

function _renderFeaturedPlaylists(resolved) {
  const r = $('home-playlists-row'); if (!r) return;
  r.innerHTML = resolved.map((pl, i) => `
    <div class="horiz-card playlist-card" data-pl-index="${i}">
      <div class="horiz-art-wrap">
        <div class="horiz-art" style="${pl.cover ? `background-image:url('${escHtml(pl.cover)}');background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#5b21b6,#7c3aed);display:flex;align-items:center;justify-content:center'}">
          ${pl.cover ? '' : UI.getIcon('queue')}
        </div>
      </div>
      <div class="horiz-title">${escHtml(pl.title)}</div>
      <div class="horiz-sub">${pl.trackCount ? pl.trackCount + ' tracks' : pl.description || ''}</div>
    </div>`).join('');
  r.querySelectorAll('.playlist-card').forEach(c => c.addEventListener('click', () => { const pl = resolved[+c.dataset.plIndex]; if (pl) PlaylistPage.open(pl); }));
  $('home-playlists-see-all')?.addEventListener('click', function() { const exp = r.classList.toggle('horiz-expanded'); this.textContent = exp ? 'See less' : 'See all'; });
}

export function attachTrackEvents(c) {
  c.addEventListener('click', e => {
    const wrap = e.target.closest('[data-index]');
    const likeBtn = e.target.closest('.track-like-btn');
    if (!wrap || !c._tracks) return;
    const idx = +wrap.dataset.index;
    if (likeBtn) {
      e.stopPropagation();
      import('../app/likes.js').then(m => m.onLike(c._tracks[idx]));
    } else {
      playTrack(c._tracks, idx);
    }
  });
}

export function attachHorizEvents(c) {
  c.addEventListener('click', e => {
    const card = e.target.closest('.horiz-card');
    if (card && c._tracks) {
      const item = c._tracks[+card.dataset.index];
      if (!item) return;
      import('../app/router.js').then(R => {
        if (item.type === 'album') R.showPage('album', true, item);
        else if (item.type === 'playlist' || item.type === 'mix') R.showPage('playlist', true, item);
        else if (item.type === 'user-playlist') R.showPage('user-playlist', true, {id: item.id});
        else { playTrack([item], 0); _recs(item.id); }
      });
    }
  });
}

export function attachAlbumEvents(c) {
  c.querySelectorAll('.card-item').forEach(card => card.addEventListener('click', () => { const a = c._albums?.[+card.dataset.index]; if (a) AlbumPage.open(a); }));
}

export function attachAlbumAsTrackEvents(c, ts) {
  c.querySelectorAll('.card-item').forEach(card => card.addEventListener('click', () => playTrack(ts, +card.dataset.index)));
}

export function attachArtistEvents(c) {
  c.querySelectorAll('.card-item').forEach(card => card.addEventListener('click', () => { const a = c._artists?.[+card.dataset.index]; if (a) import('./artist.js').then(m => m.open(a)); }));
}
