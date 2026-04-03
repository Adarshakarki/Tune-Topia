// Global reactive state management
const State = (() => {
  const _state = {
    user: {
      name: localStorage.getItem('tt_username') || 'Friend',
      pfp: localStorage.getItem('tt_pfp') || '',
      greeting: ''
    },
    player: {
      currentTrack: null, isPlaying: false, isShuffle: false, isRepeat: false,
      volume: parseFloat(localStorage.getItem('tt_vol') || '0.8'),
      queuePosition: -1
    },
    queue: { tracks: [], played: [], upcoming: [] },
    search: { query: '', activeTab: 'music', isLoading: false, topResult: null, results: [], mood: null },
    library: { likedSongs: [], savedAlbums: [], followedArtists: [], playlists: [], likedVideos: [] },
    ui: { theme: 'none', themeMode: 'light', fontPrimaryLink: '', fontSecondaryLink: '', activePage: 'home', npOpen: false, queuePanelOpen: false, lyricsPanelOpen: false }
  }, _subs = {};

  const get = p => p.split('.').reduce((o, k) => o?.[k], _state);
  const _ls = {
    'library.likedSongs': 'tt_liked', 'library.savedAlbums': 'tt_albums',
    'library.followedArtists': 'tt_artists', 'library.playlists': 'tt_playlists',
    'library.likedVideos': 'tt_liked_videos', 'queue.tracks': 'tt_queue',
    'ui.theme': 'tt_theme', 'ui.themeMode': 'tt_theme_mode'
  };

  const _notify = k => (_subs[k] || []).forEach(cb => cb(get(k)));

  const set = (p, v) => {
    const ks = p.split('.'), last = ks.pop(), t = ks.reduce((o, k) => o?.[k], _state);
    if (!t || !(last in t)) return;
    t[last] = v;
    _notify(p);
    if (ks.length) _notify(ks.join('.'));
    if (_ls[p]) try { localStorage.setItem(_ls[p], JSON.stringify(v)); } catch {}
  };

  return {
    get, set,
    subscribe: (k, cb) => {
      (_subs[k] = _subs[k] || []).push(cb);
      return () => _subs[k] = _subs[k].filter(c => c !== cb);
    },
    setUser: (name, pfp) => {
      set('user.name', name); localStorage.setItem('tt_username', name);
      if (pfp !== undefined) { set('user.pfp', pfp); localStorage.setItem('tt_pfp', pfp); }
    },
    setTheme: theme => {
      set('ui.theme', theme);
    },
    init: () => {
      const h = new Date().getHours();
      set('user.greeting', h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
      Object.entries(_ls).forEach(([p, k]) => {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        try {
          const v = JSON.parse(raw);
          if (v !== null) set(p, v);
        } catch {
          set(p, raw); // Fallback for raw strings not stored as JSON
        }
      });
    }
  };
})();

export default State
