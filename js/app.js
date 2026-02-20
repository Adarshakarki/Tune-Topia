// ── app.js — orchestrator: state, events, wires everything together ──

const App = (() => {

  // ── state ────────────────────────────────────────────────────────
  let tracks     = [];
  let currentIdx = -1;
  let progTimer  = null;

  // ── init ─────────────────────────────────────────────────────────
  function init() {
    // restore saved volume
    document.getElementById('vol').value = Player.getVolume();

    // connect to server in background
    API.pickInstance(UI.server.set.bind(UI.server));

    // wire search
    document.getElementById('q')
      .addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    document.getElementById('go')
      .addEventListener('click', doSearch);

    // wire player controls
    document.getElementById('btn-play')
      .addEventListener('click', () => Player.togglePlay());
    document.getElementById('btn-prev')
      .addEventListener('click', playPrev);
    document.getElementById('btn-next')
      .addEventListener('click', playNext);

    // wire progress bar seek
    document.getElementById('prog-track')
      .addEventListener('click', e => {
        const rect = e.currentTarget.getBoundingClientRect();
        Player.seekTo((e.clientX - rect.left) / rect.width);
      });

    // wire volume
    document.getElementById('vol')
      .addEventListener('input', e => Player.setVolume(+e.target.value));

    // keyboard shortcuts
    document.addEventListener('keydown', handleKey);

    // player state changes
    Player.onStateChange(state => {
      const S = Player.STATES;
      if (state === S.PLAYING) {
        UI.playerBar.setPlaying(true);
        UI.nowPlaying.setPlaying(true);
        startProgress();
      }
      if (state === S.PAUSED) {
        UI.playerBar.setPlaying(false);
        UI.nowPlaying.setPlaying(false);
        stopProgress();
      }
      if (state === S.ENDED) {
        UI.playerBar.setPlaying(false);
        UI.nowPlaying.setPlaying(false);
        stopProgress();
        playNext();
      }
    });

    // initial UI state
    UI.nowPlaying.showIdle();
    UI.trackList.showEmpty();
  }

  // ── search ───────────────────────────────────────────────────────
  async function doSearch() {
    const q = document.getElementById('q').value.trim();
    if (!q) return;

    UI.trackList.showLoading();

    try {
      tracks = await API.search(q, UI.server.set.bind(UI.server));
      UI.trackList.render(tracks, currentIdx, playIdx);
      if (tracks.length) playIdx(0);
    } catch (err) {
      UI.trackList.showError(err.message);
    }
  }

  // ── playback ─────────────────────────────────────────────────────
  function playIdx(i) {
    if (i < 0 || i >= tracks.length) return;
    currentIdx = i;
    const t = tracks[i];

    UI.trackList.render(tracks, currentIdx, playIdx);
    UI.nowPlaying.setTrack(t);
    UI.playerBar.setTrack(t);

    Player.load(t.id);
  }

  function playNext() {
    if (!tracks.length) return;
    playIdx((currentIdx + 1) % tracks.length);
  }

  function playPrev() {
    if (!tracks.length) return;
    // restart if >3s in, else go to previous
    if (Player.getCurrentTime() > 3) {
      Player.seekTo(0);
    } else {
      playIdx((currentIdx - 1 + tracks.length) % tracks.length);
    }
  }

  // ── progress ticker ──────────────────────────────────────────────
  function startProgress() {
    stopProgress();
    progTimer = setInterval(() => {
      UI.playerBar.setProgress(
        Player.getCurrentTime(),
        Player.getDuration()
      );
    }, 1000);
  }

  function stopProgress() {
    clearInterval(progTimer);
    progTimer = null;
  }

  // ── keyboard shortcuts ───────────────────────────────────────────
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
