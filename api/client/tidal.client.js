// Tidal Client
import { fetchJSON, tryBases } from '../utils.js'

const HARDCODED_BASES = [
  'https://eu-central.monochrome.tf',
  'https://us-west.monochrome.tf',
  'https://arran.monochrome.tf',
  'https://api.monochrome.tf',
  'https://monochrome-api.samidy.com',
  'https://triton.squid.wtf',
  'https://wolf.qqdl.site',
  'https://maus.qqdl.site',
  'https://vogel.qqdl.site',
  'https://hund.qqdl.site',
  'https://tidal.kinoplus.online',
  'https://katze.qqdl.site',
  'https://hifi.p1nkhamster.xyz',
  'https://lossless.wtf',
  'https://tidal-api.binimum.org',
]

const P_PLAYLIST = 'https://eu-central.monochrome.tf', P_ALBUM = 'https://lossless.wtf';
const UPTIMES = ['https://tidal-uptime.jiffy-puffs-1j.workers.dev/', 'https://tidal-uptime.props-76styles.workers.dev/'];
const BLOCKED = [];
let _resolved = null;

const _isSafe = u => {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === 'https:' && !BLOCKED.some(b => hostname === b || hostname.endsWith('.' + b));
  } catch { return false; }
};

// Bases
export async function getBases() {
  if (_resolved) return _resolved;
  const urls = UPTIMES.sort(() => Math.random() - 0.5);
  for (const u of urls) {
    try {
      const d = await fetchJSON(u);
      const ins = (d.api || []).map(i => (i.url || i).replace(/\/$/, '')).filter(_isSafe);
      if (ins.length >= 3) return _resolved = ins;
    } catch {}
  }
  return HARDCODED_BASES;
}

// GET
export async function get(path, bases, opts = {}) {
  let all = [...(bases || await getBases()), ...HARDCODED_BASES];
  all = [...new Set(all)];
  if (opts.allowedDomains?.length) {
    all = all.filter(b => opts.allowedDomains.some(d => new URL(b).hostname.endsWith(d)));
  }
  return tryBases(all, path);
}

const _pri = async (p, path) => {
  const b = await getBases();
  return tryBases([p, ...b.filter(x => x !== p)], path);
};

export const getAlbum = path => _pri(P_ALBUM, path);
export const getPlaylist = path => _pri(P_PLAYLIST, path);
export { HARDCODED_BASES };