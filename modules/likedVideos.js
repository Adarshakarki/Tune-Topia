import State from '../app/state.js';

// Retrieval
export const getAll = () => State.get('library.likedVideos') || [];
export const has = (id) => getAll().some(v => String(v.id) === String(id));
export const isLiked = has;

// State Mutators
export function toggle(video) {
  const all = getAll(), id = String(video.id);
  const exists = all.some(v => String(v.id) === id);
  const updated = exists
    ? all.filter(v => String(v.id) !== id)
    : [{ ...video, id, likedAt: Date.now() }, ...all];

  State.set('library.likedVideos', updated);
  return !exists;
}

export const count = () => getAll().length;
