// dom refs //

const $ = id => document.getElementById(id);

const UI = (() => {

  // toast //

  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // track info //

  function setTrackInfo(track) {
    const title = track.title || '—';
    const artist = track.artist || '—';
    const art = track.cover || track.coverSmall || '';

    $('mini-title').textContent = title;
    $('mini-artist').textContent = artist;
    $('mini-art').src = art;
    $('mini-player').classList.remove('hidden');

    $('np-title').textContent = title;
    $('np-artist').textContent = artist;
    $('np-art').src = art;
    $('np-bg').style.backgroundImage = `url('${art}')`;

    const badge = qualityBadge(track);
    $('np-quality-badge').style.display = badge ? 'inline-flex' : 'none';
    if (badge) {
      $('np-quality-badge').textContent = badge.label;
      $('np-quality-badge').className = `quality-badge ${badge.cls}`;
    }

    extractColor(art);
  }

  // play state //

  function setPlayState(playing) {
    const pausePath = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    const playPath = '<path d="M8 5v14l11-7z"/>';
    const path = playing ? pausePath : playPath;
    $('np-play-icon').innerHTML = path;
    $('mini-play-icon').innerHTML = path;
    $('np-art').classList.toggle('playing', playing);
  }

  function setLoadingState(loading) {
    $('np-play-btn').style.opacity = loading ? '0.5' : '1';
  }

  // progress //

  function updateProgress(pct, cur, dur) {
    $('np-progress-fill').style.width = pct + '%';
    $('mini-progress').style.width = pct + '%';
    $('np-time-cur').textContent = fmtTime(cur);
    $('np-time-tot').textContent = fmtTime(dur);
  }

  // volume //

  function updateVolume(v) {
    $('vol-fill').style.width = (v * 100) + '%';
  }

  // shuffle / repeat //

  function setShuffle(on) {
    const el = $('shuffle-icon');
    el.style.opacity = on ? '1' : '0.35';
    el.style.color = on ? 'var(--dynamic)' : 'currentColor';
  }

  function setRepeat(on) {
    const el = $('repeat-icon');
    el.style.opacity = on ? '1' : '0.35';
    el.style.color = on ? 'var(--dynamic)' : 'currentColor';
  }

  // queue //

  function renderQueue(queue, activeIdx) {
    const list = $('np-queue-list');
    if (!queue.length) { list.innerHTML = ''; return; }
    list.innerHTML = queue.map((t, i) => `
      <div class="npq-item ${i === activeIdx ? 'active' : ''}" onclick="Player.playFromQueue(${i})">
        <img class="npq-art" src="${escHtml(t.coverSmall || t.cover || '')}" 
             onerror="this.src=''" alt="" />
        <div class="npq-info">
          <div class="npq-title ${i === activeIdx ? 'active' : ''}">${escHtml(t.title)}</div>
          <div class="npq-artist">${escHtml(t.artist || '')}</div>
        </div>
        ${i === activeIdx
          ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
          : `<span class="npq-dur">${t.dur || ''}</span>`
        }
      </div>
    `).join('');
  }

  // track cards //

  function skeletons(n = 10) {
    return Array(n).fill(0).map(() => `
      <div class="skel-card">
        <div class="skeleton skel-thumb"></div>
        <div class="skel-lines">
          <div class="skeleton skel-line" style="width:${55 + Math.random() * 35}%"></div>
          <div class="skeleton skel-line" style="width:${25 + Math.random() * 30}%"></div>
        </div>
      </div>
    `).join('');
  }

  function renderTracks(tracks, containerId, currentId) {
    const el = $(containerId);
    if (!el) return;
    if (!tracks.length) {
      el.innerHTML = '<div class="empty"><p>No results found</p></div>';
      return;
    }
    el.innerHTML = tracks.map((t, i) => {
      const badge = qualityBadge(t);
      const isActive = t.id === currentId;
      return `
        <div class="track-card ${isActive ? 'playing' : ''}" 
             data-index="${i}" data-container="${containerId}">
          <img class="track-thumb" 
               src="${escHtml(t.coverSmall || t.cover || '')}" 
               alt=""
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2252%22 height=%2252%22><rect width=%2252%22 height=%2252%22 fill=%22%231a1a28%22/></svg>'" />
          <div class="track-info">
            <div class="track-name ${isActive ? 'playing' : ''}">${escHtml(t.title)}</div>
            <div class="track-meta">
              ${escHtml(t.artist || '')}
              ${t.album ? `<span class="dot">·</span> ${escHtml(t.album)}` : ''}
            </div>
          </div>
          <div class="track-right">
            ${badge ? `<span class="quality-badge ${badge.cls}">${badge.label}</span>` : ''}
            <span class="track-dur">${t.dur || ''}</span>
          </div>
        </div>
      `;
    }).join('');
    el._tracks = tracks;

    el.querySelectorAll('.track-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.index);
        const all = el._tracks || [];
        App.onTrackClick(all, idx);
      });
    });
  }

  // now playing panel //

  function openPlayer() {
    $('now-playing').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePlayer() {
    $('now-playing').classList.remove('open');
    document.body.style.overflow = '';
  }

  // page nav //

  function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const page = $('page-' + name);
    const btn = document.querySelector(`.nav-btn[data-page="${name}"]`);
    if (page) page.classList.add('active');
    if (btn) btn.classList.add('active');
  }

  // dynamic color //

  function extractColor(imgUrl) {
    if (!imgUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 40; c.height = 40;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 40, 40);
        const d = ctx.getImageData(0, 0, 40, 40).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 16) {
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
        const avg = (r + g + b) / 3;
        const boost = v => Math.min(255, Math.round(avg + (v - avg) * 2));
        r = boost(r); g = boost(g); b = boost(b);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 170) { r = Math.round(r * 0.65); g = Math.round(g * 0.65); b = Math.round(b * 0.65); }
        document.documentElement.style.setProperty('--dynamic', `rgb(${r},${g},${b})`);
        document.documentElement.style.setProperty('--dynamic2', `rgb(${Math.min(255, r + 35)},${g},${Math.min(255, b + 50)})`);
      } catch {}
    };
    img.src = imgUrl;
  }

  return {
    toast, setTrackInfo, setPlayState, setLoadingState,
    updateProgress, updateVolume, setShuffle, setRepeat,
    renderQueue, renderTracks, skeletons,
    openPlayer, closePlayer, showPage, extractColor,
  };
})();
