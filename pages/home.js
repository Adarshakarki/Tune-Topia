import * as UI from '../app/ui.js'
import State from '../app/state.js'
import History from '../modules/history.js'
import { playTrack } from '../app/playback.js'
import { searchTracks, getPlaylist, searchArtists, getTrackRecommendations } from '../api/index.js'
import { searchVideos } from '../api/index.js'
import { searchPlaylists } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import { getHomeQueries } from '../modules/recommendations.js'
import { PLAYLIST_QUERIES } from '../app/constants.js'
import * as PlaylistPage from './playlist.js'
import * as AlbumPage from './album.js'

const $ = (id) => document.getElementById(id)
const NEW_RELEASES_PLAYLIST_ID = '1b418bb8-90a7-4f87-901d-707993838346'

const _recs = (id) => getTrackRecommendations(id).then(rs => rs.length && import('../modules/queue.js').then(Q => rs.forEach(r => Q.default.add(r))));

export async function load() {
  const tEl = $('home-tracks'), nRow = $('home-new-row'), pRow = $('home-playlists-row');
  UI.renderHeroSkeleton();
  if (tEl) tEl.innerHTML = UI.skeletons(10);
  if (nRow) nRow.innerHTML = UI.skeletons(6, 'horiz');
  if (pRow) pRow.innerHTML = UI.skeletons(6, 'horiz');

  const h = History.getAll();
  if (h.length && $('home-recent-section')) { $('home-recent-section').style.display = 'block'; $('home-recent-row').innerHTML = UI.skeletons(6, 'horiz'); }

  const [newTs, recTs] = await Promise.all([_fetchNew(), _fetchRecs()]);

  try {
    if (recTs.length) UI.renderHero(recTs[0]);
    if (nRow) { UI.renderHorizCards(newTs, nRow); attachHorizEvents(nRow); }

    const h = History.getAll(), rSec = $('home-recent-section'), rRow = $('home-recent-row');
    if (h.length && rSec && rRow) { rSec.style.display = ''; UI.renderHorizCards(h, rRow); attachHorizEvents(rRow); }

    if (tEl) { UI.renderTracks(recTs.slice(0, 10), tEl, null); attachTrackEvents(tEl); }

    // Ensure layout stability: Only show conditional sections after content is ready
    [
      { id: 'home-recent-section', data: h },
      { id: 'home-foryou-section', data: recTs.slice(6, 20) }
    ].forEach(s => {
      if (s.data.length && $(s.id)) $(s.id).style.display = 'block';
    });

    _loadForYou(recTs);
    _loadArtists(recTs);
    _loadFeaturedPlaylists()

    $('hero-card')?.addEventListener('click', () => { const t = $('hero-card')?._track; if (t) { playTrack([t], 0); _recs(t.id); } });
    $('home-search-trigger')?.addEventListener('click', () => import('../app/router.js').then(R => { R.showPage('search'); setTimeout(() => $('search-input')?.focus(), 150); }));
  } catch (e) {
    if (tEl) tEl.innerHTML = UI.errorState('Failed to load home content');
  }
}

async function _fetchNew() {
  try { const r = await getPlaylist(NEW_RELEASES_PLAYLIST_ID); if (r.tracks?.length) return r.tracks; } catch {}
  try { const rs = await Promise.allSettled(['new music', 'new albums'].map(q => searchTracks(q).catch(() => []))); return rs.flatMap(r => r.status === 'fulfilled' ? r.value : []); } catch { return []; }
}

async function _fetchRecs() {
  try {
    const { queries, ytFallback } = getHomeQueries(State, History);
    const rs = await Promise.allSettled(queries.map(q => searchTracks(q).catch(() => [])));
    const ts = rs.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    return ts.length ? ts : await searchVideos(ytFallback).catch(() => []);
  } catch { return []; }
}

async function _loadForYou(recTracks) {
  const s = $('home-foryou-section'), r = $('home-foryou-row'); if (!s || !r) return;
  const fy = recTracks.slice(6, 20);
  if (!fy.length) {
    try { const rs = await Promise.allSettled(['indie hits', 'viral songs'].map(q => searchTracks(q).catch(() => []))); const ts = rs.flatMap(x => x.status === 'fulfilled' ? x.value : []); if (ts.length) { s.style.display = ''; UI.renderHorizCards(ts, r); attachHorizEvents(r); } } catch {}
  } else { s.style.display = ''; UI.renderHorizCards(fy, r); attachHorizEvents(r); }
}

