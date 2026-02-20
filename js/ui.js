// ── ui.js — all DOM rendering and updates ──

const UI = (() => {

  // ── utils ────────────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmt(s) {
    s = Math.floor(s || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── server pill ──────────────────────────────────────────────────
  const server = {
    dot:  document.getElementById('dot'),
    text: document.getElementById('pill-text'),

    set(status, host) {
      this.dot.className = 'dot';
      if (status === 'ok') {
        this.dot.classList.add('ok');
        this.text.textContent = host;
      } else if (status === 'error') {
        this.dot.classList.add('err');
        this.text.textContent = 'No server found';
      } else {
        this.text.textContent = 'Connecting…';
      }
    },
  };

  // ── track list ───────────────────────────────────────────────────
  const trackList = {
    el:      document.getElementById('list'),
    countEl: document.getElementById('q-count'),

    showEmpty() {
      this.el.innerHTML = `
        <div class="empty">
          <span class="eicon">🎵</span>
          <div class="etitle">Your queue is empty</div>
          Search above to discover music
        </div>`;
      this.countEl.textContent = '0';
    },

    showLoading() {
      this.el.innerHTML = '<div class="spinner"></div>';
      this.countEl.textContent = '0';
    },

    showError(msg) {
      this.el.innerHTML = `
        <div class="empty">
          <span class="eicon">⚠️</span>
          <div class="etitle">Something went wrong</div>
          ${esc(msg)}
        </div>`;
    },

    render(tracks, activeIdx, onPlay) {
      if (!tracks.length) { this.showEmpty(); return; }
      this.countEl.textContent = tracks.length;

      this.el.innerHTML = tracks.map((t, i) => `
        <div class="ti ${i === activeIdx ? 'active' : ''}"
             data-i="${i}"
             style="animation-delay:${i * 20}ms">
          <div class="ti-img-wrap">
            <img src="${esc(t.thumb)}" loading="lazy" alt=""/>
            <div class="ti-play-ov">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          <div class="ti-info">
            <div class="ti-name">${esc(t.title)}</div>
            <div class="ti-ch">${esc(t.ch)}</div>
          </div>
          <span class="ti-dur">${fmt(t.dur)}</span>
          <div class="bars"><span></span><span></span><span></span></div>
        </div>
      `).join('');

      this.el.querySelectorAll('.ti').forEach(el => {
        el.addEventListener('click', () => onPlay(+el.dataset.i));
      });

      // scroll active track into view
      this.el.querySelector('.ti.active')
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };

  // ── now playing ──────────────────────────────────────────────────
  const nowPlaying = {
    artEl:   document.getElementById('art'),
    artRing: document.getElementById('art-ring'),
    artImg:  document.getElementById('art-img'),
    artPh:   document.querySelector('.art-ph'),
    artOrb:  document.getElementById('art-orb'),
    meta:    document.getElementById('meta'),
    title:   document.getElementById('meta-title'),
    ch:      document.getElementById('meta-ch'),
    idle:    document.getElementById('idle'),

    showIdle() {
      this.idle.style.display = 'flex';
      this.meta.classList.remove('show');
    },

    setTrack(track) {
      this.idle.style.display = 'none';
      this.meta.classList.add('show');
      this.title.textContent = track.title;
      this.ch.textContent    = track.ch;

      if (track.thumb) {
        this.artImg.src = track.thumb;
        this.artImg.classList.add('show');
        this.artPh.style.display    = 'none';
        this.artOrb.style.backgroundImage = `url(${track.thumb})`;
        this.artOrb.classList.add('show');
      }
    },

    setPlaying(yes) {
      this.artEl.classList.toggle('lit', yes);
      this.artRing.classList.toggle('playing', yes);
    },
  };

  // ── player bar ───────────────────────────────────────────────────
  const playerBar = {
    img:       document.getElementById('bar-img'),
    title:     document.getElementById('bar-title'),
    ch:        document.getElementById('bar-ch'),
    playIcon:  document.getElementById('play-icon'),
    progFill:  document.getElementById('prog-fill'),
    tCur:      document.getElementById('t-cur'),
    tEnd:      document.getElementById('t-end'),
    volSlider: document.getElementById('vol'),

    setTrack(track) {
      this.img.src          = track.thumb || '';
      this.title.textContent = track.title;
      this.ch.textContent    = track.ch;
    },

    setPlaying(yes) {
      this.playIcon.setAttribute('d', yes
        ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'  // pause
        : 'M8 5v14l11-7z');                   // play
      this.img.classList.toggle('lit', yes);
    },

    setProgress(cur, dur) {
      if (!dur) return;
      this.progFill.style.width = `${(cur / dur) * 100}%`;
      this.tCur.textContent     = fmt(cur);
      this.tEnd.textContent     = fmt(dur);
    },
  };

  return { server, trackList, nowPlaying, playerBar, esc, fmt };

})();

window.UI = UI;
