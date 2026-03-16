// modules/history.js

const KEY = 'tt_history';
const MAX = 80;

const History = (() => {
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  function push(track) {
    const updated = [track, ...load().filter((t) => t.id !== track.id)].slice(
      0,
      MAX,
    );
    save(updated);
  }

  function getAll() {
    return load();
  }

  function clear() {
    save([]);
  }

  return { push, getAll, clear };
})();

export default History;
