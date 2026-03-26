/**
 * Simple cache module for API responses
 */

const CACHE_PREFIX = 'tt_cache_'
const DEFAULT_TTL = 1000 * 60 * 30 // 30 minutes

export function get(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key)
    if (!item) return null
    const data = JSON.parse(item)
    if (Date.now() > data.expiry) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data.value
  } catch {
    return null
  }
}

export function set(key, value, ttl = DEFAULT_TTL) {
  try {
    const item = {
      value,
      expiry: Date.now() + ttl,
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item))
  } catch {}
}

export function remove(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key)
  } catch {}
}

export function clear() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  } catch {}
}

export function getStats() {
  try {
    let count = 0
    let size = 0
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        count++
        size += localStorage.getItem(key).length
      }
    })
    return { count, size: Math.round(size / 1024) } // KB
  } catch {
    return { count: 0, size: 0 }
  }
}
