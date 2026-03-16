// api/services/tidal.service.js — business logic, normalization

import {
  get,
  getPlaylist as getPlaylistRaw,
  getBases,
} from '../client/tidal.client.js';
import { tidalCover, decodeManifest, normalizeTrack } from '../utils.js';

const QUALITY_TIERS = {
  hires: ['HI_RES_LOSSLESS', 'LOSSLESS', 'HIGH'],
  lossless: ['LOSSLESS', 'HIGH'],
  high: ['HIGH', 'LOSSLESS'],
  low: ['HIGH', 'LOSSLESS'], // LOW returns 403 on all instances — use HIGH instead
};

// ── Search ────────────────────────────────────────────────────

export async function searchTracks(query) {
  const { data } = await get(`/search/?s=${encodeURIComponent(query)}`);
  return (data?.data?.items || data?.items || []).map((t) =>
    normalizeTrack(t, 'tidal'),
  );
}

export async function searchAlbums(query) {
  let items = [];
  try {
    const { data } = await get(`/search/albums?s=${encodeURIComponent(query)}`);
    items = data?.data?.items || data?.items || [];
    if (items.length && items[0]?.cover && !items[0]?.album) {
      return _dedupeAlbums(items.map(_albumFromObject));
    }
  } catch {}

  if (!items.length) {
    const { data } = await get(`/search/?s=${encodeURIComponent(query)}`);
    items = data?.data?.items || data?.items || [];
  }
  return _dedupeAlbums(
    items.filter((t) => t.album?.cover).map(_albumFromTrack),
  );
}

export async function searchArtists(query) {
  const { data } = await get(`/search/?a=${encodeURIComponent(query)}`);
  return (data?.data?.artists?.items || data?.artists?.items || []).map(
    (a) => ({
      id: String(a.id),
      name: a.name,
      cover: tidalCover(a.picture, 320),
      popularity: a.popularity || 0,
      type: 'artist',
    }),
  );
}

export async function searchPlaylists(query, limit = 6) {
  const bases = await getBases();
  const paths = [
    `/search?p=${encodeURIComponent(query)}&limit=${limit}`,
    `/search?s=${encodeURIComponent(query)}&limit=${limit}`,
  ];
  let raw = [];
  for (const path of paths) {
    try {
      const { data } = await get(path, bases);
      const items =
        data?.items ||
        data?.playlists?.items ||
        data?.data?.items ||
        data?.data?.playlists?.items ||
        [];
      const playlists = items.filter((p) => p.uuid || p.numberOfTracks != null);
      if (playlists.length) {
        raw = playlists;
        break;
      }
    } catch {}
  }
  return raw.map(_normalizePlaylist).filter((p) => p.id);
}

// ── Album ─────────────────────────────────────────────────────

export async function getAlbumTracks(albumId) {
  const { data } = await get(`/album?id=${albumId}`);
  const album = data?.data || data || {};
  const albumCover = album.cover || '';
  const albumTitle = album.title || '';
  return (album.items || [])
    .filter((row) => row.type === 'track' || row.item)
    .map((row) => {
      const t = row.item || row;
      if (!t.album?.cover && albumCover)
        t.album = { ...(t.album || {}), cover: albumCover, title: albumTitle };
      return normalizeTrack(t, 'tidal');
    });
}

// ── Artist ────────────────────────────────────────────────────

export async function getArtistTopTracks(artistId) {
  const { data } = await get(`/artist/?id=${artistId}&limit=5`);
  return (
    data?.data?.topTracks?.items ||
    data?.topTracks?.items ||
    data?.items ||
    []
  )
    .slice(0, 5)
    .map((t) => normalizeTrack(t, 'tidal'));
}

export async function getArtistAlbums(artistId) {
  const { data } = await get(`/artist/?id=${artistId}`);
  const items = data?.data?.albums?.items || data?.albums?.items || [];
  const seen = new Set();
  return items
    .filter((a) => a.cover && !seen.has(a.id) && seen.add(a.id))
    .map((a) => ({
      id: String(a.id),
      title: a.title,
      artist: a.artists?.map((x) => x.name).join(', ') || '',
      cover: tidalCover(a.cover, 640),
      coverSmall: tidalCover(a.cover, 320),
      year: a.releaseDate ? new Date(a.releaseDate).getFullYear() : null,
      type: a.type === 'SINGLE' ? 'single' : 'album',
    }));
}

// ── Playlist ──────────────────────────────────────────────────

export async function getPlaylist(playlistId) {
  let data;
  try {
    ({ data } = await getPlaylistRaw(`/playlist/${playlistId}`));
  } catch {
    ({ data } = await getPlaylistRaw(`/playlist?id=${playlistId}`));
  }
  const playlist = data?.playlist || data?.data || data || {};
  const rawItems = data?.items || playlist.items || [];
  const imgId = playlist.squareImage || playlist.image || playlist.cover || '';

  const tracks = rawItems
    .map((row) => {
      const t = row.item || (row.id ? row : null);
      if (!t) return null;
      if (!t.album?.cover && imgId)
        t.album = { ...(t.album || {}), cover: imgId };
      return normalizeTrack(t, 'tidal');
    })
    .filter(Boolean);

  return {
    id: String(playlist.uuid || playlistId),
    title: playlist.title || 'Playlist',
    description: playlist.description || '',
    cover: tidalCover(imgId, 640),
    coverSmall: tidalCover(imgId, 320),
    trackCount: playlist.numberOfTracks || tracks.length,
    tracks,
    type: 'playlist',
  };
}

