// Library
import State from '../app/state.js'

// Albums
export const getSavedAlbums = () => State.get('library.savedAlbums') || [];
export const hasAlbum = (id) => getSavedAlbums().some(a => String(a.id) === String(id));

export const saveAlbum = (a) => !hasAlbum(a.id) && State.set('library.savedAlbums', [{ ...a, id: String(a.id) }, ...getSavedAlbums()]);
export const removeAlbum = (id) => State.set('library.savedAlbums', getSavedAlbums().filter(a => String(a.id) !== String(id)));
export const toggleAlbum = (a) => (hasAlbum(a.id) ? removeAlbum(a.id) : saveAlbum(a), hasAlbum(a.id));

// Artists
export const getFollowedArtists = () => State.get('library.followedArtists') || [];
export const hasArtist = (id) => getFollowedArtists().some(a => String(a.id) === String(id));

export const followArtist = (a) => !hasArtist(a.id) && State.set('library.followedArtists', [{ ...a, id: String(a.id) }, ...getFollowedArtists()]);
export const unfollowArtist = (id) => State.set('library.followedArtists', getFollowedArtists().filter(a => String(a.id) !== String(id)));
export const toggleArtist = (a) => (hasArtist(a.id) ? unfollowArtist(a.id) : followArtist(a), hasArtist(a.id));

// Playlists
export const getPlaylists = () => State.get('library.playlists') || [];

export function createPlaylist(name) {
  const pl = { id: Date.now().toString(36), name, tracks: [], created: Date.now() };
  State.set('library.playlists', [...getPlaylists(), pl]);
  return pl;
}

export function addToPlaylist(playlistId, track) {
  const updated = getPlaylists().map(p => (p.id === playlistId && !p.tracks.some(t => t.id === track.id)) ? { ...p, tracks: [...p.tracks, track] } : p);
  State.set('library.playlists', updated);
}

export function removeFromPlaylist(playlistId, trackId) {
  const updated = getPlaylists().map(p => p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p);
  State.set('library.playlists', updated);
}

export const deletePlaylist = (id) => State.set('library.playlists', getPlaylists().filter(p => p.id !== id));

// Block Artists
export const getBlockedArtists = () => State.get('library.blockedArtists') || [];

export const isArtistBlocked = (artistStr) => {
  if (!artistStr) return false;
  const blocked = getBlockedArtists();
  if (!blocked.length) return false;
  const names = String(artistStr).split(',').map(n => n.trim().toLowerCase());
  return names.some(n => blocked.some(b => b.toLowerCase() === n));
};

export const isBlocked = (name) => {
  if (!name) return false;
  return getBlockedArtists().some(b => b.toLowerCase() === name.toLowerCase());
};

export const toggleBlockArtist = (name) => {
  if (!name) return;
  const list = getBlockedArtists();
  const exists = isBlocked(name);
  const updated = exists ? list.filter(b => b.toLowerCase() !== name.toLowerCase()) : [...list, name];
  State.set('library.blockedArtists', updated);
  return !exists;
};
