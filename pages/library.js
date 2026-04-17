// Library
import * as UI from '../app/ui.js'
import State from '../app/state.js'
import History from '../modules/history.js'
import * as Playlists from '../modules/playlists.js'
import { playTrack } from '../app/playback.js'
import { escHtml } from '../api/utils.js'
import { updateLikedCount } from '../app/likes.js'
import { searchTracks, getPlaylist } from '../api/index.js'
import { searchVideos } from '../api/index.js'
import {
  attachTrackEvents,
  attachAlbumEvents,
  attachAlbumAsTrackEvents,
  attachHorizEvents,
} from './home.js'
import * as AlbumPage from './album.js'
import * as PlaylistPage from './playlist.js'
import * as MixPage from './mix.js'
import * as VideoPage from './video.js'

const $ = (id) => document.getElementById(id)
const NEW_RELEASES_PLAYLIST_ID = '1b418bb8-90a7-4f87-901d-707993838346'

let _albumSort = 'recent' // 'recent' | 'az' | 'artist'
let _artistSort = 'recent' // 'recent' | 'az'

export function render() {
  updateLikedCount()

  const followed = State.get('library.followedArtists') || []
  const savedAlbums = State.get('library.savedAlbums') || []

  const artistLabel = $('followed-artists-label')
  if (artistLabel)
    artistLabel.textContent = `${followed.length} artist${followed.length !== 1 ? 's' : ''}`

  const albumsLabel = $('saved-albums-label')
  if (albumsLabel)
    albumsLabel.textContent = `${savedAlbums.length} album${savedAlbums.length !== 1 ? 's' : ''}`

  const hist = History.getAll()
  const recentSec = $('lib-recent-section')
  const recentRow = $('lib-recent-row')
  if (hist.length && recentSec && recentRow) {
    recentSec.style.display = ''
    UI.renderHorizCards(hist, recentRow)
    attachHorizEvents(recentRow)
  }

  const plCount = Playlists.getAll().length
  const plLabel = $('playlists-count-label')
  if (plLabel)
    plLabel.textContent = `${plCount} playlist${plCount !== 1 ? 's' : ''}`

  const likedPl = State.get('library.likedPlaylists') || []
  const likedMx = State.get('library.likedMixes') || []
  const tidalPlLabel = $('tidal-playlists-count-label')
  if (tidalPlLabel) tidalPlLabel.textContent = `${likedPl.length + likedMx.length} item${(likedPl.length + likedMx.length) !== 1 ? 's' : ''}`
}

export async function loadNew() {
  const el = $('new-grid')
  if (!el) return
  el.innerHTML = UI.skeletonsGrid()
  try {
    const result = await getPlaylist(NEW_RELEASES_PLAYLIST_ID)
    const tracks = result.tracks || []
    if (!tracks.length) throw new Error('Empty')
    UI.renderAlbums(
      tracks.map((t) => ({ cover: t.cover, title: t.title, artist: t.artist })),
      el
    )
    el._albums = tracks
    attachAlbumAsTrackEvents(el, tracks)
  } catch {
    try {
      const results = await Promise.allSettled(
        ['new music', 'new albums'].map((q) =>
          searchTracks(q).catch(() => [])
        )
      )
      let tracks = results.flatMap((r) =>
        r.status === 'fulfilled' ? r.value : []
      )
      if (!tracks.length)
        tracks = await searchVideos('new music').catch(() => [])
      if (!tracks.length) throw new Error('No results')
      UI.renderAlbums(
        tracks.map((t) => ({
          cover: t.cover,
          title: t.title,
          artist: t.artist,
        })),
        el
      )
      el._albums = tracks
      attachAlbumAsTrackEvents(el, tracks)
    } catch (e) {
      el.innerHTML = UI.errorState('Could not load new releases', loadNew)
    }
  }
}

export function loadAlbums() {
  const el = $('albums-grid')
  if (!el) return
  const albums = [...(State.get('library.savedAlbums') || [])];

  if (!albums.length) {
    el.innerHTML = UI.emptyState(
      'bi-disc-fill',
      'No saved albums',
      'Tap ♡ on any album to save it'
    )
    return
  }

  // Sort
  if (_albumSort === 'az')
    albums.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  else if (_albumSort === 'artist')
    albums.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''))
  // Order by saved
  else albums.reverse()

  _updateSortChips('albums-sort-chips', _albumSort)
  UI.renderAlbums(albums, el)
  el._albums = albums
  el.querySelectorAll('.card-item').forEach(card => {
    card.addEventListener('click', () => {
      const a = el._albums[+card.dataset.index];
      if (a) AlbumPage.open(a);
    });
  });

  // Wire sort chips
  document.querySelectorAll('#albums-sort-chips .sort-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      _albumSort = btn.dataset.sort
      loadAlbums()
    })
  })
}

export function loadArtists() {
  const el = $('artists-grid')
  if (!el) return
  const artists = [...(State.get('library.followedArtists') || [])];

  if (!artists.length) {
    el.innerHTML = UI.emptyState(
      'bi-people-fill',
      'No followed artists',
      'Follow artists to see them here'
    )
    return
  }

  // Sort
  if (_artistSort === 'az')
    artists.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  else artists.reverse()

  _updateSortChips('artists-sort-chips', _artistSort)
  UI.renderArtists(artists, el)
  import('./home.js').then((m) => m.attachArtistEvents(el))

  // Wire sort chips
  document.querySelectorAll('#artists-sort-chips .sort-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      _artistSort = btn.dataset.sort
      loadArtists()
    })
  })
}

