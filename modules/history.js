// History
const KEY = 'tt_history', MAX = 80;

// Storage
const _load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const _save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

const History = {
  // Push
  push: (t) => {
    if (!t?.id) return;
    const list = [t, ..._load().filter(x => String(x.id) !== String(t.id))].slice(0, MAX);
    _save(list);
  },
  getAll: () => _load(),
  clear: () => _save([])
};

export default History;
