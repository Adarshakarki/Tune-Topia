/* ═══════════════════════════════════════
   pages/library.js
   Renders State.library (saved to sessionStorage).
   Clicking a card queues + plays that track.
   ═══════════════════════════════════════ */

const PageLibrary = (() => {

  function render() {
    const container = document.getElementById('library-content');
    if (!container) return;

    const lib = State.library || [];

    if (!lib.length) {
      container.innerHTML = `
        <div class="library-empty">
          <div class="library-empty-icon">🎵</div>
          <div class="library-empty-title">Your library is empty</div>
          <div class="library-empty-sub">
            Songs you play will appear here.
          </div>
          <button class="empty-search-btn" id="go-search">Start searching</button>
        </div>`;
      document.getElementById('go-search')?.addEventListener('click', () => Router.go('search'));
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">
          Recently Played
          <span style="font-size:13px;font-weight:500;color:var(--label-3);margin-left:8px">
            ${lib.length} track${lib.length !== 1 ? 's' : ''}
          </span>
        </span>
        <button class="lib-clear-btn" id="lib-clear">Clear</button>
      </div>
      <div class="library-grid">
        ${lib.map((t, i) => `
          <div class="lib-card" data-id="${UI.esc(t.id)}" style="animation-delay:${i * 20}ms">
            <div class="lib-thumb-wrap">
              <img class="lib-thumb" src="${UI.esc(t.thumb)}" loading="lazy"
                   onerror="this.style.opacity='.15'"/>
              <div class="lib-play-overlay">
                <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            <div class="lib-info">
              <div class="lib-title">${UI.esc(t.title)}</div>
              <div class="lib-ch">${UI.esc(t.ch)}</div>
              <div class="lib-plays">${t.plays} play${t.plays !== 1 ? 's' : ''}</div>
            </div>
          </div>
        `).join('')}
      </div>`;

    // Click card to play
    container.querySelectorAll('.lib-card').forEach(el => {
      el.addEventListener('click', () => {
        const id    = el.dataset.id;
        const track = lib.find(t => t.id === id);
        if (!track) return;

        // If already in current queue, just seek to it
        const qi = State.tracks.findIndex(t => t.id === id);
        if (qi !== -1) {
          App.playIdx(qi);
        } else {
          // Prepend to queue and play
          State.tracks = [track, ...State.tracks];
          App.playIdx(0);
        }
      });
    });

    // Clear library
    document.getElementById('lib-clear')?.addEventListener('click', () => {
      if (!confirm('Clear your recently played history?')) return;
      State.library = [];
      render();
    });
  }

  function init() { render(); }

  return { init };
})();