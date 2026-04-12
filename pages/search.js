// Search
import * as UI from '../app/ui.js'
import State from '../app/state.js'
import { playTrack } from '../app/playback.js'
import { runSearch, clearSearch, setTab } from '../modules/search.js'
import { escHtml } from '../api/utils.js'
import { MOODS } from '../app/constants.js'
import { getTrackRecommendations } from '../api/index.js'
import * as AlbumPage from './album.js'
import * as ArtistPage from './artist.js'
import * as PlaylistPage from './playlist.js'
import * as VideoPage from './video.js'
import {
  toggle as toggleVideoLike,
  isLiked as isVideoLiked,
} from './likedVideos.js'
import * as GenrePage from './genre.js'
import {
  attachAlbumEvents,
  attachArtistEvents,
} from './home.js'
const $ = (id) => document.getElementById(id)
let _searchTimer

export function init() {
  const input = $('search-input')
  const clearBtn = $('search-clear')
  const segWrap = $('search-seg-wrap')
  if (!input) return

  UI.renderMoodTiles(MOODS, $('search-mood-grid'))

  $('search-mood-grid')?.addEventListener('click', (e) => {
    const tile = e.target.closest('.mood-tile')
    if (!tile) return
    const genreId = tile.dataset.genreId
    const label = tile.querySelector('span')?.textContent.trim() || ''
    if (!genreId) return
    GenrePage.open(genreId, label)
  })

  input.addEventListener('input', () => {
    const q = input.value.trim()
    if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none'
    clearTimeout(_searchTimer)
    if (!q) {
      _showBrowse()
      clearSearch()
      return
    }
    if (segWrap) segWrap.style.display = ''
    _showResults()
    $('search-results-list').innerHTML = UI.skeletons()
    _searchTimer = setTimeout(
      () => runSearch(q, State.get('search.activeTab') || 'music'),
      380
    )
  })

  clearBtn?.addEventListener('click', () => {
    input.value = ''
    clearBtn.style.display = 'none'
    if (segWrap) segWrap.style.display = 'none'
    _showBrowse()
    clearSearch()
  })

  document.querySelectorAll('.search-tab').forEach((btn) => {
    btn.addEventListener('click', function () {
      document
        .querySelectorAll('.search-tab')
        .forEach((b) => b.classList.remove('active'))
      this.classList.add('active')
      setTab(this.dataset.tab)
    })
  })

  State.subscribe('search.results', _renderResults)
  State.subscribe('search.isLoading', (loading) => {
    if (loading) {
      const el = $('search-results-list')
      if (el) el.innerHTML = UI.skeletons()
    }
  })
}

function _renderResults() {
  const results = State.get('search.results')
  const tab = State.get('search.activeTab')
  const top = State.get('search.topResult')
  const topEl = $('search-top-result')
  const listEl = $('search-results-list')
  if (!listEl) return

  if (topEl) {
    if (tab === 'music' && top) {
      UI.renderTopResult(top, topEl)
      topEl.style.display = ''
      topEl
        .querySelector('.top-result-card')
        ?.addEventListener('click', () => playTrack([top], 0))
      topEl
        .querySelector('.top-result-play')
        ?.addEventListener('click', (e) => {
          e.stopPropagation()
          playTrack([top], 0)
        })
    } else {
      topEl.style.display = 'none'
    }
  }

  // Reset layout class so previous tab's grid doesn't bleed into next
  listEl.className = ''

  if (tab === 'albums') {
    UI.renderAlbums(results, listEl)
    attachAlbumEvents(listEl)
  } else if (tab === 'artists') {
    UI.renderArtists(results, listEl)
    attachArtistEvents(listEl)
  } else if (tab === 'video') {
    _renderVideos(results, listEl)
  } else if (tab === 'playlists') {
    _renderPlaylists(results, listEl)
  } else {
    const sorted = [...results].sort((a, b) => {
      const aIsYt = a.source === 'youtube', bIsYt = b.source === 'youtube';
      return aIsYt === bIsYt ? 0 : aIsYt ? 1 : -1;
    });
    UI.renderTracks(sorted, listEl, null)
    _attachSearchTrackEvents(listEl)
  }
}

// Video

