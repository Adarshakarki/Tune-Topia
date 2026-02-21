/* ══════════════════════════════════════════
   player.js — YouTube IFrame player wrapper
   ══════════════════════════════════════════ */

const Player = (() => {
  let ytPlayer = null;
  let ytReady  = false;
  let progTimer = null;

  // ── Called by YouTube IFrame API ──
  window.onYouTubeIframeAPIReady = () => {
    ytReady = true;
    ytPlayer = new YT.Player('yt-player', {
      height: '1', width: '1',
      playerVars: { autoplay: 0, controls: 0, playsinline: 1 },
      events: {
        onStateChange(e) {
          const S = YT.PlayerState;
          if (e.data === S.PLAYING) {
            State.isPlaying = true;
            UI.updatePlayBtn();
            UI.startSpinning();
            _startProg();
          }
          if (e.data === S.PAUSED) {
            State.isPlaying = false;
            UI.updatePlayBtn();
            UI.stopSpinning();
            _stopProg();
          }
          if (e.data === S.ENDED) {
            State.isPlaying = false;
            UI.updatePlayBtn();
            UI.stopSpinning();
            _stopProg();
            App.nextTrack();
          }
        },
      },
    });
  };

  function load(videoId) {
    const go = () => {
      ytPlayer.loadVideoById(videoId);
      ytPlayer.setVolume(State.volume);
    };
    if (ytReady && ytPlayer) go();
    else {
      const iv = setInterval(() => {
        if (ytReady && ytPlayer) { go(); clearInterval(iv); }
      }, 150);
    }
  }

  function togglePlay() {
    if (!ytPlayer) return;
    State.isPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
  }

  function setVolume(v) {
    State.volume = v;
    if (ytPlayer) ytPlayer.setVolume(v);
  }

  function seekTo(pct) {
    if (!ytPlayer) return;
    const dur = ytPlayer.getDuration();
    if (dur) ytPlayer.seekTo(dur * pct, true);
  }

  function _startProg() {
    _stopProg();
    progTimer = setInterval(() => {
      if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
      const cur = ytPlayer.getCurrentTime();
      const dur = ytPlayer.getDuration();
      if (!dur) return;
      UI.updateProgress(cur, dur);
    }, 1000);
  }

  function _stopProg() { clearInterval(progTimer); }

  return { load, togglePlay, setVolume, seekTo };
})();