async function _loadArtists(recTracks) {
  const s = $('home-artists-section'), r = $('home-artists-row'); if (!s || !r) return;
  const seen = new Set(), arts = [];
  
  // Get unique artist names from recommended tracks
  for (const t of recTracks) {
    if (!t.artist) continue;
    const names = t.artist.split(',').map(n => n.trim());
    for (const name of names) {
      if (name && !seen.has(name)) { seen.add(name); arts.push(name); }
      if (arts.length >= 10) break;
    }
    if (arts.length >= 10) break;
  }
  if (!arts.length) return;

  // Fetch actual artist profile data to get real profile images instead of song covers
  const artistProfiles = await Promise.all(arts.map(async (name) => {
    try {
      const results = await searchArtists(name);
      return results.find(a => a.name.toLowerCase() === name.toLowerCase()) || results[0] || { name, cover: '' };
    } catch { return { name, cover: '' }; }
  }));

  s.style.display = '';
  r.innerHTML = artistProfiles.filter(Boolean).map((a, i) => `
    <div class="horiz-card artist-pill" data-index="${i}">
      <div class="artist-pill-img"><img src="${a.cover || ''}" alt="" onerror="this.style.display='none'"/><div class="artist-pill-fallback"><i class="bi bi-person-fill"></i></div></div>
      <div class="horiz-title">${escHtml(a.name)}</div>
    </div>`).join('');

  r.querySelectorAll('.artist-pill').forEach((pill, i) => {
    const profile = artistProfiles[i];
    if (profile) pill.addEventListener('click', () => import('./artist.js').then(m => m.open(profile)));
  });
}

async function _loadFeaturedPlaylists() {
  const r = $('home-playlists-row'); if (!r) return;
  r.innerHTML = PLAYLIST_QUERIES.map((q, i) => `
    <div class="horiz-card playlist-card" data-pl-index="${i}">
      <div class="horiz-art skeleton" style="border-radius:var(--r-sm)"></div>
      <div class="horiz-title">${q}</div>
      <div class="horiz-sub">Loading…</div>
    </div>`).join('');
  const rs = await Promise.allSettled(PLAYLIST_QUERIES.map(q => searchPlaylists(q, 1)));
  const resolved = rs.map(x => (x.status === 'fulfilled' && x.value?.[0]) || null).filter(Boolean);
  if (!resolved.length) return r.innerHTML = '<div class="empty"><i class="bi bi-collection"></i><p>No playlists found</p></div>';
  r.innerHTML = resolved.map((pl, i) => `
    <div class="horiz-card playlist-card" data-pl-index="${i}">
      <img class="horiz-art" src="${pl.cover || ''}" onerror="this.style.background='var(--surface-2)'" alt=""/>
      <div class="horiz-title">${escHtml(pl.title)}</div>
      <div class="horiz-sub">${pl.trackCount ? pl.trackCount + ' tracks' : pl.description || ''}</div>
    </div>`).join('');
  r.querySelectorAll('.playlist-card').forEach(c => c.addEventListener('click', () => { const pl = resolved[+c.dataset.plIndex]; if (pl) PlaylistPage.open(pl); }));
  $('home-playlists-see-all')?.addEventListener('click', function() { const exp = r.classList.toggle('horiz-expanded'); this.textContent = exp ? 'See less' : 'See all'; });
}

export function attachTrackEvents(c) {
  c.querySelectorAll('[data-index]').forEach(w => {
    const card = w.querySelector('.track-card'); if (!card) return;
    card.addEventListener('click', () => playTrack(c._tracks, +w.dataset.index));
    w.querySelector('.track-like-btn')?.addEventListener('click', e => { e.stopPropagation(); import('../app/likes.js').then(m => m.onLike(c._tracks[+w.dataset.index])); });
  });
}

export function attachHorizEvents(c) {
  c.querySelectorAll('.horiz-card').forEach(card => card.addEventListener('click', () => { const t = c._tracks?.[+card.dataset.index]; if (t) { playTrack([t], 0); _recs(t.id); } }));
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
