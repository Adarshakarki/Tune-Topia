import State from '../app/state.js';

const KEY = 'tt_liked';

function _save(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
  State.set('library.likedSongs', arr);
}

function getAll() {
  return State.get('library.likedSongs');
}

function has(id) {
  return getAll().some((t) => t.id === String(id));
}

function add(track) {
  if (has(track.id)) return;
  const updated = [{ ...track, id: String(track.id) }, ...getAll()];
  _save(updated);
}

function remove(id) {
  const updated = getAll().filter((t) => t.id !== String(id));
  _save(updated);
}

function toggle(track) {
  has(track.id) ? remove(track.id) : add(track);
  return has(track.id);
}

function count() {
  return getAll().length;
}

function sortByTitle() {
  return [...getAll()].sort((a, b) => a.title.localeCompare(b.title));
}

function filter(query) {
  const q = query.toLowerCase();
  return getAll().filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
  );
}

export { getAll, has, add, remove, toggle, count, sortByTitle, filter };
