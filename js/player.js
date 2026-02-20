// ── player.js — HTML5 <audio> player using Piped stream URLs ──

const _audio = new Audio();
_audio.preload = 'auto';
_audio.crossOrigin = 'anonymous';

let _onStateChange = null;

// State constants (match YT for easy compat with app.js)
const STATE = { PLAYING: 1, PAUSED: 2, ENDED: 0, LOADING: 3 };

// wire native audio events → state callback
_audio.addEventListener('play',  () => _onStateChange?.(STATE.PLAYING));
_audio.addEventListener('pause', () => _onStateChange?.(STATE.PAUSED));
_audio.addEventListener('ended', () => _onStateChange?.(STATE.ENDED));
_audio.addEventListener('waiting',() => _onStateChange?.(STATE.LOADING));

// set saved volume on startup
_audio.volume = (parseInt(localStorage.getItem('np_volume') ?? '80')) / 100;

// ── public API ────────────────────────────────────────────────────────────
const Player = {
  onStateChange(fn) { _onStateChange = fn; },

  /** Fetch Piped audio stream and play */
  async load(videoId) {
    _onStateChange?.(STATE.LOADING);
    try {
      const stream = await Piped.getAudioStream(videoId);
      _audio.src = stream.url;
      await _audio.play();
    } catch (err) {
      console.error('[Player] load error:', err);
      _onStateChange?.(STATE.PAUSED);
    }
  },

  play()  { _audio.play(); },
  pause() { _audio.pause(); },

  togglePlay() {
    _audio.paused ? _audio.play() : _audio.pause();
  },

  isPlaying()      { return !_audio.paused; },
  getCurrentTime() { return _audio.currentTime ?? 0; },
  getDuration()    { return _audio.duration   ?? 0; },

  seekTo(pct) {
    const dur = _audio.duration;
    if (dur && isFinite(dur)) _audio.currentTime = dur * pct;
  },

  setVolume(v) {
    _audio.volume = v / 100;
    localStorage.setItem('np_volume', v);
  },

  getVolume() {
    return parseInt(localStorage.getItem('np_volume') ?? '80');
  },
};

window.Player = Player;
