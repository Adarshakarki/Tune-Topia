// app //

const App = (() => {

  let currentId = null;

  // home //

  const HOME_GENRES = [
    { label: '🔥 Trending',   q: 'trending music 2024',           mode: 'tidal' },
    { label: 'New Releases',  q: 'new music releases 2025',       mode: 'tidal' },
    { label: 'Lo-Fi',         q: 'lo-fi hip hop chill beats',     mode: 'tidal' },
    { label: 'Pop',           q: 'pop hits 2025',                 mode: 'tidal' },
    { label: 'Hip-Hop',       q: 'hip hop rap 2025',              mode: 'tidal' },
    { label: 'R&B',           q: 'rnb soul 2025',                 mode: 'tidal' },
    { label: 'Indie',         q: 'indie alternative 2025',        mode: 'tidal' },
    { label: 'EDM',           q: 'electronic dance music 2025',   mode: 'tidal' },
    { label: 'Jazz',          q: 'jazz music chill',              mode: 'tidal' },
    { label: 'K-Pop',         q: 'kpop 2025',                     mode: 'tidal' },
    { label: 'Metal',         q: 'metal rock 2025',               mode: 'tidal' },
    { label: 'Classical',     q: 'classical piano orchestra',     mode: 'tidal' },
  ];

  function buildGenreChips() {
    const wrap = $('genre-chips');
    wrap.innerHTML = HOME_GENRES.map((g, i) => `
      <div class="chip ${i === 0 ? 'active' : ''}" data-idx="${i}">${escHtml(g.label)}</div>
    `).join('');
    wrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', function () {
        wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const g = HOME_GENRES[parseInt(this.dataset.idx)];
        loadHome(g.q);
      });
    });
  }

  async function loadHome(query = HOME_GENRES[0].q) {
    const el = $('home-tracks');
    el.innerHTML = UI.skeletons();
    try {
      const tracks = await search(query);
      UI.renderTracks(tracks, 'home-tracks', currentId);
    } catch (e) {
      el.innerHTML = `<div class="empty"><p>Failed to load: ${escHtml(e.message)}</p></div>`;
    }
  }

  // search //

  let searchTimer;

  function initSearch() {
    const input = $('search-input');
    const clear = $('search-clear');
    const modeSelect = $('search-mode');

    input.addEventListener('input', () => {
      clear.style.display = input.value ? 'flex' : 'none';
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (!q) {
        $('search-results').innerHTML = emptySearch();
        return;
      }
      $('search-results').innerHTML = UI.skeletons();
      searchTimer = setTimeout(() => doSearch(q, modeSelect?.value || 'auto'), 380);
    });

    clear.addEventListener('click', () => {
      input.value = '';
      clear.style.display = 'none';
      $('search-results').innerHTML = emptySearch();
    });

    modeSelect?.addEventListener('change', () => {
      const q = input.value.trim();
      if (q) doSearch(q, modeSelect.value);
    });
  }

  async function doSearch(q, mode = 'auto') {
    try {
      let tracks;
      if (mode === 'youtube') {
        tracks = await ivSearch(q);
      } else if (mode === 'tidal') {
        tracks = await hifiSearch(q);
      } else {
        tracks = await search(q);
      }
      UI.renderTracks(tracks, 'search-results', currentId);
    } catch (e) {
      $('search-results').innerHTML = `<div class="empty"><p>Search failed: ${escHtml(e.message)}</p></div>`;
    }
  }

  function emptySearch() {
    return `<div class="empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <p>Search TIDAL or YouTube</p>
    </div>`;
  }

  // library //

  function renderLibrary() {
    const hist = Player.loadHistory();
    if (!hist.length) {
      $('library-tracks').innerHTML = `<div class="empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <p>Songs you play appear here</p>
      </div>`;
      return;
    }
    UI.renderTracks(hist, 'library-tracks', currentId);
  }

  // track click //

  function onTrackClick(tracks, idx) {
    const track = tracks[idx];
    currentId = track.id;
    Player.play(track, tracks, idx);
    refreshActiveStates();
  }

  function refreshActiveStates() {
    document.querySelectorAll('.track-card').forEach(card => {
      const idx = parseInt(card.dataset.index);
      const cid = card.closest('.track-list')?._tracks?.[idx]?.id;
      card.classList.toggle('playing', cid === currentId);
      card.querySelector('.track-name')?.classList.toggle('playing', cid === currentId);
    });
  }

  // page nav //

  function showPage(name) {
    UI.showPage(name);
    if (name === 'library') renderLibrary();
    if (name === 'search') {
      setTimeout(() => $('search-input')?.focus(), 120);
    }
  }

  // now playing controls //

  function initPlayerControls() {
    $('np-progress-bar').addEventListener('click', e => {
      const rect = $('np-progress-bar').getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      Player.seek(pct);
    });

    $('vol-bar').addEventListener('click', e => {
      const rect = $('vol-bar').getBoundingClientRect();
      const v = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      Player.setVolume(v);
    });

    // swipe down to close
    let ty0 = 0;
    const npContent = $('np-content');
    npContent.addEventListener('touchstart', e => { ty0 = e.touches[0].clientY; }, { passive: true });
    npContent.addEventListener('touchmove', e => {
      if (e.touches[0].clientY - ty0 > 90) UI.closePlayer();
    }, { passive: true });
  }

  // provider status pill //

  function initProviderPill() {
    const pill = $('provider-pill');
    if (!pill) return;
    pill.innerHTML = ALL_HIFI_BASES
      .map(b => {
        const host = new URL(b).hostname.replace('www.', '');
        return `<span class="provider-dot" title="${host}">●</span>`;
      })
      .join('');
  }

  // share //

  function shareTrack() {
    const state = Player.getState();
    const t = state.currentTrack;
    if (!t) return;
    const url = t.url || (t.source === 'youtube' ? `https://youtu.be/${t.id}` : `https://tidal.com/track/${t.id}`);
    if (navigator.share) {
      navigator.share({ title: `${t.title} — ${t.artist}`, url });
    } else {
      navigator.clipboard.writeText(url).then(() => UI.toast('Link copied!'));
    }
  }

  // init //

  function init() {
    buildGenreChips();
    loadHome();
    initSearch();
    renderLibrary();
    initPlayerControls();
    initProviderPill();

    // wire nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showPage(btn.dataset.page));
    });

    // wire mini player click
    $('mini-player').addEventListener('click', () => UI.openPlayer());

    // wire now playing buttons
    $('np-handle').addEventListener('click', () => UI.closePlayer());
    $('np-close-btn').addEventListener('click', () => UI.closePlayer());
    $('np-share-btn').addEventListener('click', shareTrack);
    $('np-play-btn').addEventListener('click', () => Player.toggle());
    $('mini-play-btn').addEventListener('click', e => { e.stopPropagation(); Player.toggle(); });
    $('mini-prev-btn').addEventListener('click', e => { e.stopPropagation(); Player.prev(); });
    $('mini-next-btn').addEventListener('click', e => { e.stopPropagation(); Player.next(); });
    $('np-prev-btn').addEventListener('click', () => Player.prev());
    $('np-next-btn').addEventListener('click', () => Player.next());
    $('shuffle-btn').addEventListener('click', () => Player.toggleShuffle());
    $('repeat-btn').addEventListener('click', () => Player.toggleRepeat());
  }

  return { init, onTrackClick, showPage, shareTrack };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