export async function loadSongs() {
  const el = $('songs-list')
  if (!el) return
  el.innerHTML = UI.skeletons()
  try {
    const results = await Promise.allSettled(
      ['Ariana Grande', 'Post Malone', 'Doja Cat', 'Travis Scott'].map((q) =>
        searchTracks(q).catch(() => [])
      )
    )
    let tracks = results.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : []
    )
    if (!tracks.length)
      tracks = await searchVideos('popular songs').catch(() => [])
    if (!tracks.length) throw new Error('No results')
    UI.renderTrackList(tracks, el, null)
    attachTrackEvents(el)
  } catch {
    el.innerHTML = UI.errorState('Could not load songs', loadSongs)
  }
}

export function loadHistory() {
  const el = $('history-list')
  if (!el) return

  // Setup clear button event listener once
  const clearBtn = $('history-clear-btn');
  if (clearBtn && !clearBtn._bound) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your playback history?')) {
        History.clear();
        loadHistory();
      }
    });
    clearBtn._bound = true;
  }

  const groups = History.getGrouped()
  if (!groups.length) {
    el.innerHTML = UI.emptyState('history',
      'No history yet',
      'Play some music to see it here'
    )
    return
  }

  el.innerHTML = ''
  groups.forEach(g => {
    const groupWrap = document.createElement('div')
    groupWrap.className = 'history-group'
    groupWrap.innerHTML = `
      <div class="history-date-header">${escHtml(g.date)}</div>
      ${g.tracks.length ? `
        <div class="history-group-tracks">
          ${g.tracks.map((t, i) => `
            <div class="alb-track" data-index="${i}" data-tid="${escHtml(t.id)}">
              <div class="art-track-thumb-wrap" style="position:relative; width:40px; height:40px; flex-shrink:0">
                <img class="art-track-thumb" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.style.display='none'" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:4px"/>
                ${t.type === 'video' ? `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3); color:#fff; font-size:14px; border-radius:4px">${UI.getIcon('play')}</div>` : ''}
              </div>
              <div class="alb-track-info">
                <div class="alb-track-title">${escHtml(t.title)}${t.explicit ? ` <span class="explicit-tag">${UI.getIcon('explicit')}</span>` : ''}</div>
                <div class="alb-track-artist">${escHtml(t.artist || '')}</div>
              </div>
              <span class="alb-track-dur">${t.dur || ''}</span>
            </div>`).join('')}
        </div>` : ''}
      ${g.collections.length ? `
        <div class="history-collections-section">
          <div class="history-section-label">Albums & Playlists</div>
          <div class="history-collections-grid">
            ${g.collections.map((c, i) => `
              <div class="hist-col-item" data-type="${c.type}" data-idx="${i}">
                <img src="${escHtml(c.coverSmall || c.cover || '')}" onerror="this.src=''" alt=""/>
              </div>`).join('')}
          </div>
        </div>` : ''}
    `;

    const trackList = groupWrap.querySelector('.history-group-tracks');
    if (trackList) {
      trackList._tracks = g.tracks;
      trackList.addEventListener('click', e => {
        const row = e.target.closest('.alb-track');
        if (!row) return;
        const item = g.tracks[+row.dataset.index];
        if (item.type === 'video') VideoPage.open(item);
        else playTrack(g.tracks, +row.dataset.index);
      });
    }

    groupWrap.querySelectorAll('.hist-col-item').forEach(item => {
      item.addEventListener('click', () => {
        const col = g.collections[+item.dataset.idx];
        if (col.type === 'album') AlbumPage.open(col);
        else if (col.type === 'mix') MixPage.open(col);
        else if (col.type === 'user-playlist') UserPlaylistPage.open(col.id);
        else PlaylistPage.open(col);
      });
    });

    el.appendChild(groupWrap);
  })

  import('../app/playback.js').then(m => m.refreshActiveTracks())
}

export function loadRecent() {
  const el = $('recent-grid')
  if (!el) return
  const hist = History.getAll()
  if (!hist.length) {
    el.innerHTML = UI.emptyState('history', 'Nothing played yet')
    return
  }
  UI.renderAlbums(
    hist.map((t) => ({ cover: t.cover, title: t.title, artist: t.artist })),
    el
  )
  el._albums = hist
  attachAlbumAsTrackEvents(el, hist)
}

export function loadTidalPlaylists() {
  const el = $('tidal-playlists-grid')
  if (!el) return

  const playlists = State.get('library.likedPlaylists') || []
  const mixes = State.get('library.likedMixes') || []
  
  // Combine and sort by most recently liked
  const all = [...playlists, ...mixes].sort((a, b) => {
    return new Date(b.likedAt || 0) - new Date(a.likedAt || 0)
  })

  if (!all.length) {
    el.innerHTML = UI.emptyState('music', 'No liked playlists or mixes', 'Heart a playlist or mix to see it here')
    return
  }

  UI.renderAlbums(all.map(item => ({
    cover: item.cover,
    title: item.title,
    artist: item.type === 'mix' ? 'Mix' : (item.description || 'Playlist')
  })), el)

  el.querySelectorAll('.card-item').forEach((card, i) => {
    card.addEventListener('click', () => {
      const item = all[i]
      if (item.type === 'mix') MixPage.open(item)
      else PlaylistPage.open(item)
    })
  })
}

function _updateSortChips(rowId, activeSort) {
  document.querySelectorAll(`#${rowId} .sort-chip`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sort === activeSort)
  })
}
