const State = (() => {
  const _state = {
    user: {
      name: localStorage.getItem('tt_username') || 'Friend',
      pfp: localStorage.getItem('tt_pfp') || '',
      greeting: '',
    },
    player: {
      currentTrack: null,
      isPlaying: false,
      isShuffle: false,
      isRepeat: false,
      volume: parseFloat(localStorage.getItem('tt_vol') || '0.8'),
      queuePosition: -1,
    },
    queue: {
      tracks: [],
      played: [],
      upcoming: [],
    },
    search: {
      query: '',
      activeTab: 'music',
      isLoading: false,
      topResult: null,
      results: [],
      mood: null,
    },
    library: {
      likedSongs: [],
      savedAlbums: [],
      followedArtists: [],
      playlists: [],
      likedVideos: [],
    },
    ui: {
      theme: localStorage.getItem('tt_theme') || 'light',
      activePage: 'home',
      npOpen: false,
      queuePanelOpen: false,
      lyricsPanelOpen: false,
    },
  }

  const _subscribers = {}

  // dot-path subscriber, returns unsubscribe fn
  function subscribe(key, callback) {
    if (!_subscribers[key]) _subscribers[key] = []
    _subscribers[key].push(callback)
    return () => {
      _subscribers[key] = _subscribers[key].filter((cb) => cb !== callback)
    }
  }

  function _notify(key) {
    ;(_subscribers[key] || []).forEach((cb) => cb(get(key)))
  }

  // dot-path getter e.g. get('player.isPlaying')
  function get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], _state)
  }

  const _lsMap = {
    'library.likedSongs': 'tt_liked',
    'library.savedAlbums': 'tt_albums',
    'library.followedArtists': 'tt_artists',
    'library.playlists': 'tt_playlists',
    'library.likedVideos': 'tt_liked_videos',
    'queue.tracks': 'tt_queue',
  }

  function _persist(path, value) {
    const key = _lsMap[path]
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }

  // dot-path setter e.g. set('player.isPlaying', true)
  function set(path, value) {
    const keys = path.split('.')
    const last = keys.pop()
    const target = keys.reduce((obj, key) => obj?.[key], _state)
    if (!target || !(last in target)) return
    target[last] = value
    _notify(path)
    if (keys.length) _notify(keys.join('.'))
    _persist(path, value)
  }

  function setUser(name, pfp) {
    set('user.name', name)
    localStorage.setItem('tt_username', name)
    if (pfp !== undefined) {
      set('user.pfp', pfp)
      localStorage.setItem('tt_pfp', pfp)
    }
  }

  function setTheme(theme) {
    set('ui.theme', theme)
    localStorage.setItem('tt_theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  // Hydrate state from localStorage on startup
  function init() {
    document.documentElement.setAttribute('data-theme', _state.ui.theme)

    const h = new Date().getHours()
    set(
      'user.greeting',
      h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
    )

    try {
      set(
        'library.likedSongs',
        JSON.parse(localStorage.getItem('tt_liked') || '[]')
      )
      set(
        'library.savedAlbums',
        JSON.parse(localStorage.getItem('tt_albums') || '[]')
      )
      set(
        'library.followedArtists',
        JSON.parse(localStorage.getItem('tt_artists') || '[]')
      )
      set(
        'library.playlists',
        JSON.parse(localStorage.getItem('tt_playlists') || '[]')
      )
      set(
        'library.likedVideos',
        JSON.parse(localStorage.getItem('tt_liked_videos') || '[]')
      )
    } catch {}

    try {
      set('queue.tracks', JSON.parse(localStorage.getItem('tt_queue') || '[]'))
    } catch {}
  }

  return { get, set, subscribe, setUser, setTheme, init }
})()

export default State
