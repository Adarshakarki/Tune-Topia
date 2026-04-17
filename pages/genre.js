// Genre
import { escHtml, tidalCover, fmtDur } from '../api/utils.js'
import * as UI from '../app/ui.js'

const $ = (id) => document.getElementById(id)

let _openPl = null, _openAlb = null, _playTs = null, _ts = [];

// Init
export function init(openPl, openAlb, playTs) {
  _openPl = openPl; _openAlb = openAlb; _playTs = playTs;
  $('genre-back-btn')?.addEventListener('click', (e) => { e.stopPropagation(); close(); });
}

export async function open(id, label) {
  const page = $('page-genre'); if (!page) return;
  _ts = [];
  if ($('genre-topbar-title')) $('genre-topbar-title').textContent = label;
  if ($('genre-scroll')) $('genre-scroll').scrollTop = 0;
  page.classList.add('open');
  UI.updatePlayerPosition();
  _skels();
  try { _render(await _fetch(id)); }
  catch { $('genre-playlists-grid').innerHTML = '<div class="genre-empty">Failed to load</div>'; }
}

export function close() { $('page-genre')?.classList.remove('open'); UI.updatePlayerPosition(); }

// Fetch
async function _fetch(id) {
  const r = await fetch(`https://hot.monochrome.tf/explore/genre/?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return {
    pls: j.featured_playlists || j.sections?.find(s => s.type === 'PLAYLIST_LIST')?.items || [],
    albs: j.top_albums || [],
    ts: j.top_tracks || []
  };
}

// Render
function _skels() {
  [$('genre-albums-section'), $('genre-tracks-section')].forEach(s => s && (s.style.display = 'none'));
  if ($('genre-playlists-grid')) $('genre-playlists-grid').innerHTML = Array(8).fill(0).map(() => `
    <div class="genre-card genre-card-skel">
      <div class="genre-card-img skeleton" style="aspect-ratio:1"></div>
      <div class="genre-card-info">
        <div class="skeleton" style="height:13px;width:70%;border-radius:6px;margin-bottom:5px"></div>
        <div class="skeleton" style="height:11px;width:45%;border-radius:6px"></div>
      </div>
    </div>`).join('');
}

function _render({ pls, albs, ts }) {
  _renderCards($('genre-playlists-grid'), pls, p => _openPl?.({
    id: p.uuid || '', title: p.title || '', description: p.description || '',
    cover: tidalCover(p.squareImage || p.image, 640), coverSmall: tidalCover(p.squareImage || p.image, 320),
    trackCount: p.numberOfTracks || 0, tracks: [], type: 'playlist'
  }), p => ({
    cover: tidalCover(p.squareImage || p.image, 320), title: p.title,
    sub: p.promotedArtists?.slice(0, 2).map(a => a.name).join(', ') || (p.numberOfTracks ? `${p.numberOfTracks} tracks` : '')
  }));

  const aSec = $('genre-albums-section');
  if (albs.length && aSec) {
    aSec.style.display = '';
    _renderCards($('genre-albums-grid'), albs, a => _openAlb?.({
      id: String(a.id), title: a.title, artist: a.artists?.map(x => x.name).join(', ') || '',
      cover: tidalCover(a.cover, 640), coverSmall: tidalCover(a.cover, 320), type: 'album'
    }), a => ({ cover: tidalCover(a.cover, 320), title: a.title, sub: a.artists?.map(x => x.name).join(', ') }));
  } else if (aSec) aSec.style.display = 'none';

  const tSec = $('genre-tracks-section'), tList = $('genre-tracks-list');
  if (ts.length && tSec && tList) {
    _ts = ts.map(t => ({
      id: String(t.id), title: t.title || '', artist: t.artists?.map(a => a.name).join(', ') || '',
      album: t.album?.title || '', cover: tidalCover(t.album?.cover || t.cover, 640),
      coverSmall: tidalCover(t.album?.cover || t.cover, 80), dur: t.duration ? fmtDur(t.duration) : '',
      explicit: !!t.explicit, source: 'tidal'
    }));
    tSec.style.display = '';
    tList.innerHTML = _ts.map((t, i) => `
      <div class="alb-track" data-index="${i}">
        <span class="alb-track-num">${i + 1}</span>
        <img class="art-track-thumb" src="${escHtml(t.coverSmall)}" onerror="this.style.display='none'"/>
        <div class="alb-track-info">
          <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ` <span class="explicit-tag">${UI.getIcon('explicit')}</span>` : ''}</div>
          <div class="alb-track-artist">${escHtml(t.artist)}</div>
        </div>
        <span class="alb-track-dur">${t.dur}</span>
      </div>`).join('');
    tList.querySelectorAll('.alb-track').forEach(r => r.addEventListener('click', () => _playTs?.(_ts, +r.dataset.index)));
  } else if (tSec) tSec.style.display = 'none';
}

function _renderCards(grid, items, onClick, getDisplay) {
  if (!grid) return;
  if (!items.length) return grid.innerHTML = '<div class="genre-empty">Nothing found</div>';
  grid.innerHTML = items.map((item, i) => {
    const d = getDisplay(item);
    return `
      <div class="genre-card" data-index="${i}">
        <div class="genre-card-img">
          <img src="${escHtml(d.cover)}" onerror="this.src=''"/>
          <div class="genre-card-play">${UI.getIcon('play')}</div>
        </div>
        <div class="genre-card-info">
          <div class="genre-card-title">${escHtml(d.title)}</div>
          <div class="genre-card-sub">${escHtml(d.sub || '')}</div>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.genre-card').forEach(c => c.addEventListener('click', () => onClick(items[+c.dataset.index])));
}
