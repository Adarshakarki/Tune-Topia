import State from '../app/state.js'

// Retrieval
export const getAll = () => State.get('library.likedSongs') || [];
export const has = (id) => getAll().some(t => String(t.id) === String(id));

// State Mutators
export function add(track) {
  if (!has(track.id)) {
    State.set('library.likedSongs', [{ ...track, id: String(track.id) }, ...getAll()]);
  }
}

export function remove(id) {
  State.set('library.likedSongs', getAll().filter(t => String(t.id) !== String(id)));
}

export function toggle(track) {
  const isLiked = has(track.id);
  isLiked ? remove(track.id) : add(track);
  return !isLiked;
}

// Helpers
export const count = () => getAll().length;
export const sortByTitle = () => [...getAll()].sort((a, b) => a.title.localeCompare(b.title));
export const filter = (query) => {
  const q = query.toLowerCase();
  return getAll().filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
};
