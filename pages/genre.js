import { escHtml } from '../api/utils.js'

const $ = (id) => document.getElementById(id)

let _openPlaylistFn = null
let _openAlbumFn = null
let _playTrackFn = null
let _tracks = []

export function init(openPlaylistFn, openAlbumFn, playTrackFn) {
  _openPlaylistFn = openPlaylistFn
  _openAlbumFn = openAlbumFn
  _playTrackFn = playTrackFn
  $('genre-back-btn')?.addEventListener('click', close)
}

export async function open(genreId, label) {
  const page = $('page-genre')
  if (!page) return
  _tracks = []
  const titleEl = $('genre-topbar-title')
  if (titleEl) titleEl.textContent = label
  const scroll = $('genre-scroll')
  if (scroll) scroll.scrollTop = 0
  page.classList.add('open')
  document.body.style.overflow = 'hidden'
  _renderSkeletons()
  try {
    const data = await _fetch(genreId)
    _render(data)
  } catch {
    $('genre-playlists-grid').innerHTML =
      '<div class="genre-empty">Failed to load</div>'
  }
}

export function close() {
  $('page-genre')?.classList.remove('open')
  document.body.style.overflow = ''
}

async function _fetch(genreId) {
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

function _renderSkeletons() {
  const playlistGrid = $('genre-playlists-grid')
  const albumSection = $('genre-albums-section')
  const tracksSection = $('genre-tracks-section')
  if (albumSection) albumSection.style.display = 'none'
  if (tracksSection) tracksSection.style.display = 'none'
  if (playlistGrid)
    playlistGrid.innerHTML = Array(8)
      .fill(0)
      .map(
        () => `
    <div class="genre-card genre-card-skel">
      <div class="genre-card-img skeleton" style="aspect-ratio:1"></div>
      <div class="genre-card-info">
        <div class="skeleton" style="height:13px;width:70%;border-radius:6px;margin-bottom:5px"></div>
        <div class="skeleton" style="height:11px;width:45%;border-radius:6px"></div>
      </div>
    </div>`
      )
      .join('')
}

function _render({ playlists, albums, tracks }) {
  const playlistGrid = $('genre-playlists-grid')
  const albumSection = $('genre-albums-section')
  const albumGrid = $('genre-albums-grid')
  const tracksSection = $('genre-tracks-section')
  const tracksList = $('genre-tracks-list')

  _renderCards(
    playlistGrid,
    playlists,
    (p) => {
      _openPlaylistFn?.({
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
          .join(', ') || (p.numberOfTracks ? `${p.numberOfTracks} tracks` : ''),
    })
  )

  if (albums.length && albumSection && albumGrid) {
    albumSection.style.display = ''
    _renderCards(
      albumGrid,
      albums,
      (a) => {
        _openAlbumFn?.({
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

  if (tracks.length && tracksSection && tracksList) {
    _tracks = tracks.map((t) => ({
      id: String(t.id),
      title: t.title || '',
      artist: (t.artists || []).map((a) => a.name).join(', '),
      album: t.album?.title || '',
      cover: _imgUrl(t.album?.cover || t.cover, 640),
      coverSmall: _imgUrl(t.album?.cover || t.cover, 80),
      dur: t.duration ? _fmtDur(t.duration) : '',
      explicit: t.explicit || false,
      source: 'tidal',
    }))
    tracksSection.style.display = ''
    tracksList.innerHTML = _tracks
      .map(
        (t, i) => `
      <div class="alb-track" data-index="${i}">
        <span class="alb-track-num">${i + 1}</span>
        <img class="art-track-thumb" src="${escHtml(t.coverSmall || '')}" onerror="this.style.display='none'" alt=""/>
        <div class="alb-track-info">
          <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ' <span class="explicit-tag">E</span>' : ''}</div>
          <div class="alb-track-artist">${escHtml(t.artist)}</div>
        </div>
        <span class="alb-track-dur">${t.dur}</span>
      </div>`
      )
      .join('')
    tracksList.querySelectorAll('.alb-track').forEach((row) => {
      row.addEventListener('click', () =>
        _playTrackFn?.(_tracks, +row.dataset.index)
      )
    })
  } else if (tracksSection) {
    tracksSection.style.display = 'none'
  }
}

function _renderCards(grid, items, onClick, getDisplay) {
  if (!grid) return
  if (!items.length) {
    grid.innerHTML = '<div class="genre-empty">Nothing found</div>'
    return
  }
  grid.innerHTML = items
    .map((item, i) => {
      const d = getDisplay(item)
      return `
      <div class="genre-card" data-index="${i}">
        <div class="genre-card-img">
          <img src="${escHtml(d.cover)}" onerror="this.src=''" alt=""/>
          <div class="genre-card-play"><i class="bi bi-play-fill"></i></div>
        </div>
        <div class="genre-card-info">
          <div class="genre-card-title">${escHtml(d.title)}</div>
          <div class="genre-card-sub">${escHtml(d.sub || '')}</div>
        </div>
      </div>`
    })
    .join('')
  grid.querySelectorAll('.genre-card').forEach((card) => {
    card.addEventListener('click', () => onClick(items[+card.dataset.index]))
  })
}

function _imgUrl(id, size) {
  if (!id) return ''
  return `https://resources.tidal.com/images/${id.replace(/-/g, '/')}/${size}x${size}.jpg`
}

function _fmtDur(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}
