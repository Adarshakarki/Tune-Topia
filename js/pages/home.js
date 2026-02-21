/* ═══════════════════════════════════════════════════════
   pages/home.js
   Loads multiple chart sections in parallel.
   Each section is independent — one failing won't
   block the others.
   ═══════════════════════════════════════════════════════ */

const PageHome = (() => {

  // Chart sections to load. Each gets its own row.
  const SECTIONS = [
    { id: 'todays-hits',  label: '🔥 Today\'s Hits',       query: 'today\'s hits playlist 2025' },
    { id: 'hot-100',      label: '📊 Billboard Hot 100',   query: 'billboard hot 100 this week' },
    { id: 'global-top',   label: '🌍 Global Top Songs',    query: 'global top songs chart 2025' },
    { id: 'new-releases', label: '✨ New Releases',         query: 'new music releases 2025' },
    { id: 'viral',        label: '📱 Viral Right Now',     query: 'viral songs tiktok 2025' },
  ];

  // All tracks across all sections, keyed by section id
  const sectionTracks = {};

  function setGreeting() {
    const h  = new Date().getHours();
    const g  = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    const el = document.getElementById('greeting-time');
    if (el) el.textContent = ` ${g}`;
  }

  // Build skeleton placeholder for a section
  function skeletonSection(section) {
    return `
      <div class="section-header" style="margin-top:28px">
        <span class="section-title">${section.label}</span>
      </div>
      <div class="results-grid" id="grid-${section.id}">
        ${Array(6).fill('<div class="result-card skeleton"></div>').join('')}
      </div>`;
  }

  // Render a loaded section's cards
  function renderSection(section, tracks) {
    const grid = document.getElementById(`grid-${section.id}`);
    if (!grid) return;

    if (!tracks.length) {
      grid.innerHTML = '<div class="msg" style="grid-column:1/-1;padding:20px">No results</div>';
      return;
    }

    grid.innerHTML = tracks.map((t, i) => `
      <div class="result-card" data-section="${section.id}" data-i="${i}"
           style="animation-delay:${i * 22}ms">
        <img class="rc-thumb" src="${UI.esc(t.thumb)}" loading="lazy"
             onerror="this.style.opacity='.15'"/>
        <div class="rc-info">
          <div class="rc-title">${UI.esc(t.title)}</div>
          <div class="rc-ch">${UI.esc(t.ch)}</div>
          <div class="rc-dur">${UI.fmt(t.dur)}</div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.result-card').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.section;
        const i   = +el.dataset.i;

        // Set this section's tracks as the active queue
        State.tracks     = sectionTracks[sid] || [];
        State.currentIdx = -1;
        UI.renderQueue();

        App.playIdx(i);
        highlightActive(sid, i);
      });
    });
  }

  function highlightActive(sectionId, activeIdx) {
    // Clear all highlights across all sections
    document.querySelectorAll('.result-card.active').forEach(el =>
      el.classList.remove('active'));
    // Highlight the clicked one
    const grid = document.getElementById(`grid-${sectionId}`);
    grid?.querySelectorAll('.result-card')[activeIdx]?.classList.add('active');
  }

  // Load a single section asynchronously
  async function loadSection(section) {
    try {
      const raw    = await API.search(section.query);
      const tracks = API.mapResults(raw);
      sectionTracks[section.id] = tracks;
      renderSection(section, tracks);
    } catch (err) {
      const grid = document.getElementById(`grid-${section.id}`);
      if (grid) grid.innerHTML = `
        <div class="msg" style="grid-column:1/-1;padding:20px">
          <span class="msg-icon" style="font-size:18px">⚠️</span>
          ${UI.esc(err.message)}
        </div>`;
    }
  }

  function init() {
    setGreeting();

    const container = document.getElementById('home-sections');
    const sub       = document.getElementById('home-sub');
    if (!container) return;

    // Render all skeleton sections immediately
    container.innerHTML = SECTIONS.map(skeletonSection).join('');
    if (sub) sub.textContent = 'Loading charts…';

    // Load all sections in parallel — they each update independently
    Promise.all(SECTIONS.map(loadSection)).then(() => {
      if (sub) sub.textContent = 'Charts loaded — click any song to play';
    }).catch(() => {
      if (sub) sub.textContent = 'Some sections failed to load';
    });

    // Restore now-playing hero if a track is already active
    const cur = State.tracks[State.currentIdx];
    if (cur) UI.updateHomeHero(cur);
  }

  return { init };
})();