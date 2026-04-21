// Artist
import { searchArtists, searchTracks, searchAlbums, getArtistTopTracks, getArtistAlbums, searchTidalVideos, searchPlaylists } from '../api/index.js'
import { escHtml } from '../api/utils.js'
import * as UI from '../app/ui.js'
import { toggle, has } from '../modules/likedSongs.js'
import { toggleArtist, hasArtist, isBlocked, toggleBlockArtist } from '../modules/library.js'
import Queue from '../modules/queue.js'
import * as Player from '../modules/player.js'
import * as VideoPage from './video.js'
import * as PlaylistPage from './playlist.js'

const $ = (id) => document.getElementById(id)

let _artist = null, _tracks = [], _albums = [], _playFn = null, _openAlbum = null, _sheetTrack = null;

export function init(playFn, openAlb) {
  _playFn = playFn; _openAlbum = openAlb;
  $('artist-follow-btn')?.addEventListener('click', () => { if (_artist) { toggleArtist(_artist); _syncFollow(); } });
  $('artist-play-btn')?.addEventListener('click', () => _tracks.length && (_playFn(_tracks, 0), close()));
  $('artist-block-btn')?.addEventListener('click', () => {
    if (_artist) {
      toggleBlockArtist(_artist.name);
      _syncBlock();
      UI.toast(isBlocked(_artist.name) ? `Blocked ${_artist.name}` : `Unblocked ${_artist.name}`);
    }
  });
  $('artist-share-btn')?.addEventListener('click', () => {
    if (!_artist) return;
    const slug = (_artist.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const url = `https://tidal.com/artist/${_artist.id || ''}`;

    if (navigator.share) {
      navigator.share({
        title: `${_artist.name} — Tune-Topia`,
        text: `Check out ${_artist.name} on Tune-Topia`,
        url: url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      UI.toast('Link copied to clipboard');
    }
  });
}

export async function open(input) {
  _artist = input; _tracks = []; _albums = [];
  const page = $('page-artist'); if (!page) return;

  _applyColor(30, 28, 38);
  _setHeader(input);
  $('artist-tracklist').innerHTML = _skelTs();
  $('artist-discography').innerHTML = _skelAbs();
  $('artist-videos-section').style.display = 'none';
  $('artist-mixes-section').style.display = 'none';
  $('artist-videos-row').innerHTML = UI.skeletons(6, 'video');
  $('artist-mixes-row').innerHTML = UI.skeletons(6, 'horiz');
  $('artist-wiki-section').style.display = 'none';
  page.classList.add('open');

  const Router = await import('../app/router.js');
  const slug = (input.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  Router.updateURL('artist', { ...input, artist: slug });

  UI.updatePlayerPosition();

  if (!input.id || String(input.id) === 'undefined') {
    try { 
      const r = await searchArtists(input.name); 
      if (r.length) { const m = r.find(x => x.name.toLowerCase() === input.name.toLowerCase()) || r[0]; _artist = { ...input, ...m, id: String(m.id) }; }
    } catch {}
  }

  if (_artist.cover) {
    UI.extractColor(_artist.cover, (r, g, b) => _applyColor(r, g, b));
    $('artist-hero-img').src = _artist.cover;
  }
  _syncFollow();
  _syncBlock();

  await Promise.allSettled([
    _loadTs(_artist), 
    _loadAbs(_artist), 
    _loadWiki(_artist.name),
    _loadVideos(_artist.name),
    _loadMixes(_artist.name)
  ]);
}

export function close() {
  $('page-artist')?.classList.remove('open', 'stacked');
  UI.revertThemeColor();
  UI.updatePlayerPosition();
}

// Theme
function _applyColor(r, g, b) {
  const dr = Math.round(r * 0.85), dg = Math.round(g * 0.85), db = Math.round(b * 0.85);
  const page = $('page-artist'); if (!page) return;
  const dark = `rgb(${dr},${dg},${db})`;
  page.style.setProperty('--art-dark', dark);
  page.style.setProperty('--art-accent', `rgb(${r},${g},${b})`);
  page.style.background = dark;
  page.setAttribute('data-light', 0.299 * r + 0.587 * g + 0.114 * b > 120 ? 'true' : 'false');
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', dark);
}

function _setHeader(a) {
  $('artist-topbar-title').textContent = a.name || '';
  $('artist-hero-name').textContent = a.name || '';
  if (a.cover) $('artist-hero-img').src = a.cover;
}

function _syncFollow() {
  const btn = $('artist-follow-btn'); if (!btn || !_artist) return;
  const f = hasArtist(_artist.id || _artist.name);
  btn.textContent = f ? 'Following' : 'Follow';
  btn.classList.toggle('following', f);
}

function _syncBlock() {
  const btn = $('artist-block-btn');
  const txt = $('artist-block-text');
  if (!btn || !txt || !_artist) return;
  const blocked = isBlocked(_artist.name);
  txt.textContent = blocked ? 'Unblock Artist' : 'Block Artist';
}

async function _loadTs(a) {
  try {
    const ts = (a.id && String(a.id) !== 'undefined') ? await getArtistTopTracks(a.id) : [];
    const finalTs = ts.length ? ts : await searchTracks(a.name);
    const s = new Set();
    _tracks = finalTs.filter(t => { const k = `${t.title}|${t.artist}`.toLowerCase(); return !s.has(k) && s.add(k); }).slice(0, 10);
    _renderTs(_tracks);
  } catch {
    $('artist-tracklist').innerHTML = UI.errorState('Failed to load tracks');
  }
}

async function _loadAbs(a) {
  try {
    const abs = (a.id && String(a.id) !== 'undefined') ? await getArtistAlbums(a.id) : [];
    _albums = abs.length ? abs : await searchAlbums(a.name);
    _renderAbs(_albums);
  } catch {
    $('artist-discography').innerHTML = UI.errorState('Failed to load discography');
  }
}

async function _loadVideos(name) {
  const s = $('artist-videos-section'), r = $('artist-videos-row');
  if (!s || !r) return;
  try {
    const vids = await searchTidalVideos(name).catch(() => []);
    if (vids.length) {
      s.style.display = 'block';
      UI.renderHorizCards(vids.slice(0, 15), r, 'video');
      r.querySelectorAll('.horiz-card').forEach((el, i) => {
        el.addEventListener('click', () => VideoPage.open(vids[i]));
      });
    } else s.style.display = 'none';
  } catch { s.style.display = 'none'; }
}

async function _loadMixes(name) {
  const s = $('artist-mixes-section'), r = $('artist-mixes-row');
  if (!s || !r) return;
  try {
    const mixes = await searchPlaylists(`${name} Mix`, 10).catch(() => []);
    if (mixes.length) {
      s.style.display = 'block';
      UI.renderHorizCards(mixes.slice(0, 12), r);
      r.querySelectorAll('.horiz-card').forEach((el, i) => el.addEventListener('click', () => PlaylistPage.open(mixes[i])));
    } else s.style.display = 'none';
  } catch { s.style.display = 'none'; }
}

async function _loadWiki(n) {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(n)}`);
    if (!r.ok) return;
    const d = await r.json(); if (!d.extract) return;
    const img = $('artist-wiki-img');
    if (d.thumbnail?.source) { img.src = d.thumbnail.source; img.style.display = 'block'; } else img.style.display = 'none';
    $('artist-wiki-extract').textContent = d.extract;
    $('artist-wiki-link').href = d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(n)}`;
    $('artist-wiki-section').style.display = 'block';
  } catch {}
}

function _renderTs(ts) {
  const el = $('artist-tracklist'); if (!el) return;
  if (!ts.length) return el.innerHTML = UI.emptyState('music', 'No tracks found');
  el.innerHTML = ts.map((t, i) => `
    <div class="alb-track" data-index="${i}" data-tid="${escHtml(t.id)}">
      <span class="alb-track-num">${i + 1}</span>
      <img class="art-track-thumb" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.style.display='none'" alt=""/>
      <div class="alb-track-info">
        <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ` <span class="explicit-tag">${UI.getIcon('explicit')}</span>` : ''}</div>
        <div class="alb-track-artist">${escHtml(t.album || '')}</div>
      </div>
      <span class="alb-track-dur">${t.dur || ''}</span>
      <button class="alb-track-more" data-index="${i}">${UI.getIcon('more')}</button>
    </div>`).join('');

  el._tracks = ts;
  el.querySelectorAll('.alb-track').forEach(row => {
    row.addEventListener('click', e => !e.target.closest('.alb-track-more') && _playFn(ts, +row.dataset.index));
  });
}

function _renderAbs(abs) {
  const el = $('artist-discography'); if (!el) return;
  if (!abs.length) return el.innerHTML = '<div class="empty"><i class="bi bi-disc"></i><p>No releases found</p></div>';
  el.innerHTML = abs.map(al => `
    <div class="art-album-card" data-id="${escHtml(al.id)}">
      <div class="art-album-cover-wrap">
        <img class="art-album-cover" src="${escHtml(al.coverSmall || al.cover || '')}" onerror="this.src=''" alt=""/>
        <div class="art-album-play"><i class="bi bi-play-fill"></i></div>
      </div>
      <div class="art-album-title">${escHtml(al.title)}</div>
      <div class="art-album-year">${al.year || ''}</div>
    </div>`).join('');
  el.querySelectorAll('.art-album-card').forEach(card => card.addEventListener('click', () => {
    const alb = _albums.find(a => a.id === card.dataset.id); if (alb && _openAlbum) _openAlbum(alb);
  }));
}

const _skelTs = () => Array(5).fill(0).map((_, i) => `
  <div class="alb-track alb-track-skel">
    <span class="alb-track-num">${i + 1}</span>
    <div class="art-track-thumb skeleton"></div>
    <div class="alb-track-info">
      <div class="skeleton" style="height:13px;width:${50+Math.random()*35}%;border-radius:6px;margin-bottom:6px"></div>
      <div class="skeleton" style="height:11px;width:${25+Math.random()*20}%;border-radius:6px"></div>
    </div>
  </div>`).join('');

const _skelAbs = () => Array(6).fill(0).map(() => `
  <div class="art-album-card art-album-skel">
    <div class="art-album-cover-wrap skeleton" style="aspect-ratio:1"></div>
    <div class="skeleton" style="height:12px;width:80%;border-radius:6px;margin-top:8px"></div>
    <div class="skeleton" style="height:10px;width:40%;border-radius:6px;margin-top:5px"></div>
  </div>`).join('');