// ── Home ──────────────────────────────────────────────────────

export async function getHomeTrending() {
  const queries = ['top hits 2025', 'new releases 2025', 'trending now'];
  const results = await Promise.allSettled(queries.map((q) => searchTracks(q)));
  const seen = new Set();
  const tracks = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const t of r.value) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        tracks.push(t);
      }
    }
  }
  return tracks;
}

// ── Stream ────────────────────────────────────────────────────

export async function getStream(trackId) {
  const pref = localStorage.getItem('tt_quality') || 'lossless';
  const tiers = QUALITY_TIERS[pref] || QUALITY_TIERS.lossless;
  for (const quality of tiers) {
    try {
      const { data } = await get(`/track/?id=${trackId}&quality=${quality}`);
      const payload = data?.data || data;
      if (!payload?.manifest) continue;
      return decodeManifest(payload);
    } catch {}
  }
  throw new Error('No stream available from Tidal providers');
}

// ── Tidal Video ───────────────────────────────────────────────

export async function searchTidalVideos(query) {
  // Only api.monochrome.tf and arran.monochrome.tf support video search
  const VIDEO_DOMAINS = ['api.monochrome.tf', 'arran.monochrome.tf'];
  try {
    const { data } = await get(
      `/search/?v=${encodeURIComponent(query)}`,
      null,
      { allowedDomains: VIDEO_DOMAINS },
    );
    // Response has videos section — find it
    const items = data?.videos?.items || data?.data?.videos?.items || [];
    return items.map((v) => _normalizeVideo(v)).filter((v) => v.id);
  } catch {}
  return [];
}

export async function getTidalVideoStream(videoId) {
  const VIDEO_DOMAINS = ['api.monochrome.tf', 'arran.monochrome.tf'];
  const { data } = await get(`/video/?id=${videoId}`, null, {
    allowedDomains: VIDEO_DOMAINS,
  });
  // Response shape: { version, video: { manifest, ... } }
  const payload = data?.video || data?.data || data;
  if (!payload?.manifest) throw new Error('No video manifest');

  // Manifest is base64-encoded JSON: { mimeType, urls: [hlsUrl] }
  const decoded = JSON.parse(atob(payload.manifest));
  const hlsUrl = decoded?.urls?.[0];
  if (!hlsUrl) throw new Error('No HLS URL in manifest');

  return { type: 'hls', url: hlsUrl };
}

function _normalizeVideo(v) {
  const imgId = v.imageId || v.cover || v.album?.cover || '';
  return {
    id: String(v.id || ''),
    title: v.title || 'Unknown',
    artist: (v.artists || [v.artist])
      .filter(Boolean)
      .map((a) => a?.name || a)
      .join(', '),
    cover: tidalCover(imgId, 640),
    coverSmall: tidalCover(imgId, 320),
    duration: v.duration || 0,
    source: 'tidal-video',
    type: 'video',
  };
}

// ── Private helpers ───────────────────────────────────────────

function _albumFromObject(a) {
  return {
    id: String(a.id),
    title: a.title,
    artist: (a.artists || [a.artist])
      .filter(Boolean)
      .map((x) => x?.name)
      .join(', '),
    cover: tidalCover(a.cover, 640),
    coverSmall: tidalCover(a.cover, 320),
    year: a.releaseDate ? new Date(a.releaseDate).getFullYear() : null,
    type: 'album',
  };
}

function _albumFromTrack(t) {
  return {
    id: String(t.album.id),
    title: t.album.title,
    artist: (t.artists || [t.artist])
      .filter(Boolean)
      .map((a) => a?.name)
      .join(', '),
    cover: tidalCover(t.album.cover, 640),
    coverSmall: tidalCover(t.album.cover, 320),
    year: t.album.releaseDate
      ? new Date(t.album.releaseDate).getFullYear()
      : null,
    type: 'album',
  };
}

function _dedupeAlbums(albums) {
  const seen = new Set();
  return albums.filter((a) => !seen.has(a.id) && seen.add(a.id)).slice(0, 20);
}

function _normalizePlaylist(p) {
  const imgId = p.squareImage || p.image || p.cover || '';
  return {
    id: String(p.uuid || p.id || ''),
    title: p.title || p.name || '',
    description: p.description || '',
    cover: tidalCover(imgId, 640),
    coverSmall: tidalCover(imgId, 320),
    trackCount: p.numberOfTracks || 0,
    tracks: [],
    type: 'playlist',
  };
}
