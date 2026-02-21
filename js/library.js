/* ═══════════════════════════════════════
   pages/library.js — Library page logic
   ═══════════════════════════════════════ */

const PageLibrary = (() => {

  function render() {
    const container = document.getElementById('library-content');
    if (!container) return;

    if (!State.library.length) {
      container.innerHTML = `
        <div class="library-empty">
          <div class="library-empty-icon">🎵</div>
          <div class="library-empty-title">Your library is empty</div>
          <div class="library-empty-sub">
            Songs you play will appear here. 
            <button class="empty-search-btn" id="go-search">Start searching</button>
          </div>
        </div>`;
      document.getElementById('go-search')?.addEventListener('click', () => {
        Router.go('search');
      });
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <span class="section-title">Recently Played · ${State.library.length} track${State.library.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="library-grid">
        ${State.library.map((t, i) => `
          <div class="lib-card" data-id="${UI.esc(t.id)}" style="animation-delay:${i * 22}ms">
            <img class="lib-thumb" src="${UI.esc(t.thumb)}" loading="lazy"
                 onerror="this.style.background='var(--bg2)'"/>
            <div class="lib-info">
              <div class="lib-title">${UI.esc(t.title)}</div>
              <div class="lib-ch">${UI.esc(t.ch)}</div>
              <div class="lib-plays">${t.plays} play${t.plays !== 1 ? 's' : ''}</div>
            </div>
          </div>
        `).join('')}
      </div>`;

    container.querySelectorAll('.lib-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        // Find in current queue
        const qi = State.tracks.findIndex(t => t.id === id);
        if (qi !== -1) {
          App.playIdx(qi);
        } else {
          // Add to front of queue and play
          const track = State.library.find(t => t.id === id);
          if (track) {
            const newTracks = [track, ...State.tracks];
            State.tracks = newTracks;
            App.playIdx(0);
          }
        }
      });
    });
  }

  function init() { render(); }

  return { init };
})();

PageLibrary.init();
