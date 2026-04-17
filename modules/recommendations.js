// Recommendations
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
  
  const personalized = src.slice(0, MAX_PERSONALISED_QUERIES);
  return {
    queries: [...personalized, ..._disc(personalized)],
    isColdStart: false,
    ytFallback: COLD_START_YT_FALLBACK,
  }
}

function _collect(State, History) {
  const followed = State.get('library.followedArtists') || [];
  const liked = State.get('library.likedSongs') || [];
  const albums = State.get('library.savedAlbums') || [];
  const hist = History.getAll() || [];

  const scores = {};
  const nameMap = {}; // Map lowercase keys to best display names

  const bump = (name, w) => {
    if (!name || typeof name !== 'string') return;
    const k = name.trim().toLowerCase();
    if (k) {
      scores[k] = (scores[k] || 0) + w;
      if (!nameMap[k]) nameMap[k] = name;
    }
  };

  // Heavier weight for explicitly followed artists
  followed.forEach(a => bump(a.name || a, 10));
  liked.forEach(t => bump(t.artist, 4));
  albums.forEach(a => bump(a.artist, 3));

  const counts = {};
  hist.forEach(t => { const k = t.artist?.trim().toLowerCase(); if (k) counts[k] = (counts[k] || 0) + 1; });
  
  // History weight capped to prevent single-artist dominance
  Object.entries(counts).forEach(([k, v]) => {
    const originalName = hist.find(t => t.artist?.trim().toLowerCase() === k)?.artist || k;
    bump(originalName, Math.min(v, 10) * 2);
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => nameMap[k])
    .filter(Boolean);
}

// Helpers
const _disc = (existingQueries = []) => {
  const seen = new Set(existingQueries.map(q => q.toLowerCase()));
  const pool = [...Object.values(GENRE_SEEDS), ...COLD_START_ARTISTS]
    .filter(item => !seen.has(item.toLowerCase()));
    
  return _shuffle(pool).slice(0, DISCOVERY_QUERY_COUNT);
};

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
