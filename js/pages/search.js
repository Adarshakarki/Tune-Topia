/* ═════════════════════════════════════
   pages/search.js — Search page logic
   ═════════════════════════════════════ */

const PageSearch = (() => {

  function bindEvents() {
    const input      = document.getElementById('q');
    const goBtn      = document.getElementById('go');
    const genreShelf = document.getElementById('genre-shelf');
    const resultsDiv = document.getElementById('search-results');

    if (!input) return;

    // Search on Enter or button click
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    goBtn?.addEventListener('click', doSearch);

    // Genre chip click
    document.querySelectorAll('.hint-card').forEach(card => {
      card.addEventListener('click', () => {
        input.value = card.dataset.q || card.textContent.replace(/^.+?\s/, '').trim();
        doSearch();
      });
    });

    async function doSearch() {
      const q = input.value.trim();
      if (!q) return;

      // Show loading, hide genres
      if (genreShelf)  genreShelf.style.display = 'none';
      if (resultsDiv)  resultsDiv.style.display  = 'block';

      const grid  = document.getElementById('results-grid');
      const label = document.getElementById('results-label');
      if (grid) grid.innerHTML = '<div class="spin" style="margin:40px auto"></div>';

      try {
        const data   = await API.search(q);
        const tracks = API.mapResults(data);

        // Replace queue with new results
        State.tracks     = tracks;
        State.currentIdx = -1;
        UI.renderQueue();

        if (label) label.textContent = `Results for "${q}"`;

        if (!grid) return;

        if (!tracks.length) {
          grid.innerHTML = `<div class="msg" style="grid-column:1/-1">
            <span class="msg-icon">🔍</span>No results found</div>`;
          return;
        }

        grid.innerHTML = tracks.map((t, i) => `
          <div class="result-card" data-i="${i}" style="animation-delay:${i * 25}ms">
            <img class="rc-thumb" src="${UI.esc(t.thumb)}" loading="lazy"
                 onerror="this.style.background='var(--bg2)'"/>
            <div class="rc-info">
              <div class="rc-title">${UI.esc(t.title)}</div>
              <div class="rc-ch">${UI.esc(t.ch)}</div>
              <div class="rc-dur">${UI.fmt(t.dur)}</div>
            </div>
          </div>
        `).join('');

        grid.querySelectorAll('.result-card').forEach(el => {
          el.addEventListener('click', () => {
            const i = +el.dataset.i;
            App.playIdx(i);
            grid.querySelectorAll('.result-card').forEach((c, ci) =>
              c.classList.toggle('active', ci === i));
          });
        });

        // Auto-play first result
        App.playIdx(0);
        grid.querySelector('.result-card')?.classList.add('active');

      } catch (err) {
        if (grid) grid.innerHTML = `<div class="msg" style="grid-column:1/-1">
          <span class="msg-icon">⚠️</span>${UI.esc(err.message)}</div>`;
        // Show genres again on error
        if (genreShelf) genreShelf.style.display = 'block';
      }
    }
  }

  function init() {
    bindEvents();
    // Focus search input
    setTimeout(() => document.getElementById('q')?.focus(), 100);
  }

  return { init };
})();

PageSearch.init();
