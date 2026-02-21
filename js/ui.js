/* ═══════════════════════════════════════════════════
   ui.js — Shared State + UI helpers + App controller
   Lives in index.html shell, available on all pages.
   ═══════════════════════════════════════════════════ */

// ── Shared State (sessionStorage backed) ─────────────────────────────
const State = (() => {
  const KEY = 'topiaTune';
  const defaults = {
    tracks: [], currentIdx: -1, isPlaying: false, volume: 80, library: [],
  };

  function load() {
    try { return Object.assign({}, defaults, JSON.parse(sessionStorage.getItem(KEY) || '{}')); }
    catch { return { ...defaults }; }
  }
  function save(t) {
    try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch {}
  }

  return new Proxy(load(), {
    set(target, prop, value) { target[prop] = value; save(target); return true; },
  });
})();

// ── UI helpers ────────────────────────────────────────────────────────
const UI = (() => {
  const $ = id => document.getElementById(id);

  function updateBar(track) {
    if (!track) return;
    if ($('bar-thumb') && track.thumb) $('bar-thumb').src = track.thumb;
    if ($('bar-title'))  $('bar-title').textContent  = track.title;
    if ($('bar-ch'))     $('bar-ch').textContent     = track.ch;
  }

  function updatePlayBtn() {
    const icon = $('play-icon');
    if (!icon) return;
    icon.setAttribute('d', State.isPlaying
      ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'
      : 'M8 5v14l11-7z');
  }

  function updateProgress(cur, dur) {
    const pct = dur ? (cur / dur) * 100 : 0;
    if ($('prog-fill')) $('prog-fill').style.width = `${pct}%`;
    if ($('t-cur'))     $('t-cur').textContent = fmt(cur);
    if ($('t-end'))     $('t-end').textContent = fmt(dur);
  }

  function updateVolFill(v) { if ($('vol-fill')) $('vol-fill').style.width = `${v}%`; }

  function renderQueue() {
    const list = $('queue-list');
    if (!list) return;
    if (!State.tracks.length) {
      list.innerHTML = `<div class="msg"><span class="msg-icon">
        <img src="icons/casette-tape.svg" alt="" width="24" height="24"/></span>
        Search to fill your queue</div>`;
      return;
    }
    list.innerHTML = State.tracks.map((t, i) => `
      <div class="track-item ${i === State.currentIdx ? 'active' : ''}"
           data-i="${i}" style="animation-delay:${i * 18}ms">
        <img class="ti-thumb" src="${esc(t.thumb)}" loading="lazy" onerror="this.style.opacity=0"/>
        <div class="ti-info">
          <div class="ti-name">${esc(t.title)}</div>
          <div class="ti-ch">${esc(t.ch)}</div>
        </div>
        <span class="ti-dur">${fmt(t.dur)}</span>
        <div class="bars"><span></span><span></span><span></span></div>
      </div>`).join('');
    list.querySelectorAll('.track-item').forEach(el =>
      el.addEventListener('click', () => App.playIdx(+el.dataset.i)));
  }

  function setPill(text, cls) {
    const t = $('pill-text');
    const p = $('pill');
    if (t) t.textContent = text;
    if (p) p.className = `server-pill ${cls || ''}`;
  }

  function startSpinning() { $('home-art-ring')?.classList.add('spinning'); }
  function stopSpinning()  { $('home-art-ring')?.classList.remove('spinning'); }

  function updateHomeHero(track) {
    const hero = $('now-playing-hero');
    if (!hero) return;
    hero.style.display = 'flex';
    if (track?.thumb) {
      const img = $('home-art-img');
      const ph  = $('home-art-ph');
      if (img) { img.src = track.thumb; img.style.display = 'block'; }
      if (ph)  ph.style.display = 'none';
    }
    if ($('home-title')) $('home-title').textContent = track?.title || '—';
    if ($('home-ch'))    $('home-ch').textContent    = track?.ch    || '—';
  }

  function fmt(s) {
    s = Math.floor(s || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { updateBar, updatePlayBtn, updateProgress, updateVolFill,
           renderQueue, setPill, startSpinning, stopSpinning,
           updateHomeHero, fmt, esc };
})();

// ── App controller ────────────────────────────────────────────────────
const App = (() => {
  function addToLibrary(track) {
    const lib = State.library;
    const ex  = lib.find(t => t.id === track.id);
    if (ex) ex.plays++;
    else    lib.unshift({ ...track, plays: 1 });
    if (lib.length > 60) lib.length = 60;
    State.library = lib;
  }

  function playIdx(i) {
    if (i < 0 || i >= State.tracks.length) return;
    State.currentIdx = i;
    const track = State.tracks[i];
    UI.updateBar(track);
    UI.renderQueue();
    UI.updateHomeHero(track);
    Player.load(track.id);
    addToLibrary(track);
  }

  function nextTrack() {
    if (State.tracks.length) playIdx((State.currentIdx + 1) % State.tracks.length);
  }
  function prevTrack() {
    if (State.tracks.length) playIdx((State.currentIdx - 1 + State.tracks.length) % State.tracks.length);
  }

  function init() {
    $('btn-play')?.addEventListener('click', Player.togglePlay);
    $('btn-next')?.addEventListener('click', nextTrack);
    $('btn-prev')?.addEventListener('click', prevTrack);

    $('prog-bar')?.addEventListener('click', e => {
      const bar = e.currentTarget;
      const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
      Player.seekTo(Math.max(0, Math.min(1, pct)));
    });

    const vol = $('vol');
    if (vol) {
      vol.value = State.volume;
      UI.updateVolFill(State.volume);
      vol.addEventListener('input', () => {
        Player.setVolume(+vol.value);
        UI.updateVolFill(+vol.value);
      });
    }

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space')      { e.preventDefault(); Player.togglePlay(); }
      if (e.code === 'ArrowRight') nextTrack();
      if (e.code === 'ArrowLeft')  prevTrack();
    });

    const cur = State.tracks[State.currentIdx];
    if (cur) UI.updateBar(cur);
    UI.updatePlayBtn();
    UI.renderQueue();
  }

  const $ = id => document.getElementById(id);
  document.addEventListener('DOMContentLoaded', init);
  return { playIdx, nextTrack, prevTrack };
})();
