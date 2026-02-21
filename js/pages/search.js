var PageSearch = (() => {
  function init() {
    const input      = document.getElementById('q');
    const goBtn      = document.getElementById('go');
    const genreShelf = document.getElementById('genre-shelf');
    const resultsDiv = document.getElementById('search-results');
    const grid       = document.getElementById('results-grid');
    const label      = document.getElementById('results-label');

    if (!input) { console.warn('PageSearch: #q not found'); return; }

    const doSearch = async () => {
      const q = input.value.trim();
      if (!q) return;

      // Show results container, hide genre shelf — never reverse this
      if (genreShelf) genreShelf.style.display = 'none';
      if (resultsDiv) resultsDiv.style.display  = 'block';
      if (label)      label.textContent         = `Results for "${q}"`;
      if (grid)       grid.innerHTML            = '<div class="spin" style="margin:40px auto"></div>';

      try {
        const raw    = await API.search(q);
        const tracks = API.mapResults(raw);

        State.tracks     = tracks;
        State.currentIdx = -1;
        UI.renderQueue();

        if (!tracks.length) {
          grid.innerHTML = '<div class="msg"><span class="msg-icon">🔍</span>No results found</div>';
          return;
        }

        grid.innerHTML = tracks.map((t, i) => `
          <div class="result-card" data-i="${i}" style="animation-delay:${i * 25}ms">
            <img class="rc-thumb" src="${UI.esc(t.thumb)}"
                 loading="lazy"
                 onerror="this.style.opacity='.15'"/>
            <div class="rc-info">
              <div class="rc-title">${UI.esc(t.title)}</div>
              <div class="rc-ch">${UI.esc(t.ch)}</div>
              <div class="rc-dur">${UI.fmt(t.dur)}</div>
            </div>
          </div>
        `).join('');

        // Click to play
        grid.querySelectorAll('.result-card').forEach(el => {
          el.addEventListener('click', () => {
            const i = +el.dataset.i;
            App.playIdx(i);
            grid.querySelectorAll('.result-card').forEach((c, ci) =>
              c.classList.toggle('active', ci === i));
          });
        });

        // Auto-play first
        App.playIdx(0);
        grid.querySelector('.result-card')?.classList.add('active');

      } catch (err) {
        // Show error INSIDE the results area — don't hide it
        if (grid) grid.innerHTML = `
          <div class="msg">
            <span class="msg-icon">⚠️</span>
            ${UI.esc(err.message)}<br>
            <small style="font-size:11px;opacity:.7">Check the server status pill above</small>
          </div>`;
        console.error('Search error:', err);
      }
    };

    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    if (goBtn) goBtn.addEventListener('click', doSearch);

    document.querySelectorAll('.hint-card').forEach(card => {
      card.addEventListener('click', () => {
        input.value = card.dataset.q || card.textContent.trim();
        doSearch();
      });
    });

    setTimeout(() => input.focus(), 80);
  }

  return { init };
})();