// Cache
const _mem = new Map(), LS = 'tt_c_', MAX_ITEMS = 200;

// Initialize memory cache keys from localStorage to track size and enforce limits across sessions
try {
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS))
    .forEach(k => _mem.set(k.slice(LS.length), null));
} catch {}

// Check if key exists and is not expired
export function hasValid(key) {
  return get(key) !== null;
}

// Retrieve value from memory or localStorage
export function get(key) {
  if (!_mem.has(key)) return null;

  let m = _mem.get(key);
  try {
    if (!m) {
      const raw = localStorage.getItem(LS + key);
      if (raw) m = JSON.parse(raw);
    }
    if (m && Date.now() < m.e) {
      // Refresh position for LRU (Least Recently Used) behavior
      _mem.delete(key);
      _mem.set(key, m);
      return m.v;
    }
  } catch {}
  remove(key);
  return null
}

// Persist value with expiration (default 5m)
export function set(key, val, ttl = 5 * 60 * 1000) {
  // If item is new and we are at the limit, evict the oldest entry
  if (!_mem.has(key) && _mem.size >= MAX_ITEMS) {
    const oldestKey = _mem.keys().next().value;
    remove(oldestKey);
  }

  const data = { v: val, e: Date.now() + ttl };
  // Ensure the key is moved to the "newest" position
  _mem.delete(key);
  _mem.set(key, data);
  try { localStorage.setItem(LS + key, JSON.stringify(data)); } catch {}
}

export function remove(key) {
  _mem.delete(key);
  localStorage.removeItem(LS + key);
}

export function clear() {
  _mem.clear();
  Object.keys(localStorage).filter(k => k.startsWith(LS)).forEach(k => localStorage.removeItem(k));
}

export function size() {
  return _mem.size;
}

/**
 * Returns current cache usage stats.
 * @returns {{usage: number, limit: number, text: string}}
 */
export function getStats() {
  return { usage: _mem.size, limit: MAX_ITEMS, text: `${_mem.size}/${MAX_ITEMS}` };
}