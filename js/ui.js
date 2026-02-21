/* ═══════════════════════════════════════════════════
   ui.js — DOM rendering & view management
   ═══════════════════════════════════════════════════ */

// ── Shared state (defined before this file loads) ──
const State = {
  tracks:     [],
  currentIdx: -1,
  isPlaying:  false,
  volume:     80,
  library:    [],
  activeView: 'home',
};

const UI = (() => {
  // ── Element refs ──
  const $ = id => document.getElementById(id);

  const els = {
    list:         $('list'),
    searchRes:    $('search-results'),
    libraryGrid:  $('library-grid'),
    // Home
    homeArtImg:   $('home-art-img'),
    homeArtPh:    $('home-art-ph'),
    homeArtRing:  $('home-art-ring'),
    homeTitle:    $('home-title'),
    homeCh:       $('home-ch'),
    // Bar
    barThumb:     $('bar-thumb'),
    barTitle:     $('bar-title'),
    barCh:        $('bar-ch'),
    // Progress
    progFill:     $('prog-fill'),
    progBar:      $('prog-bar'),
    tCur:         $('t-cur'),
    tEnd:         $('t-end'),
    // Controls
    playIcon:     $('play-icon'),
    volFill:      $('vol-fill'),
    volSlider:    $('vol'),
    // Greeting
    greetingTime: $('greeting-time'),
  };

  // ── Greeting ──
  function setGreeting() {
    const h = new Date().getHours();
    const g = h < 12 ? ' Morning' : h < 17 ? ' Afternoon' : ' Evening';
    if (els.greetingTime) els.greetingTime.textContent = g;
  }

  // ── Nav switching ──
  function switchView(name) {
    State.activeView = name;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const v = document.getElementById(`view-${name}`);
    if (v) v.classList.add('active');
    const b = document.querySelector(`[data-view="${name}"]`);
    if (b) b.classList.add('active');
    // Focus search input when switching to search
    if (name === 'search') {
      setTimeout(() => document.getElementById('q')?.focus(), 100);
    }
  }

  // ── Queue list (sidebar) ──
  function renderQueue() {
    if (!State.tracks.length) {
      els.list.innerHTML = '<div class="msg"><span class="msg-icon">🎵</span>Search to fill your queue</div>';
      return;
    }
    els.list.innerHTML = State.tracks.map((t, i) => `
      <div class="track-item ${i === State.currentIdx ? 'active' : ''}"
           data-i="${i}" style="animation-delay:${i * 20}ms">
        <img class="ti-thumb" src="${esc(t.thumb)}" loading="lazy" onerror="this.style.display='none'"/>
        <div class="ti-info">
          <div class="ti-name">${esc(t.title)}</div>
          <div class="ti-ch">${esc(t.ch)}</div>
        </div>
        <span class="ti-dur">${fmt(t.dur)}</span>
        <div class="bars"><span></span><span></span><span></span></div>
      </div>
    `).join('');

    els.list.querySelectorAll('.track-item').forEach(el => {
      el.addEventListener('click', () => App.playIdx(+el.dataset.i));
    });
  }

  // ── Search results grid (main area) ──
  function renderSearchResults(tracks) {
    if (!tracks.length) {
      els.searchRes.innerHTML = '<div class="msg"><span class="msg-icon">🔍</span>No results found</div>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'results-grid';
    grid.innerHTML = tracks.map((t, i) => `
      <div class="result-card ${i === State.currentIdx ? 'active' : ''}"
           data-i="${i}" style="animation-delay:${i * 22}ms">
        <img class="rc-thumb" src="${esc(t.thumb)}" loading="lazy"
             onerror="this.style.background='var(--bg2)'"/>
        <div class="rc-info">
          <div class="rc-title">${esc(t.title)}</div>
          <div class="rc-ch">${esc(t.ch)}</div>
          <div class="rc-dur">${fmt(t.dur)}</div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.result-card').forEach(el => {
      el.addEventListener('click', () => App.playIdx(+el.dataset.i));
    });
    els.searchRes.innerHTML = '';
    els.searchRes.appendChild(grid);
  }

  // ── Library grid ──
  function renderLibrary() {
    if (!State.library.length) {
      els.libraryGrid.innerHTML = '<div class="msg"><span class="msg-icon">📚</span>Play something to build your library</div>';
      return;
    }
    els.libraryGrid.innerHTML = State.library.map((t, i) => `
      <div class="lib-card" data-id="${esc(t.id)}" style="animation-delay:${i * 20}ms">
        <img class="lib-thumb" src="${esc(t.thumb)}" loading="lazy"/>
        <div class="lib-info">
          <div class="lib-title">${esc(t.title)}</div>
          <div class="lib-ch">${esc(t.ch)}</div>
          <div class="lib-plays">${t.plays} play${t.plays !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `).join('');

    // Clicking library item — search for it
    els.libraryGrid.querySelectorAll('.lib-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const track = State.library.find(t => t.id === id);
        if (!track) return;
        // Find in current queue or queue a fresh single
        const qi = State.tracks.findIndex(t => t.id === id);
        if (qi !== -1) { App.playIdx(qi); switchView('home'); }
      });
    });
  }

  // ── Now playing metadata ──
  function updateNowPlaying(track) {
    if (!track) return;
    const thumb = track.thumb;

    // Home view
    if (thumb) {
      els.homeArtImg.src = thumb;
      els.homeArtImg.style.display = 'block';
      els.homeArtPh.style.display = 'none';
    } else {
      els.homeArtImg.style.display = 'none';
      els.homeArtPh.style.display = 'flex';
    }
    els.homeTitle.textContent = track.title;
    els.homeCh.textContent    = track.ch;

    // Bar
    if (thumb) els.barThumb.src = thumb;
    els.barTitle.textContent = track.title;
    els.barCh.textContent    = track.ch;
  }

  // ── Progress bar ──
  function updateProgress(cur, dur) {
    const pct = (cur / dur) * 100;
    els.progFill.style.width = `${pct}%`;
    els.tCur.textContent = fmt(cur);
    els.tEnd.textContent = fmt(dur);
  }

  // ── Play button icon ──
  function updatePlayBtn() {
    const path = State.isPlaying
      ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'
      : 'M8 5v14l11-7z';
    els.playIcon.setAttribute('d', path);
    // Adjust left-margin for play triangle centering
    els.playIcon.parentElement.querySelector('svg').style.marginLeft =
      State.isPlaying ? '0' : '2px';
  }

  function startSpinning() { els.homeArtRing.classList.add('spinning'); }
  function stopSpinning()  { els.homeArtRing.classList.remove('spinning'); }

  // ── Volume visual ──
  function updateVolFill(v) {
    els.volFill.style.width = `${v}%`;
  }

  // ── Loading state ──
  function showQueueLoading() {
    els.list.innerHTML = '<div class="spin"></div>';
  }
  function showSearchLoading() {
    els.searchRes.innerHTML = '<div class="spin"></div>';
  }
  function showSearchError(msg) {
    els.searchRes.innerHTML = `<div class="msg"><span class="msg-icon">⚠️</span>${esc(msg)}</div>`;
  }

  // ── Helpers ──
  function fmt(s) {
    s = Math.floor(s || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Init
  setGreeting();

  return {
    switchView,
    renderQueue,
    renderSearchResults,
    renderLibrary,
    updateNowPlaying,
    updateProgress,
    updatePlayBtn,
    startSpinning,
    stopSpinning,
    updateVolFill,
    showQueueLoading,
    showSearchLoading,
    showSearchError,
    fmt,
  };
})();