function _renderVideos(results, container) {
  if (!container) return
  if (!results.length) {
    container.innerHTML = '<div class="search-empty">No videos found</div>'
    return
  }

  const _badge = (v) => {
    const isTidal = v.source === 'tidal-video' || v.source === 'tidal'
    return isTidal
      ? `<span class="vc-source-badge vc-badge-tidal">Tidal</span>`
      : `<span class="vc-source-badge vc-badge-yt">YT</span>`
  }

  const _heart = (v) =>
    isVideoLiked(v.id)
      ? `<span class="vc-like-icon liked">${UI.getIcon('heartFill')}</span>`
      : `<span class="vc-like-icon">${UI.getIcon('heart')}</span>`

  container.innerHTML = results
    .map(
      (v, i) => `
    <div class="vc-row" data-index="${i}">
      <div class="vc-thumb-wrap">
        <img src="${escHtml(v.thumbnail || v.cover || '')}" alt="" onerror="this.src=\'\'" class="vc-thumb"/>
        <div class="vc-overlay" style="font-size:22px;color:#fff">${UI.getIcon('play')}</div>
        ${_badge(v)}
        ${v.dur ? `<span class="vc-dur">${escHtml(v.dur)}</span>` : ''}
      </div>
      <div class="vc-info">
        <div class="vc-title">${escHtml(v.title || '')}</div>
        <div class="vc-artist">${escHtml(v.channel || v.artist || '')}</div>
      </div>
      <button class="vc-like-btn" data-index="${i}" title="Like video">${_heart(v)}</button>
    </div>`
    )
    .join('')

  container.querySelectorAll('.vc-like-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const v = results[parseInt(btn.dataset.index)]
      if (!v) return
      toggleVideoLike(v)
      btn.innerHTML = _heart(v);
    })
  })

  container.querySelectorAll('.vc-row').forEach((row) => {
    row.addEventListener('click', () => {
      const v = results[parseInt(row.dataset.index)]
      if (v) VideoPage.open(v)
    })
  })
}

// Playlists
function _renderPlaylists(results, container) {
  if (!container) return
  if (!results.length) {
    container.innerHTML = '<div class="search-empty">No playlists found</div>'
    return
  }
  container.innerHTML = `<div class="pls-grid">${results
    .map(
      (p, i) => `
      <div class="pls-card" data-index="${i}"> 
        <div class="pls-art-wrap">
          <img src="${escHtml(p.coverSmall || p.cover || '')}" alt="" onerror="this.src=''" class="pls-art"/>
          <div class="pls-overlay" style="font-size:26px;color:#fff">${UI.getIcon('play')}</div>
        </div>
        <div class="pls-info">
          <div class="pls-title">${escHtml(p.title || '')}</div>
          <div class="pls-sub">${p.trackCount ? p.trackCount + ' tracks' : escHtml(p.description || '')}</div>
        </div>
      </div>`
    )
    .join('')}</div>`

  container.querySelectorAll('.pls-card').forEach((card) => {
    card.addEventListener('click', () => {
      const p = results[parseInt(card.dataset.index)]
      if (p) {
        PlaylistPage.open({ ...p, id: p.id || p.uuid });
      }
    })
  })
}

function _attachSearchTrackEvents(container) {
  container.querySelectorAll('[data-index]').forEach((wrap) => {
    const card = wrap.querySelector('.track-card')
    if (!card) return
    const idx = parseInt(wrap.dataset.index)
    card.addEventListener('click', () => {
      const track = container._tracks?.[idx]
      if (!track) return
      playTrack([track], 0)
      getTrackRecommendations(track.id).then((recs) => {
        if (!recs.length) return
        import('../modules/queue.js').then(({ default: Queue }) => {
          recs.forEach((r) => Queue.add(r))
        })
      })
    })
    wrap.querySelector('.track-like-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      import('../app/likes.js').then((m) => m.onLike(container._tracks?.[idx]))
    })
  })
}

function _showBrowse() {
  const b = $('search-empty-state'), r = $('search-results'), gs = $('genre-results-section');
  if (b) b.style.display = '';
  if (r) r.style.display = 'none';
  if (gs) gs.style.display = 'none';
}

function _showResults() {
  const b = $('search-empty-state'), r = $('search-results');
  if (b) b.style.display = 'none';
  if (r) r.style.display = '';
}

// Genre

export async function openGenre(genreId, label) {
  _showBrowse()
  _showGenreResults(label, null)
  const data = await _fetchGenre(genreId)
  _showGenreResults(label, data)
}

