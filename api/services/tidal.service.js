// Tidal Service Provider

import {
  get,
  getAlbum,
  getPlaylist as getPlaylistRaw,
  getBases,
} from '../client/tidal.client.js'

import { tidalCover, decodeManifest, normalizeTrack } from '../utils.js'
import { get as cacheGet, set as cacheSet } from '../../modules/cache.js'

const TTL_SEARCH = 300000
const TTL_ALBUM = 900000
const TTL_RECS = 600000

const Q_MAP = {
  hires: 'HI_RES_LOSSLESS',
  lossless: 'LOSSLESS',
  high: 'HIGH',
  low: 'LOW'
}

// --- Search ---
export async function searchTracks(query) {
  const key = `search:tracks:${query}`
  const cached = cacheGet(key)
  if (cached) return cached

  const { data } = await get(`/search?s=${encodeURIComponent(query)}`)
  const tracks = (data?.data?.items || data?.items || [])
    .map(t => normalizeTrack(t, 'tidal'))

  cacheSet(key, tracks, TTL_SEARCH)
  return tracks
}

export async function searchAlbums(query) {
  const key = `search:albums:${query}`
  const cached = cacheGet(key)
  if (cached) return cached

  const { data } = await get(`/search?s=${encodeURIComponent(query)}`)
  const items = data?.data?.items || data?.items || []

  const albums = items.length && items[0]?.cover && !items[0]?.album
    ? items.map(_albObj)
    : items.filter(t => t.album?.cover).map(_albTrk)

  const res = _dedupe(albums)

  cacheSet(key, res, TTL_ALBUM)
  return res
}

export const searchArtists = async (query) => {
  const { data } = await get(`/search?a=${encodeURIComponent(query)}`)
  const items = data?.data?.artists?.items || data?.artists?.items || data?.artists || []
  return items.filter(a => a.id)
    .map(a => ({
      id: String(a.id),
      name: a.name,
      cover: tidalCover(a.picture, 320),
      type: 'artist'
    }))
}

export async function searchPlaylists(query, limit = 6) {
  const bases = await getBases()

  const paths = [
    `/search?p=${encodeURIComponent(query)}&limit=${limit}`,
    `/search?s=${encodeURIComponent(query)}&limit=${limit}`
  ]

  for (const path of paths) {
    try {
      const { data } = await get(path, bases)

      const items =
        data?.items ||
        data?.playlists?.items ||
        data?.data?.items ||
        data?.data?.playlists?.items ||
        []

      const playlists = items.filter(p => p.uuid || p.numberOfTracks != null)

      if (playlists.length) return playlists.map(_normPl)
    } catch {}
  }

  return []
}

// --- Album / Artist ---
export async function getAlbumTracks(albumId) {
  const key = `album:tracks:${albumId}`
  const cached = cacheGet(key)
  if (cached) return cached

  const { data } = await getAlbum(`/album?id=${albumId}`)
  const album = data?.data || data || {}

  const tracks = (album.items || [])
    .filter(r => r.type === 'track' || r.item)
    .map(r => {
      const t = r.item || r
      if (!t.album?.cover && album.cover) {
        t.album = { ...t.album, cover: album.cover, title: album.title }
      }
      return normalizeTrack(t, 'tidal')
    })

  cacheSet(key, tracks, TTL_ALBUM)
  return tracks
}

export const getArtistTopTracks = async (id) => {
  const { data } = await get(`/artist/?id=${id}&limit=5`)
  return (data?.data?.topTracks?.items || data?.topTracks?.items || [])
    .slice(0, 5)
    .map(t => normalizeTrack(t, 'tidal'))
}

export const getArtistAlbums = async (id) => {
  const { data } = await get(`/artist?id=${id}`)
  const items = data?.data?.albums?.items || data?.albums?.items || []

  const seen = new Set()
  return items
    .filter(a => a.cover && !seen.has(a.id) && seen.add(a.id))
    .map(a => ({
      id: String(a.id),
      title: a.title,
      artist: a.artists?.map(x => x.name).join(', ') || '',
      cover: tidalCover(a.cover, 640),
      coverSmall: tidalCover(a.cover, 320),
      year: a.releaseDate ? new Date(a.releaseDate).getFullYear() : null,
      type: a.type === 'SINGLE' ? 'single' : 'album'
    }))
}

