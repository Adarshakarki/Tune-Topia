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

function _appendRecs(trackId) {
  getTrackRecommendations(trackId).then((recs) => {
    if (!recs.length) return
    import('../modules/queue.js').then(({ default: Queue }) => {
      recs.forEach((r) => Queue.add(r))
    })
  })
}

export async function load() {
  const tracksEl = $('home-tracks')
  const newRow = $('home-new-row')
  if (tracksEl) tracksEl.innerHTML = UI.skeletons()
  if (newRow) newRow.innerHTML = UI.skeletons(6, 'horiz')

  // Load new releases and recommendations in parallel
  const [newTracks, recTracks] = await Promise.all([
    _fetchNewReleases(),
    _fetchRecommended(),
  ])

  try {
    if (recTracks.length) UI.renderHero(recTracks[0])
    if (newRow) {
      UI.renderHorizCards(newTracks, newRow)
      attachHorizEvents(newRow)
    }

    // Recently played
    const hist = History.getAll()
    const recentSec = $('home-recent-section')
    const recentRow = $('home-recent-row')
    if (hist.length && recentSec && recentRow) {
      recentSec.style.display = ''
      UI.renderHorizCards(hist, recentRow)
      attachHorizEvents(recentRow)
    }

    // Top Tracks — capped at 6
    if (tracksEl) {
      UI.renderTracks(recTracks.slice(0, 10), tracksEl, null)
      attachTrackEvents(tracksEl)
    }

    // For You — second batch of recommendations (different slice)
    _loadForYou(recTracks)

    // Popular Artists
    _loadPopularArtists(recTracks)

    _loadFeaturedPlaylists()

 $('hero-card')?.addEventListener('click', () => {
      const card = $('hero-card')
      if (!card?._track) return
      playTrack([card._track], 0)
      _appendRecs(card._track.id)
    })

    // Inline search bar → navigate to search
    $('home-search-trigger')?.addEventListener('click', () => {
      import('../app/router.js').then((R) => {
        R.showPage('search')
        setTimeout(() => document.getElementById('search-input')?.focus(), 150)
      })
    })
  } catch (e) {
    if (tracksEl) tracksEl.innerHTML = errState(e)
  }
}

async function _fetchNewReleases() {
  try {
    const result = await getPlaylist(NEW_RELEASES_PLAYLIST_ID)
    const tracks = result.tracks || []
    if (tracks.length) return tracks
  } catch {}
  try {
    const results = await Promise.allSettled(
      ['new music 2026', 'new albums 2026', 'latest hits 2026'].map((q) =>
        searchTracks(q).catch(() => [])
      )
    )
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  } catch {
    return []
  }
}

async function _fetchRecommended() {
  try {
    const { queries, ytFallback } = getHomeQueries(State, History)
    const results = await Promise.allSettled(
      queries.map((q) => searchTracks(q).catch(() => []))
    )
    let tracks = results.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : []
    )
    if (!tracks.length) tracks = await searchVideos(ytFallback).catch(() => [])
    return tracks
  } catch {
    return []
  }
}

async function _loadForYou(recTracks) {
  const sec = $('home-foryou-section')
  const row = $('home-foryou-row')
  if (!sec || !row) return

  // Use tracks 7-20 from recommendations as "For You" — different slice so it feels fresh
  const forYou = recTracks.slice(6, 20)
  if (!forYou.length) {
    // Fallback: fetch a different genre-based query
    try {
      const results = await Promise.allSettled(
        ['indie playlist 2026', 'chill hits 2026', 'viral songs 2026'].map(
          (q) => searchTracks(q).catch(() => [])
        )
      )
      const tracks = results.flatMap((r) =>
        r.status === 'fulfilled' ? r.value : []
      )
      if (!tracks.length) return
      sec.style.display = ''
      UI.renderHorizCards(tracks, row)
      attachHorizEvents(row)
    } catch {}
    return
  }
  sec.style.display = ''
  UI.renderHorizCards(forYou, row)
  attachHorizEvents(row)
}

