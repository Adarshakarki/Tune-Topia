// api/index.js — single import point for all API calls
// Nothing outside this folder should import from client/ or services/ directly

export {
  searchTracks,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  searchTidalVideos,
  getTidalVideoStream,
  getAlbumTracks,
  getArtistTopTracks,
  getArtistAlbums,
  getPlaylist,
  getHomeTrending,
  getStream,
} from './services/tidal.service.js';

export {
  searchVideos,
  getAudioStream,
  getVideoStream,
  normalizeVideo,
} from './services/youtube.service.js';

export {
  fetchJSON,
  tryBases,
  tidalCover,
  decodeManifest,
  normalizeTrack,
  qualityBadge,
  fmtDur,
  fmtTime,
  escHtml,
} from './utils.js';
