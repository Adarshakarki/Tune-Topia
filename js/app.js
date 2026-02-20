// ── app.js — main orchestrator, state, event wiring ──

const App = (() => {
  // ── state ────────────────────────────────────────────────────────────
  let tracks     = [];
  let currentIdx = -1;
  let progTimer  = null;

  // ── init ─────────────────────────────────────────────────────────────
  function init() {
    // restore volume
    document.getElementById('volume-slider').value = Player.getVolume();

    // connect to Piped
    Piped.pickInstance(UI.server.set.bind(UI.server));

    // wire search
    const searchInput = document.getElementById('search-input');
    const searchBtn   = document.getElementById('search-btn');
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    searchBtn.addEventListener('click', doSearch);

    // wire player controls
    document.getElementById('btn-play').addEventListener('click', () => Player.togglePlay());
    document.getElementById('btn-prev').addEventListener('click', playPrev);
    document.getElementById('btn-next').addEventListener('click', playNext);

    // wire progress bar click
    document.getElementById('progress-track').addEventListener('click', e => {
      const rect = e.currentTarget.getBoundingClientRect();
      Player.seekTo((e.clientX - rect.left) / rect.width);
    });

    // wire volume
    document.getElementById('volume-slider').addEventListener('input', e => {
      Player.setVolume(+e.target.value);
    });

    // keyboard shortcuts
    document.addEventListener('keydown', handleKey);

    // player state changes — using STATE constants from player.js
    Player.onStateChange(state => {
      const isPlaying = state === 1; // STATE.PLAYING
      const isPaused  = state === 2; // STATE.PAUSED
      const isEnded   = state === 0; // STATE.ENDED
      const isLoading = state === 3; // STATE.LOADING

      if (isPlaying) {
        UI.playerBar.setPlaying(true);
        UI.nowPlaying.setPlaying(true);
        startProgress();
      }
      if (isPaused) {
        UI.playerBar.setPlaying(false);
        UI.nowPlaying.setPlaying(false);
        stopProgress();
      }
      if (isEnded) {
        UI.playerBar.setPlaying(false);
        UI.nowPlaying.setPlaying(false);
        stopProgress();
        playNext();
      }
      if (isLoading) {
        UI.playerBar.setPlaying(false);
      }
    });

    // show idle state
    UI.nowPlaying.showIdle();
    UI.trackList.showEmpty();
  }

  // ── search ────────────────────────────────────────────────────────────
  async function doSearch() {
    const q = document.getElementById('search-input').value.trim();
    if (!q) return;

    UI.trackList.showLoading();
    document.getElementById('queue-count').textContent = '0';

    try {
      tracks = await Piped.searchTracks(q, UI.server.set.bind(UI.server));
      UI.trackList.render(tracks, currentIdx, playIdx);
      if (tracks.length) playIdx(0);
    } catch (err) {
      UI.trackList.showError(err.message);
    }
  }

  // ── playback ──────────────────────────────────────────────────────────
  function playIdx(i) {
    if (i < 0 || i >= tracks.length) return;
    currentIdx = i;
    const t = tracks[i];

    UI.trackList.render(tracks, currentIdx, playIdx);
    UI.nowPlaying.setTrack(t);
    UI.playerBar.setTrack(t);
    UI.ambient.setThumb(t.thumb);

    Player.load(t.id);
  }

  function playNext() {
    if (!tracks.length) return;
    playIdx((currentIdx + 1) % tracks.length);
  }

  function playPrev() {
    if (!tracks.length) return;
    if (Player.getCurrentTime() > 3) {
      Player.seekTo(0);
    } else {
      playIdx((currentIdx - 1 + tracks.length) % tracks.length);
    }
  }

  // ── progress ticker ───────────────────────────────────────────────────
  function startProgress() {
    stopProgress();
    progTimer = setInterval(() => {
      const cur = Player.getCurrentTime();
      const dur = Player.getDuration();
      UI.playerBar.setProgress(cur, dur);
    }, 1000);
  }

  function stopProgress() {
    clearInterval(progTimer);
    progTimer = null;
  }

  // ── keyboard shortcuts ────────────────────────────────────────────────
  function handleKey(e) {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space':      e.preventDefault(); Player.togglePlay(); break;
      case 'ArrowRight': playNext(); break;
      case 'ArrowLeft':  playPrev(); break;
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
