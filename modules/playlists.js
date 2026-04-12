// Playlists
const KEY = 'library.playlists';
let _S = null;

export function init(S) {
  _S = S;
  if (!_S.get(KEY)) _S.set(KEY, []);
}

// Retrieval
export const getAll = () => _S.get(KEY) || [];
export const get = (id) => getAll().find(p => String(p.id) === String(id)) || null;

// Lifecycle
export function create({ name, description = '', cover = '', tracks = [] }) {
  const pl = { id: _uid(), name: name.trim(), description: description.trim(), cover: cover.trim(), createdAt: Date.now(), tracks: [...tracks] };
  _S.set(KEY, [...getAll(), pl]);
  return pl;
}

export function update(id, { name, description, cover }) {
  _S.set(KEY, getAll().map(p => String(p.id) === String(id) ? { ...p, ...(name && { name: name.trim() }), ...(description !== undefined && { description: description.trim() }), ...(cover !== undefined && { cover: cover.trim() }) } : p));
}

export const deletePlaylist = (id) => _S.set(KEY, getAll().filter(p => String(p.id) !== String(id)));

// Track Management
export function addTrack(id, track) {
  _S.set(KEY, getAll().map(p => {
    if (String(p.id) !== String(id) || p.tracks.some(t => t.id === track.id)) return p;
    return { ...p, tracks: [...p.tracks, track] };
  }));
}

export function removeTrack(id, tid) {
  _S.set(KEY, getAll().map(p => String(p.id) === String(id) ? { ...p, tracks: p.tracks.filter(t => t.id !== tid) } : p));
}

export function moveTrack(id, from, to) {
  _S.set(KEY, getAll().map(p => {
    if (String(p.id) !== String(id)) return p;
    const ts = [...p.tracks];
    if (from < 0 || to < 0 || from >= ts.length || to >= ts.length) return p;
    const [t] = ts.splice(from, 1);
    ts.splice(to, 0, t);
    return { ...p, tracks: ts };
  }));
}

const _uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
