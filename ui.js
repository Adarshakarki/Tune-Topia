const $ = id => document.getElementById(id);

const UI = (() => {

  /* ── helpers ── */
  function reIcon(el, name) {
    if (!el) return;
    const i = el.querySelector('i[data-lucide]') || el;
    if (i.tagName === 'I') { i.setAttribute('data-lucide', name); lucide.createIcons({ nodes:[i] }); }
  }

  /* ── toast ── */
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ── color extraction ── */
  function extractColor(src, cb) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 40;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 40, 40);
        const d = ctx.getImageData(0, 0, 40, 40).data;
        let r=0,g=0,b=0,count=0;
        for (let i=0; i<d.length; i+=16) { r+=d[i]; g+=d[i+1]; b+=d[i+2]; count++; }
        r=Math.round(r/count); g=Math.round(g/count); b=Math.round(b/count);
        const lum = 0.299*r+0.587*g+0.114*b;
        if (lum>180) { r=Math.round(r*0.65); g=Math.round(g*0.65); b=Math.round(b*0.65); }
        cb(r,g,b);
      };
      img.onerror = () => cb(60,20,100);
      img.src = src;
    } catch { cb(60,20,100); }
  }

  /* ── set track info (mobile NP) ── */
  function setTrackInfo(track) {
    const title  = track.title  || '—';
    const artist = track.artist || '—';
    const art    = track.cover  || track.coverSmall || '';
    const isExplicit = track.explicit || false;

    // mini player
    $('mini-title').textContent = title;
    $('mini-artist-time').textContent = artist;
    $('mini-art').src = art;
    $('mini-player').classList.remove('hidden');
    const mex = $('mini-explicit');
    if (mex) mex.style.display = isExplicit ? 'inline-flex' : 'none';

    // now playing
    $('np-title').textContent  = title;
    $('np-artist').textContent = artist;
    $('np-bg-art').src = art;
    const nex = $('np-explicit-tag');
    if (nex) nex.style.display = isExplicit ? 'inline-flex' : 'none';

    // panels
    const setEl = (id, val) => { const e=$(id); if(e) e.textContent=val; };
    setEl('np-lyrics-track-name',  title);
    setEl('np-lyrics-track-artist',artist);
    setEl('np-queue-track-name',   title);
    setEl('np-queue-track-artist', artist);

    // panel bg art
    ['np-lyrics-bg-art','np-queue-bg-art'].forEach(id => { const e=$(id); if(e) e.src=art; });

    // liked state
    const liked = LikedSongs.has(track.id);
    const loveBtn = $('np-love-btn');
    if (loveBtn) loveBtn.classList.toggle('active', liked);

    // color extraction → NP + mini gradients + desktop bar
    if (art) {
      extractColor(art, (r,g,b) => {
        const np = $('now-playing');
        if (np) {
          np.style.setProperty('--np-rgb', `${r},${g},${b}`);
          $('np-bg-gradient').style.background = `linear-gradient(180deg,
            transparent 0%, transparent 42%,
            rgba(${r},${g},${b},0.38) 55%,
            rgba(${Math.round(r*0.7)},${Math.round(g*0.7)},${Math.round(b*0.7)},0.78) 68%,
            rgba(${Math.round(r*0.35)},${Math.round(g*0.35)},${Math.round(b*0.35)},0.94) 82%,
            rgb(${Math.round(r*0.18)},${Math.round(g*0.18)},${Math.round(b*0.18)}) 100%)`;
        }
        // mini player gradient
        const mini = $('mini-player-inner');
        if (mini) mini.style.setProperty('--mini-gradient',
          `linear-gradient(90deg, rgba(${r},${g},${b},0.28) 0%, rgba(${r},${g},${b},0.10) 45%, transparent 100%)`);
        // desktop bar tint
        const bg = $('dt-mini-bar-bg');
        if (bg) bg.style.background = `linear-gradient(90deg, rgba(${r},${g},${b},0.12) 0%, rgba(255,255,255,0.88) 60%)`;
      });
    }
  }

  /* ── play state ── */
  function setPlayState(playing) {
    const iconName = playing ? 'pause' : 'play';
    // mobile np
    const npIcon = $('np-play-icon');
    if (npIcon) { npIcon.setAttribute('data-lucide', iconName); lucide.createIcons({nodes:[npIcon]}); }
    // mini
    const mIcon = $('mini-play-icon');
    if (mIcon) { mIcon.setAttribute('data-lucide', iconName); lucide.createIcons({nodes:[mIcon]}); }
    // panel icons
    ['np-lyrics-play-icon','np-queue-play-icon'].forEach(id => {
      const e=$(id); if(e) { e.setAttribute('data-lucide',iconName); lucide.createIcons({nodes:[e]}); }
    });
    // paused visual dim
    const np = $('now-playing');
    if (np) np.classList.toggle('paused', !playing);
    // desktop bar
    const dtIcon = $('dt-play-icon');
    if (dtIcon) { dtIcon.setAttribute('data-lucide', iconName); lucide.createIcons({nodes:[dtIcon]}); }
  }

  /* ── progress ── */
  function updateProgress(pct, cur, dur) {
    $('np-progress-fill').style.width   = pct+'%';
    $('mini-progress-fill').style.width = pct+'%';
    $('np-time-cur').textContent = fmtTime(cur);
    $('np-time-tot').textContent = fmtTime(dur);
    const artist = $('np-artist').textContent;
    $('mini-artist-time').textContent = artist ? `${artist} · ${fmtTime(cur)}` : fmtTime(cur);
    // panels
    ['np-lyrics-mini-fill','np-queue-mini-fill'].forEach(id => {
      const e=$(id); if(e) e.style.width=pct+'%';
    });
    // desktop
    DesktopApp.syncDtProgress(pct, cur, dur);
  }

  /* ── volume ── */
  function updateVolume(v) {
    $('vol-fill').style.width = (v*100)+'%';
    const dtv = $('dt-vol-fill');
    if (dtv) dtv.style.width = (v*100)+'%';
  }

  /* ── shuffle / repeat ── */
  function setShuffle(on) {
    const btn = $('shuffle-btn');
    if (btn) btn.classList.toggle('active', on);
    const dtBtn = $('dt-shuffle-btn');
    if (dtBtn) dtBtn.classList.toggle('active', on);
  }
  function setRepeat(on) {
    const btn = $('repeat-btn');
    if (btn) btn.classList.toggle('active', on);
    const dtBtn = $('dt-repeat-btn');
    if (dtBtn) dtBtn.classList.toggle('active', on);
  }

  /* ── queue panel ── */
  function renderQueue(queue, activeIdx) {
    const list = $('np-queue-list');
    if (!list || !queue.length) { if(list) list.innerHTML=''; return; }
    list.innerHTML = queue.map((t,i) => `
      <div class="npq-item ${i===activeIdx?'active':''}" onclick="Player.playFromQueue(${i})">
        <img class="npq-art" src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="npq-info">
          <div class="npq-title ${i===activeIdx?'active':''}">${escHtml(t.title)}</div>
          <div class="npq-artist">${escHtml(t.artist||'')}</div>
        </div>
        ${i===activeIdx
          ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
          : `<span class="npq-dur">${t.dur||''}</span>
             <div class="npq-drag"><i data-lucide="grip-vertical"></i></div>`}
      </div>
    `).join('');
    lucide.createIcons({ nodes: Array.from(list.querySelectorAll('i[data-lucide]')) });
  }

  /* ── NP open/close ── */
  function openPlayer()  { $('now-playing').classList.add('open'); }
  function closePlayer() {
    document.querySelectorAll('.np-panel').forEach(p=>p.classList.remove('open'));
    $('now-playing').classList.remove('open');
  }
  function openPanel(id) {
    document.querySelectorAll('.np-panel').forEach(p=>p.classList.remove('open'));
    const p=$(id); if(p) p.classList.add('open');
  }
  function closePanel(id) { const p=$(id); if(p) p.classList.remove('open'); }

  /* ── more options sheet ── */
  function openMoreSheet(track) {
    const sheet = $('np-more-sheet');
    if (!sheet) return;
    const preview = $('sheet-track-preview');
    if (preview && track) {
      preview.innerHTML = `
        <img src="${escHtml(track.coverSmall||track.cover||'')}" onerror="this.src=''" alt=""/>
        <div><div class="bs-title">${escHtml(track.title)}</div><div class="bs-artist">${escHtml(track.artist||'')}</div></div>
      `;
    }
    sheet.classList.add('open');
  }
  function closeMoreSheet() { const s=$('np-more-sheet'); if(s) s.classList.remove('open'); }

  /* ── liked state sync ── */
  function syncLikeButtons(trackId) {
    const liked = LikedSongs.has(trackId);
    // NP love btn
    const lb = $('np-love-btn');
    if (lb) { lb.classList.toggle('active', liked); }
    // desktop bar like
    const dl = $('dt-bar-like-btn');
    if (dl) { dl.classList.toggle('liked', liked); }
  }

  /* ── skeletons ── */
  function skeletons(n=10) {
    return Array(n).fill(0).map(()=>`
      <div class="skel-card">
        <div class="skeleton skel-thumb"></div>
        <div class="skel-lines">
          <div class="skeleton skel-line" style="width:${50+Math.random()*40}%"></div>
          <div class="skeleton skel-line" style="width:${25+Math.random()*30}%"></div>
        </div>
      </div>`).join('');
  }
  function skeletonsGrid(n=6) {
    return `<div class="dt-skel-grid">${Array(n).fill(0).map(()=>`
      <div>
        <div class="dt-skel-art"></div>
        <div class="dt-skel-line" style="width:85%"></div>
        <div class="dt-skel-line-sm"></div>
      </div>`).join('')}</div>`;
  }

  /* ── track list (mobile) ── */
  function renderTracks(tracks, container, currentId) {
    if (!tracks.length) { container.innerHTML = emptyState('No results','Try a different search'); return; }
    container.className = '';
    container.innerHTML = tracks.map((t,i) => {
      const badge    = qualityBadge(t);
      const isActive = t.id === currentId;
      const isVideo  = t.source === 'youtube';
      const liked    = LikedSongs.has(t.id);
      return `
        <div class="track-card-wrap" data-index="${i}">
          <div class="swipe-actions">
            <div class="swipe-action-right"><i data-lucide="skip-forward" style="width:16px;height:16px"></i>Next</div>
            <div class="swipe-action-left"><i data-lucide="trash-2" style="width:16px;height:16px"></i>Remove</div>
          </div>
          <div class="track-card ${isActive?'playing':''}">
            <img class="${isVideo?'track-thumb-video':'track-thumb'}"
                 src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
            <div class="track-info">
              <div class="track-name-row">
                <div class="track-name ${isActive?'playing':''}">${escHtml(t.title)}</div>
                ${t.explicit?`<span class="explicit-tag">E</span>`:''}
              </div>
              <div class="track-meta">${escHtml(t.artist||'')}${t.album?` · ${escHtml(t.album)}`:''}</div>
            </div>
            <div class="track-right">
              ${isActive
                ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
                : badge ? `<span class="quality-badge ${badge.cls}">${badge.label}</span>` : ''}
              <button class="track-like-btn ${liked?'liked':''}" data-tid="${escHtml(t.id)}" onclick="event.stopPropagation();App.toggleLike(this,${i})">
                <i data-lucide="heart" style="width:16px;height:16px;${liked?'fill:var(--purple)':''}"></i>
              </button>
              <span class="track-dur">${t.dur||''}</span>
            </div>
          </div>
        </div>`;
    }).join('');
    container._tracks = tracks;
    lucide.createIcons({ nodes: Array.from(container.querySelectorAll('i[data-lucide]')) });
    attachTrackEvents(container);
  }

  function attachTrackEvents(container) {
    container.querySelectorAll('.track-card-wrap').forEach(wrap => {
      const card = wrap.querySelector('.track-card');
      const idx  = parseInt(wrap.dataset.index);
      card.addEventListener('click', () => App.onTrackClick(container._tracks, idx));
      let startX=0,startY=0,dragging=false,dx=0;
      card.addEventListener('touchstart', e => { startX=e.touches[0].clientX; startY=e.touches[0].clientY; dragging=false; dx=0; }, {passive:true});
      card.addEventListener('touchmove', e => {
        const mx=e.touches[0].clientX-startX, my=e.touches[0].clientY-startY;
        if (!dragging && Math.abs(my)>Math.abs(mx)) return;
        dragging=true; dx=Math.max(-90,Math.min(90,mx));
        card.style.transform=`translateX(${dx}px)`;
      }, {passive:true});
      card.addEventListener('touchend', () => {
        if (!dragging) return;
        if (dx>55) { App.playNext(container._tracks,idx); toast('Added to queue'); }
        if (dx<-55) { App.removeTrack(container,idx); }
        card.style.transition='transform 0.3s var(--spring)';
        card.style.transform='';
        setTimeout(()=>card.style.transition='',350);
      });
    });
  }

  /* ── horizontal scroll cards ── */
  function renderHorizCards(tracks, container) {
    if (!container) return;
    container.innerHTML = '';
    tracks.slice(0, 15).forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'horiz-card';
      div.innerHTML = `
        <img class="horiz-card-art" src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="horiz-card-title">${escHtml(t.title||t.name||'')}</div>
        <div class="horiz-card-artist">${escHtml(t.artist||'')}</div>`;
      div.addEventListener('click', () => App.onTrackClick(tracks, i));
      container.appendChild(div);
    });
  }

  /* ── album / artist renders (mobile) ── */
  function renderAlbums(albums, container) {
    if (!albums.length) { container.innerHTML=emptyState('No albums found'); return; }
    container.className='album-grid';
    container.innerHTML=albums.map((a,i)=>`
      <div class="album-card" data-index="${i}">
        <img class="album-art" src="${escHtml(a.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="album-title">${escHtml(a.title||a.name||'')}</div>
        <div class="album-artist">${escHtml(a.artist||'')}</div>
      </div>`).join('');
    container._albums=albums;
    container.querySelectorAll('.album-card').forEach(card=>{
      card.addEventListener('click',()=>toast(`Album: ${albums[parseInt(card.dataset.index)].title}`));
    });
  }

  function renderArtists(artists, container) {
    if (!artists.length) { container.innerHTML=emptyState('No artists found'); return; }
    container.className='artist-list';
    container.innerHTML=artists.map((a,i)=>`
      <div class="artist-card" data-index="${i}">
        <img class="artist-avatar" src="${escHtml(a.cover||'')}" onerror="this.src=''" alt=""/>
        <div>
          <div class="artist-name">${escHtml(a.name)}</div>
          <div class="artist-label">Artist</div>
        </div>
        <i data-lucide="chevron-right" class="artist-chevron"></i>
      </div>`).join('');
    container._artists=artists;
    lucide.createIcons({ nodes: Array.from(container.querySelectorAll('i[data-lucide]')) });
    container.querySelectorAll('.artist-card').forEach(card=>{
      card.addEventListener('click',()=>{ const a=artists[parseInt(card.dataset.index)]; App.searchArtistTracks(a.name); });
    });
  }

  /* ── page nav ── */
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    const page = $('page-'+name);
    const btn  = document.querySelector(`.nav-btn[data-page="${name}"]`);
    if (page) page.classList.add('active');
    if (btn)  btn.classList.add('active');
  }

  /* ── empty state ── */
  function emptyState(msg, sub='') {
    return `<div class="empty">
      <i data-lucide="search" style="width:52px;height:52px"></i>
      <p>${escHtml(msg)}</p>
      ${sub?`<small>${escHtml(sub)}</small>`:''}
    </div>`;
  }

  return {
    toast, setTrackInfo, setPlayState, updateProgress, updateVolume,
    setShuffle, setRepeat, renderQueue,
    openPlayer, closePlayer, openPanel, closePanel,
    openMoreSheet, closeMoreSheet, syncLikeButtons,
    skeletons, skeletonsGrid, renderTracks, renderAlbums, renderArtists,
    renderHorizCards, showPage, emptyState,
  };
})();