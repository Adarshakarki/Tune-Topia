// ── player.js — YouTube IFrame API wrapper ──
// Playback uses the hidden YT iframe — zero CORS issues.

const Player = (() => {

  let _player  = null;
  let _ready   = false;
  let _onState = null;   // external state-change callback

  // YT states for reference
  const S = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };

  // ── called by YouTube script ──────────────────────────────────────
  function _init() {
    _ready  = true;
    _player = new YT.Player('yt-player', {
      height:     '1',
      width:      '1',
      playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0 },
      events: {
        onStateChange: e => _onState?.(e.data),
        onError:       e => console.warn('[Player] error', e.data),
      },
    });
  }

  // expose to global scope — required by YT script
  window.onYouTubeIframeAPIReady = _init;

  // ── internal helpers ──────────────────────────────────────────────
  function _whenReady(fn) {
    if (_ready && _player) { fn(); return; }
    const iv = setInterval(() => {
      if (_ready && _player) { fn(); clearInterval(iv); }
    }, 150);
  }

  // ── public API ────────────────────────────────────────────────────
  return {

    onStateChange(fn) { _onState = fn; },

    load(videoId) {
      _whenReady(() => {
        _player.loadVideoById(videoId);
        _player.setVolume(Player.getVolume());
      });
    },

    play()  { _player?.playVideo();  },
    pause() { _player?.pauseVideo(); },

    togglePlay() {
      if (!_player) return;
      _player.getPlayerState() === YT.PlayerState.PLAYING
        ? _player.pauseVideo()
        : _player.playVideo();
    },

    isPlaying() {
      return _player?.getPlayerState() === YT.PlayerState.PLAYING;
    },

    getCurrentTime() { return _player?.getCurrentTime() ?? 0; },
    getDuration()    { return _player?.getDuration()    ?? 0; },

    seekTo(pct) {
      const dur = Player.getDuration();
      if (dur) _player?.seekTo(dur * pct, true);
    },

    setVolume(v) {
      _player?.setVolume(v);
      localStorage.setItem('tt_volume', v);
    },

    getVolume() {
      return parseInt(localStorage.getItem('tt_volume') ?? '80');
    },

    STATES: S,
  };

})();

window.Player = Player;
