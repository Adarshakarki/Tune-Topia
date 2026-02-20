// ── player.js — plays direct audio (Piped) or YT embed (fallback) ──

const _audio = new Audio();
_audio.preload    = 'auto';
_audio.crossOrigin = 'anonymous';

let _onStateChange = null;
let _mode          = 'audio'; // 'audio' | 'embed'
let _embedIframe   = null;

const STATE = { PLAYING: 1, PAUSED: 2, ENDED: 0, LOADING: 3 };

// wire audio element events
_audio.addEventListener('play',    () => { if (_mode === 'audio') _onStateChange?.(STATE.PLAYING);  });
_audio.addEventListener('pause',   () => { if (_mode === 'audio') _onStateChange?.(STATE.PAUSED);   });
_audio.addEventListener('ended',   () => { if (_mode === 'audio') _onStateChange?.(STATE.ENDED);    });
_audio.addEventListener('waiting', () => { if (_mode === 'audio') _onStateChange?.(STATE.LOADING);  });

_audio.volume = (parseInt(localStorage.getItem('np_volume') ?? '80')) / 100;

// ── embed iframe helpers ──────────────────────────────────────────────────
function createEmbed(videoId) {
  destroyEmbed();
  const wrap = document.getElementById('embed-wrap');
  if (!wrap) return;
  _embedIframe = document.createElement('iframe');
  _embedIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=0`;
  _embedIframe.allow = 'autoplay';
  _embedIframe.style.cssText = 'width:1px;height:1px;opacity:0;pointer-events:none;position:absolute;';
  wrap.appendChild(_embedIframe);
  // embed auto-plays so fire playing state after short delay
  setTimeout(() => _onStateChange?.(STATE.PLAYING), 1500);
}

function destroyEmbed() {
  if (_embedIframe) { _embedIframe.remove(); _embedIframe = null; }
}

// ── public API ────────────────────────────────────────────────────────────
const Player = {
  onStateChange(fn) { _onStateChange = fn; },

  async load(videoId) {
    // stop whatever is currently playing
    _audio.pause();
    destroyEmbed();
    _onStateChange?.(STATE.LOADING);

    try {
      const stream = await Piped.getAudioStream(videoId);

      if (stream.type === 'direct') {
        _mode     = 'audio';
        _audio.src = stream.url;
        await _audio.play();
      } else {
        // embed fallback
        _mode = 'embed';
        createEmbed(videoId);
      }
    } catch (err) {
      console.error('[Player] load error:', err);
      _onStateChange?.(STATE.PAUSED);
    }
  },

  play() {
    if (_mode === 'audio') _audio.play();
  },
  pause() {
    if (_mode === 'audio') _audio.pause();
    // can't pause an embed, but we can destroy it
    if (_mode === 'embed') { destroyEmbed(); _onStateChange?.(STATE.PAUSED); }
  },
  togglePlay() {
    if (_mode === 'audio') {
      _audio.paused ? _audio.play() : _audio.pause();
    }
  },

  isPlaying()      { return _mode === 'audio' ? !_audio.paused : !!_embedIframe; },
  getCurrentTime() { return _mode === 'audio' ? (_audio.currentTime ?? 0) : 0; },
  getDuration()    { return _mode === 'audio' ? (_audio.duration   ?? 0) : 0; },

  seekTo(pct) {
    if (_mode !== 'audio') return;
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
