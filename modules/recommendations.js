import {
  COLD_START_ARTISTS,
  COLD_START_PICK_COUNT,
  COLD_START_YT_FALLBACK,
  GENRE_SEEDS,
  DISCOVERY_QUERY_COUNT,
  MAX_PERSONALISED_QUERIES,
} from '../data/defaults.js'

// Logic
export function getHomeQueries(State, History) {
  const src = _collect(State, History)
  if (!src.length) return { queries: _cold(), isColdStart: true, ytFallback: COLD_START_YT_FALLBACK }
  
  return {
    queries: _dedupe([...src.slice(0, MAX_PERSONALISED_QUERIES), ..._disc()]),
    isColdStart: false,
    ytFallback: COLD_START_YT_FALLBACK,
  }
}

function _collect(State, History) {
  const scores = {}, bump = (a, w) => {
    const k = a?.trim().toLowerCase();
    if (k) scores[k] = (scores[k] || 0) + w;
  };

  (State.get('library.followedArtists') || []).forEach(a => bump(a.name || a, 5));
  (State.get('library.likedSongs') || []).forEach(t => bump(t.artist, 3));
  (State.get('library.savedAlbums') || []).forEach(a => bump(a.artist, 2));

  const hist = History.getAll() || [], counts = {};
  hist.forEach(t => { const k = t.artist?.trim().toLowerCase(); if (k) counts[k] = (counts[k] || 0) + 1; });
  Object.entries(counts).forEach(([k, v]) => bump(hist.find(t => t.artist?.trim().toLowerCase() === k)?.artist || k, v * 1.5));

  const f = State.get('library.followedArtists') || [], l = State.get('library.likedSongs') || [], a = State.get('library.savedAlbums') || [], s = new Set();

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => {
      const m = f.find(x => (x.name || x)?.trim().toLowerCase() === k) ||
                l.find(x => x.artist?.trim().toLowerCase() === k) ||
                a.find(x => x.artist?.trim().toLowerCase() === k) ||
                hist.find(x => x.artist?.trim().toLowerCase() === k);
      return m ? (m.name || m.artist || m) : k;
    })
    .filter(x => { const k = String(x).toLowerCase(); return !s.has(k) && s.add(k); });
}

// Helpers
const _disc = () => _shuffle(Object.values(GENRE_SEEDS)).slice(0, DISCOVERY_QUERY_COUNT);
const _cold = () => _shuffle([...COLD_START_ARTISTS]).slice(0, COLD_START_PICK_COUNT);
const _dedupe = arr => { const s = new Set(); return arr.filter(x => { const k = x.toLowerCase(); return !s.has(k) && s.add(k); }); };
const _shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
