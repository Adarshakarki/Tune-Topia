// History
const KEY = 'tt_history', MAX = 120;

// Storage
const _load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const _save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

const History = {
  // Push
  push: (item, type = 'track') => {
    if (!item?.id && !item?.uuid) return;
    const id = item.id || item.uuid;
    // Add a timestamp to track when the song was played
    const entry = { ...item, type, playedAt: Date.now() };
    const list = [entry, ..._load().filter(x => (x.id || x.uuid) !== id || x.type !== type)].slice(0, MAX);
    _save(list);
  },
  getAll: () => _load().sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0)),

  /**
   * Returns history items grouped by human-readable dates (e.g., "Today", "Yesterday").
   */
  getGrouped: () => {
    const all = History.getAll();
    const groups = new Map();
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(new Date().setDate(now.getDate() - 1)).toDateString();

    all.forEach(item => {
      const d = new Date(item.playedAt || Date.now());
      const ds = d.toDateString();
      const label = ds === today ? 'Today' : ds === yesterday ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      
      if (!groups.has(label)) groups.set(label, { tracks: [], collections: [] });
      const g = groups.get(label);
      if (item.type === 'track' || item.type === 'video') g.tracks.push(item);
      else g.collections.push(item);
    });

    return Array.from(groups.entries()).map(([date, data]) => ({ date, ...data }));
  },
  clear: () => _save([])
};

export default History;
