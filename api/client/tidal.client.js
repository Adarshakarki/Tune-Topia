import { fetchJSON, tryBases } from '../utils.js'

const HARDCODED_BASES = [
  'https://api.monochrome.tf',
  'https://arran.monochrome.tf',
  'https://eu-central.monochrome.tf',
  'https://us-west.monochrome.tf',
  'https://monochrome-api.samidy.com',
  'https://triton.squid.wtf',
  'https://wolf.qqdl.site',
  'https://maus.qqdl.site',
  'https://vogel.qqdl.site',
  'https://katze.qqdl.site',
  'https://hund.qqdl.site',
  'https://hifi.p1nkhamster.xyz',
  'https://lossless.wtf',
  'https://tidal.kinoplus.online',
  'https://tidal-api.binimum.org',
]

const PLAYLIST_PRIORITY_BASE = 'https://eu-central.monochrome.tf'

const UPTIME_URLS = [
  'https://tidal-uptime.jiffy-puffs-1j.workers.dev/',
  'https://tidal-uptime.props-76styles.workers.dev/',
]

const BLOCKED_HOSTNAMES = new Set(['spotisaver.net'])

function _isSafeBase(url) {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    if (BLOCKED_HOSTNAMES.has(hostname)) return false
    for (const blocked of BLOCKED_HOSTNAMES) {
      if (hostname.endsWith('.' + blocked)) return false
    }
    return true
  } catch {
    return false
  }
}

let _resolvedBases = null

export async function getBases() {
  if (_resolvedBases) return _resolvedBases
  const urls = [...UPTIME_URLS].sort(() => Math.random() - 0.5)
  for (const url of urls) {
    try {
      const d = await fetchJSON(url)
      const instances = (d.api || [])
        .map((item) => (item.url || item).replace(/\/$/, ''))
        .filter(_isSafeBase)
      if (instances.length >= 3) {
        _resolvedBases = instances
        return instances
      }
    } catch {}
  }
  return HARDCODED_BASES
}

export async function get(path, bases, options = {}) {
  const live = bases || (await getBases())
  const seen = new Set(live)
  let all = [...live, ...HARDCODED_BASES.filter((b) => !seen.has(b))]
  if (options.allowedDomains?.length) {
    const filtered = all.filter((b) => {
      try {
        const hostname = new URL(b).hostname
        return options.allowedDomains.some((d) => hostname === d || hostname.endsWith('.' + d))
      } catch {
        return false
      }
    })
    if (filtered.length) all = filtered
  }
  return tryBases(all, path)
}

export async function getPlaylist(path) {
  const bases = await getBases()
  const ordered = [
    PLAYLIST_PRIORITY_BASE,
    ...bases.filter((b) => b !== PLAYLIST_PRIORITY_BASE),
  ]
  return tryBases(ordered, path)
}

export { HARDCODED_BASES }