async function _fetchGenre(genreId) {
  const r = await fetch(
    `https://hot.monochrome.tf/explore/genre/?id=${encodeURIComponent(genreId)}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const json = await r.json()
  return {
    playlists:
      json.featured_playlists ||
      json.sections?.find((s) => s.type === 'PLAYLIST_LIST')?.items ||
      [],
    albums: json.top_albums || [],
    tracks: json.top_tracks || [],
  }
}

function _showGenreResults(label, data) {
  let section = $('genre-results-section')
  if (!section) {
    section = document.createElement('div')
    section.id = 'genre-results-section'
    section.style.cssText = 'margin-top:24px'
    section.innerHTML = `
      <div style="margin-bottom:14px; display:flex; align-items:center; gap:12px">
        <button class="back-btn" id="genre-section-back">${UI.getIcon('chevron-left')}</button>
        <span id="genre-results-title" style="font-size:17px;font-weight:700;color:var(--text-primary,#fff)"></span>
      </div>
      <div id="genre-playlists-grid" class="genre-cards-grid"></div>
      <div id="genre-albums-section" style="margin-top:24px;display:none">
        <div style="font-size:15px;font-weight:700;color:var(--text-primary,#fff);margin-bottom:12px">Top Albums</div>
        <div id="genre-albums-grid" class="genre-cards-grid"></div>
      </div>`
    $('search-empty-state')?.appendChild(section)
    $('genre-section-back')?.addEventListener('click', _showBrowse);
  }

  const titleEl = $('genre-results-title')
  const playlistGrid = $('genre-playlists-grid')
  const albumSection = $('genre-albums-section')
  const albumGrid = $('genre-albums-grid')
  if (titleEl) titleEl.textContent = label
  section.style.display = ''

  if (!data) {
    if (playlistGrid) playlistGrid.innerHTML = _genreSkeletons()
    return
  }

  _renderGenreCards(
    playlistGrid,
    data.playlists,
    (p) => {
      PlaylistPage.open({
        id: p.uuid || '',
        title: p.title || '',
        description: p.description || '',
        cover: _imgUrl(p.squareImage || p.image, 640),
        coverSmall: _imgUrl(p.squareImage || p.image, 320),
        trackCount: p.numberOfTracks || 0,
        tracks: [],
        type: 'playlist',
      })
    },
    (p) => ({
      cover: _imgUrl(p.squareImage || p.image, 320),
      title: p.title,
      sub:
        (p.promotedArtists || [])
          .slice(0, 2)
          .map((a) => a.name)
          .join(', ') || p.numberOfTracks + ' tracks',
    })
  )

  if (data.albums.length && albumSection && albumGrid) {
    albumSection.style.display = ''
    _renderGenreCards(
      albumGrid,
      data.albums,
      (a) => {
        AlbumPage.open({
          id: String(a.id),
          title: a.title,
          artist: (a.artists || []).map((x) => x.name).join(', '),
          cover: _imgUrl(a.cover, 640),
          coverSmall: _imgUrl(a.cover, 320),
          type: 'album',
        })
      },
      (a) => ({
        cover: _imgUrl(a.cover, 320),
        title: a.title,
        sub: (a.artists || []).map((x) => x.name).join(', '),
      })
    )
  } else if (albumSection) {
    albumSection.style.display = 'none'
  }
}

function _renderGenreCards(grid, items, onClick, getDisplay) {
  if (!grid) return
  if (!items.length) {
    grid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:24px;opacity:.5">Nothing found</div>'
    return
  }
  grid.innerHTML = items
    .map((item, i) => {
      const d = getDisplay(item)
      return `
      <div class="genre-card" data-index="${i}">
        <div style="position:relative;aspect-ratio:1;overflow:hidden;background:var(--surface-2,#222)">
          <img src="${escHtml(d.cover)}" onerror="this.src=''" alt="" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s"/>
          <div class="genre-card-play" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);opacity:0;transition:opacity .2s"> 
            <span style="font-size:30px;color:#fff">${UI.getIcon('play')}</span>
          </div>
        </div>
        <div style="padding:9px 10px 11px">
          <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${escHtml(d.title)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(d.sub || '')}</div>
        </div>
      </div>`
    })
    .join('')

  grid.querySelectorAll('.genre-card').forEach((card) => {
    const overlay = card.querySelector('.genre-card-play')
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-3px)'
      if (overlay) overlay.style.opacity = '1'
      card.querySelector('img').style.transform = 'scale(1.06)'
    })
    card.addEventListener('mouseleave', () => {
      card.style.transform = ''
      if (overlay) overlay.style.opacity = '0'
      card.querySelector('img').style.transform = ''
    })
    card.addEventListener('click', () =>
      onClick(items[parseInt(card.dataset.index)])
    )
  })
}

function _genreSkeletons() {
  return Array(8)
    .fill(0)
    .map(
      () => `
    <div class="genre-card">
      <div style="aspect-ratio:1;border-radius:12px;background:var(--surface-2);animation:shimmer 1.4s infinite"></div>
      <div style="padding:8px 2px">
        <div style="height:13px;width:70%;border-radius:6px;margin-bottom:6px;background:rgba(255,255,255,.08);animation:shimmer 1.4s infinite"></div>
        <div style="height:11px;width:45%;border-radius:6px;background:rgba(255,255,255,.06);animation:shimmer 1.4s infinite"></div>
      </div>
    </div>`
    )
    .join('')
}

function _imgUrl(id, size) {
  if (!id) return ''
  return `https://resources.tidal.com/images/${id.replace(/-/g, '/')}/${size}x${size}.jpg`
}
