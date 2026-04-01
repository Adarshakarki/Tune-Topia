const _mem = new Map(), LS = 'tt_c_';

// Check if key exists and is not expired
export function hasValid(key) {
  return get(key) !== null;
}

// Retrieve value from memory or localStorage
export function get(key) {
  let m = _mem.get(key);
  try {
    if (!m) {
      const raw = localStorage.getItem(LS + key);
      if (raw) m = JSON.parse(raw);
    }
    if (m && Date.now() < m.e) {
      _mem.set(key, m);
      return m.v;
    }
  } catch {}
  remove(key);
  return null
}

// Persist value with expiration (default 5m)
export function set(key, val, ttl = 5 * 60 * 1000) {
  const data = { v: val, e: Date.now() + ttl };
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
  return Object.keys(localStorage).filter(k => k.startsWith(LS)).length;
}