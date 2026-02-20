// ── ui.js — DOM rendering and UI updates ──

// ── helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtTime(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── server pill ───────────────────────────────────────────────────────────
const UI_serverPill = {
  el:   document.getElementById('server-pill'),
  dot:  document.querySelector('#server-pill .pill-dot'),
  text: document.querySelector('#server-pill .pill-text'),

  set(status, host) {
    const { dot, text } = this;
    dot.className = 'pill-dot';
    if (status === 'ok') {
      dot.classList.add('ok');
      text.textContent = host;
    } else if (status === 'error') {
      dot.classList.add('err');
      text.textContent = 'No server';
    } else {
      text.textContent = 'Connecting…';
    }
  },
};

// ── track list ────────────────────────────────────────────────────────────
const UI_trackList = {
  el: document.getElementById('track-list'),
  countEl: document.getElementById('queue-count'),

  showEmpty() {
    this.el.innerHTML = `
      <div class="state-msg">
        <span class="icon">🎵</span>
        <div class="title">Your queue is empty</div>
        Search above to discover music
      </div>`;
  },

  showLoading() {
    this.el.innerHTML = `
      <div class="loader">
        <div class="spinner"></div>
        Searching…
      </div>`;
  },

  showError(msg) {
    this.el.innerHTML = `
      <div class="state-msg">
        <span class="icon">⚠️</span>
        <div class="title">Something went wrong</div>
        ${esc(msg)}
      </div>`;
  },

  render(tracks, activeIdx, onPlay) {
    if (!tracks.length) { this.showEmpty(); return; }

    this.countEl.textContent = tracks.length;

    this.el.innerHTML = tracks.map((t, i) => `
      <div class="track-item ${i === activeIdx ? 'active' : ''}"
           data-i="${i}"
           style="animation-delay:${i * 22}ms">
        <div class="track-thumb-wrap">
          <img src="${esc(t.thumb)}" loading="lazy" alt=""/>
          <div class="track-thumb-overlay">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="track-text">
          <div class="track-name">${esc(t.title)}</div>
          <div class="track-artist">${esc(t.artist)}</div>
        </div>
        <span class="track-dur">${fmtTime(t.dur)}</span>
        <div class="playing-bars">
          <span></span><span></span><span></span>
        </div>
      </div>
    `).join('');

    this.el.querySelectorAll('.track-item').forEach(el => {
      el.addEventListener('click', () => onPlay(+el.dataset.i));
    });

    // scroll active into view
    const active = this.el.querySelector('.track-item.active');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
};

// ── now-playing center ────────────────────────────────────────────────────
const UI_nowPlaying = {
  artImg:   document.getElementById('art-img'),
  artPh:    document.querySelector('.art-placeholder'),
  albumArt: document.getElementById('album-art'),
  title:    document.getElementById('track-title'),
  artist:   document.getElementById('track-artist'),
  idle:     document.getElementById('idle-hint'),
  meta:     document.getElementById('track-meta'),

  showIdle() {
    this.idle.style.display  = 'flex';
    this.meta.style.display  = 'none';
    this.artImg.classList.remove('visible');
    this.artPh.style.display = 'flex';
    this.albumArt.classList.remove('playing');
  },

  setTrack(track) {
    this.idle.style.display  = 'none';
    this.meta.style.display  = 'block';
    this.title.textContent   = track.title;
    this.artist.textContent  = track.artist;

    if (track.thumb) {
      this.artImg.src = track.thumb;
      this.artImg.classList.add('visible');
      this.artPh.style.display = 'none';
    }
  },

  setPlaying(yes) {
    this.albumArt.classList.toggle('playing', yes);
  },
};

// ── ambient background ────────────────────────────────────────────────────
const UI_ambient = {
  el: document.getElementById('ambient-art'),
  setThumb(url) {
    if (!url) return;
    this.el.style.backgroundImage = `url(${url})`;
    this.el.classList.add('visible');
  },
};

// ── player bar ────────────────────────────────────────────────────────────
const UI_playerBar = {
  barThumb:  document.getElementById('bar-thumb'),
  barTitle:  document.getElementById('bar-title'),
  barArtist: document.getElementById('bar-artist'),
  playIcon:  document.getElementById('play-icon'),
  progFill:  document.getElementById('progress-fill'),
  tCur:      document.getElementById('t-cur'),
  tEnd:      document.getElementById('t-end'),
  volSlider: document.getElementById('volume-slider'),

  setTrack(track) {
    this.barThumb.src           = track.thumb || '';
    this.barTitle.textContent   = track.title;
    this.barArtist.textContent  = track.artist;
  },

  setPlaying(yes) {
    this.playIcon.setAttribute('d', yes
      ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'   // pause
      : 'M8 5v14l11-7z');                     // play
    this.barThumb.classList.toggle('playing', yes);
  },

  setProgress(cur, dur) {
    if (!dur) return;
    const pct = (cur / dur) * 100;
    this.progFill.style.width = `${pct}%`;
    this.tCur.textContent = fmtTime(cur);
    this.tEnd.textContent = fmtTime(dur);
  },
};

// export
window.UI = {
  server:    UI_serverPill,
  trackList: UI_trackList,
  nowPlaying:UI_nowPlaying,
  ambient:   UI_ambient,
  playerBar: UI_playerBar,
  fmtTime,
};
