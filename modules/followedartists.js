const KEY = 'followedArtists';

// Persistent storage helpers
function _load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

function _save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

// State checks
export const isFollowed = (id) => !!_load()[String(id)];

export function toggleFollow(artist) {
  const data = _load(), id = String(artist.id || artist.name);
  if (data[id]) delete data[id];
  else data[id] = { id, name: artist.name, cover: artist.cover || '', followedAt: Date.now() };
  _save(data);
  window.dispatchEvent(new CustomEvent('followedArtistsChanged'));
}

// Retrieval
export function getAll() {
  return Object.values(_load()).sort((a, b) => b.followedAt - a.followedAt);
}

export const getCount = () => Object.keys(_load()).length;
