/* ═══════════════════════════════════
   pages/home.js — Home page logic
   ═══════════════════════════════════ */

const PageHome = (() => {
  // Queries to cycle through for "trending" feel
  const TRENDING_QUERIES = [
    'top hits 2025',
    'trending songs 2025',
    'popular music 2025',
    'viral songs 2025',
    'best songs right now',
  ];

  function setGreeting() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    const el = document.getElementById('greeting-time');
    if (el) el.textContent = ` ${g}`;
  }

  async function loadTrending() {
    const grid = document.getElementById('trending-grid');
    const sub  = document.getElementById('home-sub');
    if (!grid) return;

    // Pick a random query so it feels fresh each visit
    const q = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];

    try {
      const data   = await API.search(q);
      const tracks = API.mapResults(data);

      // Store as the current queue
      State.tracks = tracks;
      UI.renderQueue();

      if (sub) sub.textContent = 'Trending music — click to play';

      grid.innerHTML = tracks.map((t, i) => `
        <div class="result-card" data-i="${i}" style="animation-delay:${i * 30}ms">
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
          App.playIdx(+el.dataset.i);
          highlightActive(+el.dataset.i);
        });
      });

      // If something is already playing from a previous session, restore hero
      const cur = State.tracks[State.currentIdx];
      if (cur) UI.updateHomeHero(cur);

    } catch (err) {
      grid.innerHTML = `<div class="msg" style="grid-column:1/-1">
        <span class="msg-icon">⚠️</span>${err.message}
      </div>`;
      if (sub) sub.textContent = 'Could not load trending — try searching instead';
    }
  }

  function highlightActive(i) {
    document.querySelectorAll('#trending-grid .result-card').forEach((el, idx) => {
      el.classList.toggle('active', idx === i);
    });
  }

  function init() {
    setGreeting();
    loadTrending();

    // If a track is already playing, update the hero immediately
    const cur = State.tracks[State.currentIdx];
    if (cur) UI.updateHomeHero(cur);
  }

  return { init };
})();

// Auto-init when injected into the DOM
PageHome.init();
