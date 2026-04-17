import { DEFAULT_DB, MAX_RECENTLY_PLAYED } from "./config.js";

// Core 
const STORAGE_KEY = "tune_topia_db";

export function readDB() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    writeDB(DEFAULT_DB);
    return structuredClone(DEFAULT_DB);
  }
  try {
    return JSON.parse(data);
  } catch (err) {
    console.error("Database corrupted in localStorage. Initializing with defaults.");
    return structuredClone(DEFAULT_DB);
  }
}

export function writeDB(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Updates the active session in the database.
 * @param {string|null} userId 
 */
export function setSession(userId) {
  const db = readDB();
  db.activeSession = userId;
  writeDB(db);
}

/**
 * Returns the ID of the currently logged-in user.
 */
export function getSession() {
  const db = readDB();
  return db.activeSession;
}

// Songs

/**
 * @param {Object} songData
 * @param {string} songData.title
 * @param {string} songData.artistId
 * @param {string} songData.albumId
 * @param {string} [songData.coverImageUrl]
 * @param {string} [songData.tidalUrl]
 * @param {number} [songData.duration]
 */
export function addSong({ title, artistId, albumId, coverImageUrl = "", tidalUrl = "", duration = 0 }) {
  const db = readDB();
  const song = { id: `song-${Date.now()}`, title, artistId, albumId, coverImageUrl, tidalUrl, duration, createdAt: new Date().toISOString() };
  db.songs.push(song);
  writeDB(db);
  return song;
}

export function getAllSongs() {
  return readDB().songs;
}

export function getSongById(songId) {
  const song = readDB().songs.find(s => s.id === songId);
  if (!song) throw new Error(`Song ${songId} not found.`);
  return song;
}

export function getSongsByArtist(artistId) {
  return readDB().songs.filter(s => s.artistId === artistId);
}

export function getSongsByAlbum(albumId) {
  return readDB().songs.filter(s => s.albumId === albumId);
}

export function updateSong(songId, updates) {
  const db = readDB();
  const idx = db.songs.findIndex(s => s.id === songId);
  if (idx === -1) throw new Error(`Song ${songId} not found.`);
  db.songs[idx] = { ...db.songs[idx], ...updates };
  writeDB(db);
  return db.songs[idx];
}

export function deleteSong(songId) {
  const db = readDB();
  db.songs = db.songs.filter(s => s.id !== songId);
  db.playlists = db.playlists.map(p => ({ ...p, songIds: p.songIds.filter(id => id !== songId) }));
  db.likedSongs = db.likedSongs.filter(l => l.songId !== songId);
  db.recentlyPlayed = db.recentlyPlayed.filter(r => r.songId !== songId);
  writeDB(db);
}

// Artists

export function addArtist({ name, imageUrl = "", bio = "", genres = [] }) {
  const db = readDB();
  const artist = { id: `artist-${Date.now()}`, name, imageUrl, bio, genres };
  db.artists.push(artist);
  writeDB(db);
  return artist;
}

export function getAllArtists() {
  return readDB().artists;
}

export function getArtistById(artistId) {
  const artist = readDB().artists.find(a => a.id === artistId);
  if (!artist) throw new Error(`Artist ${artistId} not found.`);
  return artist;
}

export function updateArtist(artistId, updates) {
  const db = readDB();
  const idx = db.artists.findIndex(a => a.id === artistId);
  if (idx === -1) throw new Error(`Artist ${artistId} not found.`);
  db.artists[idx] = { ...db.artists[idx], ...updates };
  writeDB(db);
  return db.artists[idx];
}

export function deleteArtist(artistId) {
  const db = readDB();
  db.artists = db.artists.filter(a => a.id !== artistId);
  db.followingArtists = db.followingArtists.filter(f => f.artistId !== artistId);
  // Nullify references in songs and albums
  db.songs = db.songs.map(s => s.artistId === artistId ? { ...s, artistId: null } : s);
  db.albums = db.albums.map(a => a.artistId === artistId ? { ...a, artistId: null } : a);
  writeDB(db);
}

export function followArtist(artistId) {
  const db = readDB();
  if (!db.followingArtists.find(f => f.artistId === artistId)) {
    db.followingArtists.push({ artistId, followedAt: new Date().toISOString() });
    writeDB(db);
  }
}

export function unfollowArtist(artistId) {
  const db = readDB();
  db.followingArtists = db.followingArtists.filter(f => f.artistId !== artistId);
  writeDB(db);
}

export function getFollowingArtists() {
  const db = readDB();
  const ids = db.followingArtists.map(f => f.artistId);
  return db.artists.filter(a => ids.includes(a.id));
}

export function isFollowingArtist(artistId) {
  return readDB().followingArtists.some(f => f.artistId === artistId);
}

// Albums

export function addAlbum({ title, artistId, coverImageUrl = "", releaseYear = null, songIds = [] }) {
  const db = readDB();
  const album = { id: `album-${Date.now()}`, title, artistId, coverImageUrl, releaseYear, songIds };
  db.albums.push(album);
  writeDB(db);
  return album;
}

export function getAllAlbums() {
  return readDB().albums;
}

export function getAlbumById(albumId) {
  const album = readDB().albums.find(a => a.id === albumId);
  if (!album) throw new Error(`Album ${albumId} not found.`);
  return album;
}

export function getAlbumsByArtist(artistId) {
  return readDB().albums.filter(a => a.artistId === artistId);
}

export function updateAlbum(albumId, updates) {
  const db = readDB();
  const idx = db.albums.findIndex(a => a.id === albumId);
  if (idx === -1) throw new Error(`Album ${albumId} not found.`);
  db.albums[idx] = { ...db.albums[idx], ...updates };
  writeDB(db);
  return db.albums[idx];
}

export function deleteAlbum(albumId) {
  const db = readDB();
  db.albums = db.albums.filter(a => a.id !== albumId);
  // Nullify references in songs
  db.songs = db.songs.map(s => s.albumId === albumId ? { ...s, albumId: null } : s);
  writeDB(db);
}

// Playlists

export function createPlaylist({ name, coverImageUrl = "" }) {
  const db = readDB();
  const playlist = { id: `playlist-${Date.now()}`, name, coverImageUrl, songIds: [], createdAt: new Date().toISOString() };
  db.playlists.push(playlist);
  writeDB(db);
  return playlist;
}

export function getAllPlaylists() {
  return readDB().playlists;
}

export function getPlaylistById(playlistId) {
  const playlist = readDB().playlists.find(p => p.id === playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);
  return playlist;
}

export function getPlaylistSongs(playlistId) {
  const db = readDB();
  const playlist = db.playlists.find(p => p.id === playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);
  return playlist.songIds.map(id => db.songs.find(s => s.id === id)).filter(Boolean);
}

export function addSongToPlaylist(playlistId, songId) {
  const db = readDB();
  const playlist = db.playlists.find(p => p.id === playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);
  if (!playlist.songIds.includes(songId)) { playlist.songIds.push(songId); writeDB(db); }
  return playlist;
}

export function removeSongFromPlaylist(playlistId, songId) {
  const db = readDB();
  const playlist = db.playlists.find(p => p.id === playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);
  playlist.songIds = playlist.songIds.filter(id => id !== songId);
  writeDB(db);
  return playlist;
}

export function reorderPlaylist(playlistId, newSongIds) {
  const db = readDB();
  const playlist = db.playlists.find(p => p.id === playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found.`);
  playlist.songIds = newSongIds;
  writeDB(db);
  return playlist;
}

export function updatePlaylist(playlistId, updates) {
  const db = readDB();
  const idx = db.playlists.findIndex(p => p.id === playlistId);
  if (idx === -1) throw new Error(`Playlist ${playlistId} not found.`);
  db.playlists[idx] = { ...db.playlists[idx], ...updates };
  writeDB(db);
  return db.playlists[idx];
}

export function deletePlaylist(playlistId) {
  const db = readDB();
  db.playlists = db.playlists.filter(p => p.id !== playlistId);
  writeDB(db);
}

// Liked Songs

export function likeSong(songId) {
  const db = readDB();
  if (!db.likedSongs.find(l => l.songId === songId)) {
    db.likedSongs.push({ songId, likedAt: new Date().toISOString() });
    writeDB(db);
  }
}

export function unlikeSong(songId) {
  const db = readDB();
  db.likedSongs = db.likedSongs.filter(l => l.songId !== songId);
  writeDB(db);
}

export function isLiked(songId) {
  return readDB().likedSongs.some(l => l.songId === songId);
}

export function getLikedSongs() {
  const db = readDB();
  const ids = db.likedSongs.map(l => l.songId);
  return db.songs.filter(s => ids.includes(s.id));
}

// Liked Playlists (API/External)

export function likePlaylist(playlist) {
  const db = readDB();
  if (!db.likedPlaylists) db.likedPlaylists = [];
  const id = playlist.id || playlist.uuid;
  if (!db.likedPlaylists.find(p => (p.id || p.uuid) === id)) {
    db.likedPlaylists.push({ ...playlist, likedAt: new Date().toISOString() });
    writeDB(db);
  }
}

export function unlikePlaylist(playlistId) {
  const db = readDB();
  if (!db.likedPlaylists) return;
  db.likedPlaylists = db.likedPlaylists.filter(p => (p.id || p.uuid) !== playlistId);
  writeDB(db);
}

export function isPlaylistLiked(playlistId) {
  const db = readDB();
  return (db.likedPlaylists || []).some(p => (p.id || p.uuid) === playlistId);
}

// Liked Mixes

export function likeMix(mix) {
  const db = readDB();
  if (!db.likedMixes) db.likedMixes = [];
  const id = mix.id || mix.uuid;
  if (!db.likedMixes.find(m => (m.id || m.uuid) === id)) {
    db.likedMixes.push({ ...mix, likedAt: new Date().toISOString() });
    writeDB(db);
  }
}

export function unlikeMix(mixId) {
  const db = readDB();
  if (!db.likedMixes) return;
  db.likedMixes = db.likedMixes.filter(m => (m.id || m.uuid) !== mixId);
  writeDB(db);
}

export function isMixLiked(mixId) {
  const db = readDB();
  return (db.likedMixes || []).some(m => (m.id || m.uuid) === mixId);
}

// Recently Played

export function recordPlay(songId) {
  const db = readDB();
  db.recentlyPlayed = db.recentlyPlayed.filter(r => r.songId !== songId);
  db.recentlyPlayed.unshift({ songId, playedAt: new Date().toISOString() });
  db.recentlyPlayed = db.recentlyPlayed.slice(0, MAX_RECENTLY_PLAYED);
  writeDB(db);
}

export function getRecentlyPlayed() {
  const db = readDB();
  return db.recentlyPlayed.map(r => db.songs.find(s => s.id === r.songId)).filter(Boolean);
}

export function clearRecentlyPlayed() {
  const db = readDB();
  db.recentlyPlayed = [];
  writeDB(db);
}