async function _loadPopularArtists(recTracks) {
  const sec = $('home-artists-section')
  const row = $('home-artists-row')
  if (!sec || !row) return

  // Derive unique artists from recommendation tracks
  const seen = new Set()
  const artists = []
  for (const t of recTracks) {
    if (t.artist && !seen.has(t.artist)) {
      seen.add(t.artist)
      artists.push({ name: t.artist, cover: t.cover })
      if (artists.length >= 10) break
    }
  }
  if (!artists.length) return

  sec.style.display = ''
  row.innerHTML = artists
    .map(
      (a, i) => `
    <div class="horiz-card artist-pill" data-index="${i}">
      <div class="artist-pill-img">
        <img src="${a.cover || ''}" alt="" onerror="this.style.display='none'"/>
        <div class="artist-pill-fallback"><i class="bi bi-person-fill"></i></div>
      </div>
      <div class="horiz-title">${escHtml(a.name)}</div>
    </div>`
    )
    .join('')

  row._artists = artists
  row.querySelectorAll('.artist-pill').forEach((card) => {
    card.addEventListener('click', () => {
      const a = artists[parseInt(card.dataset.index)]
      if (a)
        import('./artist.js').then((m) =>
          m.open({ name: a.name, cover: a.cover })
        )
    })
  })
}

async function _loadFeaturedPlaylists() {
  const row = $('home-playlists-row')
  if (!row) return

  row.innerHTML = PLAYLIST_QUERIES.map(
    (q, i) => `
    <div class="horiz-card playlist-card" data-pl-index="${i}">
      <div class="horiz-art skeleton" style="border-radius:var(--r-sm)"></div>
      <div class="horiz-title">${q}</div>
      <div class="horiz-sub">Loading…</div>
    </div>`
  ).join('')

  const results = await Promise.allSettled(
    PLAYLIST_QUERIES.map((q) => searchPlaylists(q, 1))
  )
  const resolved = results
    .map((r) => (r.status === 'fulfilled' && r.value?.[0]) || null)
    .filter(Boolean)

  if (!resolved.length) {
    row.innerHTML =
      '<div class="empty"><i class="bi bi-collection"></i><p>No playlists found</p></div>'
    return
  }

  row.innerHTML = resolved
    .map(
      (pl, i) => `
    <div class="horiz-card playlist-card" data-pl-index="${i}">
      <img class="horiz-art" src="${pl.cover || ''}" onerror="this.style.background='var(--surface-2)'" alt=""/>
      <div class="horiz-title">${escHtml(pl.title)}</div>
      <div class="horiz-sub">${pl.trackCount ? pl.trackCount + ' tracks' : pl.description || ''}</div>
    </div>`
    )
    .join('')

  row.querySelectorAll('.playlist-card').forEach((card) => {
    card.addEventListener('click', () => {
      const pl = resolved[parseInt(card.dataset.plIndex)]
      if (pl) PlaylistPage.open(pl)
    })
  })

  const seeAllBtn = $('home-playlists-see-all')
  seeAllBtn?.addEventListener('click', () => {
    const expanded = row.classList.toggle('horiz-expanded')
    seeAllBtn.textContent = expanded ? 'See less' : 'See all'
  })
}

// Shared event attachers — exported so other pages can use them
export function attachTrackEvents(container) {
  container.querySelectorAll('[data-index]').forEach((wrap) => {
    const card = wrap.querySelector('.track-card')
    if (!card) return
    const idx = parseInt(wrap.dataset.index)
    card.addEventListener('click', () => playTrack(container._tracks, idx))
    wrap.querySelector('.track-like-btn')?.addEventListener('click', (e) => {
      e.stopPropagation()
      import('../app/likes.js').then((m) => m.onLike(container._tracks?.[idx]))
    })
  })
}

export function attachHorizEvents(container) {
  container.querySelectorAll('.horiz-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index)
      const track = container._tracks?.[idx]
      if (!track) return
      playTrack([track], 0)
      _appendRecs(track.id)
    })
  })
}

export function attachAlbumEvents(container) {
  container.querySelectorAll('.card-item').forEach((card) => {
    card.addEventListener('click', () => {
      const a = container._albums?.[parseInt(card.dataset.index)]
      if (a) AlbumPage.open(a)
    })
  })
}

export function attachAlbumAsTrackEvents(container, tracks) {
  container.querySelectorAll('.card-item').forEach((card) => {
    card.addEventListener('click', () =>
      playTrack(tracks, parseInt(card.dataset.index))
    )
  })
}

export function attachArtistEvents(container) {
  container.querySelectorAll('.card-item').forEach((card) => {
    const a = container._artists?.[parseInt(card.dataset.index)]
    if (a)
      card.addEventListener('click', () =>
        import('./artist.js').then((m) => m.open(a))
      )
  })
}

export function errState(e) {
  return `<div class="empty"><i class="bi bi-wifi-off"></i><p>Failed to load</p><small>${e?.message || ''}</small></div>`
}