// --- Playlist ---
export async function getPlaylist(id) {
  const key = `playlist:${id}`
  const cached = cacheGet(key)
  if (cached) return cached

  let data
  try {
    ({ data } = await getPlaylistRaw(`/playlist?id=${id}`))
  } catch (err) {
    console.error(`Failed to fetch playlist ${id}:`, err);
    return { id, title: 'Playlist', tracks: [], type: 'playlist' };
  }

  const pl = data?.playlist || data?.data || data || {}
  const items = data?.items || pl.items || []

  const tracks = items
    .map(r => {
      const t = r.item || (r.id ? r : null)
      return t ? normalizeTrack(t, 'tidal') : null
    })
    .filter(Boolean)

  const res = {
    id: String(pl.uuid || id),
    title: pl.title || 'Playlist',
    description: pl.description || '',
    cover: tidalCover(pl.squareImage || pl.image || pl.cover, 640),
    coverSmall: tidalCover(pl.squareImage || pl.image || pl.cover, 320),
    trackCount: pl.numberOfTracks || tracks.length,
    tracks,
    type: 'playlist'
  }

  cacheSet(key, res, TTL_ALBUM)
  return res
}

export async function getHomeTrending() {
  const qs = ['top hits 2025', 'new releases 2025', 'trending now']
  const rs = await Promise.allSettled(qs.map(searchTracks))
  const s = new Set(), res = []
  for (const r of rs) {
    if (r.status === 'fulfilled') {
      for (const t of r.value) if (!s.has(t.id)) { s.add(t.id); res.push(t) }
    }
  }
  return res
}

export async function getTrackRecommendations(id) {
  try {
    const { data } = await get(`/recommendations/?id=${id}`)
    return (data?.items || data?.data?.items || [])
      .map(i => normalizeTrack(i.track || i))
      .filter(t => t.id)
  } catch {
    return []
  }
}

// --- Stream (Audio) ---
export async function getStream(trackId) {
  const pref = localStorage.getItem('tt_quality') || 'lossless'
  const quality = Q_MAP[pref] || Q_MAP.lossless

  for (const q of [quality, Q_MAP.high, Q_MAP.lossless]) {
    try {
      const { data } = await get(`/track/?id=${trackId}&quality=${q}`)
      const payload = data?.data || data

      if (payload?.manifest) {
        const decoded = decodeManifest(payload)
        if (decoded.quality === 'LOW' && q !== Q_MAP.low) continue
        return decoded
      }
    } catch {}
  }

  throw new Error('Stream unavailable')
}

// --- Video ---
export const searchTidalVideos = async (query) => {
  try {
    const { data } = await get(
      `/search?v=${encodeURIComponent(query)}`,
      null,
      { allowedDomains: ['hifi-one.spotisaver.net'] }
    )

    return (data?.videos?.items || data?.data?.videos?.items || [])
      .map(_normVid)
      .filter(v => v.id)
  } catch {
    return []
  }
}

export const getTidalVideoStream = async (id) => {
  for (const q of ['HIGH', 'LOW']) {
    try {
      const { data } = await get(
        `/video?id=${id}&quality=${q}`,
        ['https://hifi-one.spotisaver.net']  
      )

      const p = data?.video || data?.data || data
      if (!p?.manifest) continue

      const m = JSON.parse(atob(p.manifest))
      const urls = m?.urls || []
      if (!urls.length) continue

      return {
        type: m?.mimeType?.includes('mpegurl') ? 'hls' : 'mp4',
        url: urls[urls.length - 1],
        duration: p.duration || m?.duration || 0
      }
    } catch {}
  }

  throw new Error('Video stream unavailable')
}

// --- Helpers ---
const _normVid = v => {
  const img = v.imageId || v.cover || v.album?.cover || ''
  return {
    id: String(v.id || ''),
    title: v.title || 'Unknown',
    artist: (v.artists || [v.artist])
      .filter(Boolean)
      .map(a => a?.name || a)
      .join(', '),
    cover: tidalCover(img, 640),
    coverSmall: tidalCover(img, 320),
    duration: v.duration || 0,
    source: 'tidal-video',
    type: 'video'
  }
}

const _albObj = a => ({
  id: String(a.id),
  title: a.title,
  artist: (a.artists || [a.artist]).map(x => x?.name).join(', '),
  cover: tidalCover(a.cover, 640),
  coverSmall: tidalCover(a.cover, 320),
  year: a.releaseDate ? new Date(a.releaseDate).getFullYear() : null,
  type: 'album'
})

const _albTrk = t => ({
  id: String(t.album.id),
  title: t.album.title,
  artist: (t.artists || [t.artist]).map(a => a?.name).join(', '),
  cover: tidalCover(t.album.cover, 640),
  coverSmall: tidalCover(t.album.cover, 320),
  year: t.album.releaseDate ? new Date(t.album.releaseDate).getFullYear() : null,
  type: 'album'
})

const _dedupe = arr => {
  const seen = new Set()
  return arr.filter(a => !seen.has(a.id) && seen.add(a.id)).slice(0, 20)
}

const _normPl = p => {
  const img = p.squareImage || p.image || p.cover || ''
  return {
    id: String(p.uuid || p.id || ''),
    title: p.title || p.name || '',
    description: p.description || '',
    cover: tidalCover(img, 640),
    coverSmall: tidalCover(img, 320),
    trackCount: p.numberOfTracks || 0,
    tracks: [],
    type: 'playlist'
  }
}