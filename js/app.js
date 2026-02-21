/* ═══════════════════════════════════════════════════
   app.js — Main orchestrator. Wires API + Player + UI
   ═══════════════════════════════════════════════════ */

const App = (() => {

  // ── Library helpers ──
  function addToLibrary(track) {
    const existing = State.library.find(t => t.id === track.id);
    if (existing) { existing.plays++; }
    else { State.library.unshift({ ...track, plays: 1 }); }
    if (State.library.length > 50) State.library.length = 50;
    UI.renderLibrary();
  }

  // ── Playback ──
  function playIdx(i) {
    if (i < 0 || i >= State.tracks.length) return;
    State.currentIdx = i;
    const track = State.tracks[i];

    UI.updateNowPlaying(track);
    UI.renderQueue();
    Player.load(track.id);
    addToLibrary(track);

    // Switch to home to show now playing
    UI.switchView('home');

    // Also highlight active in search results if visible
    document.querySelectorAll('.result-card').forEach((el, idx) => {
      el.classList.toggle('active', idx === i);
    });
  }

  function nextTrack() {
    if (!State.tracks.length) return;
    playIdx((State.currentIdx + 1) % State.tracks.length);
  }

  function prevTrack() {
    if (!State.tracks.length) return;
    playIdx((State.currentIdx - 1 + State.tracks.length) % State.tracks.length);
  }

  // ── Search ──
  async function doSearch() {
    const q = document.getElementById('q').value.trim();
    if (!q) return;

    UI.showQueueLoading();
    UI.showSearchLoading();

    try {
      const data = await API.search(q);
      State.tracks = API.mapResults(data);
      State.currentIdx = -1;

      UI.renderQueue();
      UI.renderSearchResults(State.tracks);

      if (State.tracks.length) playIdx(0);
    } catch (err) {
      UI.showSearchError(err.message + '<br>Try again in a moment.');
      UI.renderQueue(); // restore empty state
    }
  }

  // ── Event bindings ──
  function bindEvents() {
    // Nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => UI.switchView(btn.dataset.view));
    });

    // Search
    document.getElementById('q').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
    document.getElementById('go').addEventListener('click', doSearch);

    // Hint cards — click to search
    document.querySelectorAll('.hint-card').forEach(card => {
      card.addEventListener('click', () => {
        const genre = card.textContent.replace(/^.+?\s/, '').trim(); // strip emoji
        document.getElementById('q').value = genre;
        doSearch();
      });
    });

    // Player controls
    document.getElementById('btn-play').addEventListener('click', Player.togglePlay);
    document.getElementById('btn-next').addEventListener('click', nextTrack);
    document.getElementById('btn-prev').addEventListener('click', prevTrack);

    // Progress bar seek
    document.getElementById('prog-bar').addEventListener('click', e => {
      const bar  = e.currentTarget;
      const rect = bar.getBoundingClientRect();
      const pct  = (e.clientX - rect.left) / bar.offsetWidth;
      Player.seekTo(Math.max(0, Math.min(1, pct)));
    });

    // Volume
    const vol = document.getElementById('vol');
    vol.value = State.volume;
    UI.updateVolFill(State.volume);
    vol.addEventListener('input', () => {
      Player.setVolume(+vol.value);
      UI.updateVolFill(+vol.value);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); Player.togglePlay(); }
      if (e.code === 'ArrowRight') nextTrack();
      if (e.code === 'ArrowLeft')  prevTrack();
    });
  }

  // ── Init ──
  function init() {
    bindEvents();
    UI.switchView('home');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { playIdx, nextTrack, prevTrack };
})();
