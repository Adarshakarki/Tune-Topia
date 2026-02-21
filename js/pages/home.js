/* ═══════════════════════════════════════════════════════
   pages/home.js
   Home charts loader with graceful fallback
   ═══════════════════════════════════════════════════════ */

const PageHome = (() => {

  const SECTIONS = [
    { id: 'todays-hits',  label: '🔥 Today’s Hits',     query: 'top hits' },
    { id: 'hot-100',      label: '📊 Hot Right Now',    query: 'trending music' },
    { id: 'new-releases', label: '✨ New Releases',     query: 'new music' },
  ];

  const sectionTracks = {};

  /* ---------- Greeting ---------- */
  function setGreeting() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    const el = document.getElementById('greeting-time');
    if (el) {
      // Optional: add a name after greeting
      const name = 'User'; 
      el.textContent = ` ${g}, ${name}`; // note space before g
    }
  }

  /* ---------- Skeleton ---------- */
  function skeletonSection(section) {
    return `
      <div class="section-header" style="margin-top:28px">
        <span class="section-title">${section.label}</span>
      </div>
      <div class="results-grid" id="grid-${section.id}">
        ${Array(6).fill('<div class="result-card skeleton"></div>').join('')}
      </div>
    `;
  }

  /* ---------- Render cards ---------- */
  function renderSection(section, tracks) {
    const grid = document.getElementById(`grid-${section.id}`);
    if (!grid) return;

    if (!tracks.length) {
      grid.innerHTML = `
        <div class="msg" style="grid-column:1/-1;padding:20px">
          No results
        </div>`;
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion)').matches;

    grid.innerHTML = tracks.map((t, i) => `
      <div class="result-card"
           data-section="${section.id}"
           data-i="${i}"
           style="animation-delay:${reduceMotion ? 0 : i * 22}ms">
        <img class="rc-thumb" src="${UI.esc(t.thumb)}" loading="lazy">
        <div class="rc-info">
          <div class="rc-title">${UI.esc(t.title)}</div>
          <div class="rc-ch">${UI.esc(t.ch)}</div>
          <div class="rc-dur">${UI.fmt(t.dur)}</div>
        </div>
      </div>
    `).join('');

    // image fallback
    grid.querySelectorAll('.rc-thumb').forEach(img => {
      img.onerror = () => img.style.opacity = '.15';
    });

    // click handlers
    grid.querySelectorAll('.result-card').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.section;
        const i   = +el.dataset.i;

        State.tracks     = sectionTracks[sid];
        State.currentIdx = -1;
        UI.renderQueue();

        App.playIdx(i);
        highlightActive(sid, i);
      });
    });
  }

  /* ---------- Active highlight ---------- */
  function highlightActive(sectionId, idx) {
    document.querySelectorAll('.result-card.active')
      .forEach(el => el.classList.remove('active'));

    const grid  = document.getElementById(`grid-${sectionId}`);
    const cards = grid?.querySelectorAll('.result-card');
    cards && cards[idx]?.classList.add('active');
  }

  /* ---------- API + fallback ---------- */
  async function loadSection(section) {
    try {
      const raw    = await API.search(section.query);
      const tracks = API.mapResults(raw);

      if (!tracks.length) throw new Error('empty');

      sectionTracks[section.id] = tracks;
      renderSection(section, tracks);

    } catch {
      // fallback mock data (prevents empty home)
      const fallback = API.mockTracks(section.query);
      sectionTracks[section.id] = fallback;
      renderSection(section, fallback);
    }
  }

  /* ---------- Init ---------- */
  function init() {
    setGreeting();

    const container = document.getElementById('home-sections');
    const sub       = document.getElementById('home-sub');
    if (!container) return;

    container.innerHTML = SECTIONS.map(skeletonSection).join('');
    if (sub) sub.textContent = 'Loading charts…';

    (async () => {
      let loaded = 0;
      for (const section of SECTIONS) {
        await loadSection(section);
        loaded++;
        if (sub) sub.textContent = `Loading charts… ${loaded}/${SECTIONS.length}`;
      }
      if (sub) sub.textContent = 'Charts loaded — click any song to play';
    })();

    // restore hero if playing
    const cur = State.tracks?.[State.currentIdx];
    if (cur) UI.updateHomeHero(cur);
  }

  return { init };
})();

/* ---------- Safe init after DOM ready ---------- */
document.addEventListener('DOMContentLoaded', () => {
  PageHome.init();
});
