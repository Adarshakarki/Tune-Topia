// modules/cache.js — in-memory + localStorage TTL cache
const _mem = new Map()
const LS_PRE = 'tt_c_'

export function hasValid(key) {
  const m = _mem.get(key)
  if (m && Date.now() < m.e) return true
  try {
    const raw = localStorage.getItem(LS_PRE + key)
    if (!raw) return false
    const { e } = JSON.parse(raw)
    return Date.now() < e
  } catch {
    return false
  }
}

export function get(key) {
  const m = _mem.get(key)
  if (m) {
    if (Date.now() < m.e) return m.v
    _mem.delete(key)
  }
  try {
    const raw = localStorage.getItem(LS_PRE + key)
    if (!raw) return null
    const { v, e } = JSON.parse(raw)
    if (Date.now() < e) {
      _mem.set(key, { v, e })
      return v
    }
    localStorage.removeItem(LS_PRE + key)
  } catch {}
  return null
}

export function set(key, val, ttl = 5 * 60 * 1000) {
  const e = Date.now() + ttl
  _mem.set(key, { v: val, e })
  try {
    localStorage.setItem(LS_PRE + key, JSON.stringify({ v: val, e }))
  } catch {
  }
}

export function remove(key) {
  _mem.delete(key)
  try {
    localStorage.removeItem(LS_PRE + key)
  } catch {}
}

export function clear() {
  _mem.clear()
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS_PRE))
    .forEach(k => localStorage.removeItem(k))
}

export function size() {
  return Object.keys(localStorage).filter(k => k.startsWith(LS_PRE)).length
}