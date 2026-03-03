// refs
const $ = id => document.getElementById(id);

const UI = (() => {

  // ── toast ──
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ── color extraction from album art ──
  function extractColor(imgEl, cb) {
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
        for (let i=0; i<d.length; i+=16) {
          r+=d[i]; g+=d[i+1]; b+=d[i+2]; count++;
        }
        r=Math.round(r/count); g=Math.round(g/count); b=Math.round(b/count);
        // boost saturation slightly, darken if too bright
        const lum = 0.299*r + 0.587*g + 0.114*b;
        if (lum > 180) { r=Math.round(r*0.65); g=Math.round(g*0.65); b=Math.round(b*0.65); }
        cb(r,g,b);
      };
      img.onerror = () => cb(60,20,100);
      img.src = imgEl.src || imgEl;
    } catch { cb(60,20,100); }
  }

  // ── set track info ──
  function setTrackInfo(track) {
    const title  = track.title  || '—';
    const artist = track.artist || '—';
    const art    = track.cover  || track.coverSmall || '';

    // mini player
    $('mini-title').textContent = title;
    $('mini-artist-time').textContent = artist;
    $('mini-art').src = art;
    $('mini-player').classList.remove('hidden');

    // now playing
    $('np-title').textContent  = title;
    $('np-artist').textContent = artist;
    $('np-bg-art').src = art;

    // panel background arts
    const lyrBg = $('np-lyrics-bg-art');
    const queeBg = $('np-queue-bg-art');
    if (lyrBg) lyrBg.src = art;
    if (queeBg) queeBg.src = art;

    // panel track labels
    const lyrName   = $('np-lyrics-track-name');
    const lyrArtist = $('np-lyrics-track-artist');
    const queeName  = $('np-queue-track-name');
    const queeArtist = $('np-queue-track-artist');
    if (lyrName)    lyrName.textContent    = title;
    if (lyrArtist)  lyrArtist.textContent  = artist;
    if (queeName)   queeName.textContent   = title;
    if (queeArtist) queeArtist.textContent = artist;

    // extract color → apply to NP gradient + mini player
    if (art) {
      extractColor(art, (r,g,b) => {
        // now playing bg gradient uses CSS var
        document.getElementById('now-playing').style.setProperty('--np-rgb', `${r},${g},${b}`);
        document.getElementById('np-bg-gradient').style.background =
          `linear-gradient(180deg,
            transparent 0%,
            transparent 42%,
            rgba(${r},${g},${b},0.38) 55%,
            rgba(${Math.round(r*0.7)},${Math.round(g*0.7)},${Math.round(b*0.7)},0.78) 68%,
            rgba(${Math.round(r*0.35)},${Math.round(g*0.35)},${Math.round(b*0.35)},0.94) 82%,
            rgb(${Math.round(r*0.18)},${Math.round(g*0.18)},${Math.round(b*0.18)}) 100%
          )`;
        // mini player: left→right gradient from extracted color, fades to transparent
        const mini = $('mini-player-inner');
        if (mini) {
          mini.style.setProperty('--mini-gradient',
            `linear-gradient(90deg, rgba(${r},${g},${b},0.28) 0%, rgba(${r},${g},${b},0.10) 45%, transparent 100%)`
          );
        }
      });
    }
  }

  // ── play state ──
  function setPlayState(playing) {
    const pause = `<line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>`;
    const play  = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    const svg   = (inner, w=30) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

    $('np-play-icon').innerHTML        = playing ? svg(pause,30) : svg(play,30);
    $('mini-play-icon').innerHTML      = playing ? svg(pause,24) : svg(play,24);

    // panel play icons
    const lyrIcon  = $('np-lyrics-play-icon');
    const queeIcon = $('np-queue-play-icon');
    if (lyrIcon)  lyrIcon.innerHTML  = playing ? svg(pause,26) : svg(play,26);
    if (queeIcon) queeIcon.innerHTML = playing ? svg(pause,26) : svg(play,26);

    // update mini artist/time with play state hint
    const cur = $('mini-artist-time').textContent;
    // artwork scale on NP — only a subtle overlay, handled by CSS
  }

  // ── progress ──
  function updateProgress(pct, cur, dur) {
    $('np-progress-fill').style.width   = pct + '%';
    $('mini-progress-fill').style.width = pct + '%';
    $('np-time-cur').textContent = fmtTime(cur);
    $('np-time-tot').textContent = fmtTime(dur);
    // update mini artist-time to show timestamp
    const artist = $('np-artist').textContent;
    $('mini-artist-time').textContent = artist ? `${artist} · ${fmtTime(cur)}` : fmtTime(cur);
    // panel progress bars
    const lyrFill  = $('np-lyrics-mini-fill');
    const queeFill = $('np-queue-mini-fill');
    if (lyrFill)  lyrFill.style.width  = pct + '%';
    if (queeFill) queeFill.style.width = pct + '%';
    // sync desktop
    DesktopApp.syncDtProgress(pct, cur, dur);
  }

  // ── volume ──
  function updateVolume(v) { $('vol-fill').style.width = (v*100)+'%'; }

  // ── shuffle / repeat ──
  function setShuffle(on) {
    $('shuffle-btn').classList.toggle('active', on);
    $('shuffle-icon').style.color = on ? 'var(--purple)' : '';
  }
  function setRepeat(on) {
    $('repeat-btn').classList.toggle('active', on);
    $('repeat-icon').style.color = on ? 'var(--purple)' : '';
  }

  // ── queue ──
  function renderQueue(queue, activeIdx) {
    const list = $('np-queue-list');
    if (!list || !queue.length) { if(list) list.innerHTML=''; return; }
    list.innerHTML = queue.map((t, i) => `
      <div class="npq-item ${i===activeIdx?'active':''}" onclick="Player.playFromQueue(${i})">
        <img class="npq-art" src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="npq-info">
          <div class="npq-title ${i===activeIdx?'active':''}">${escHtml(t.title)}</div>
          <div class="npq-artist">${escHtml(t.artist||'')}</div>
        </div>
        ${i===activeIdx
          ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
          : `<span class="npq-dur">${t.dur||''}</span>`}
      </div>
    `).join('');
  }

  // ── panels (lyrics / queue) ──
  function openPanel(id) {
    document.querySelectorAll('.np-panel').forEach(p => p.classList.remove('open'));
    const p = $(id);
    if (p) p.classList.add('open');
  }
  function closePanel(id) {
    const p = $(id);
    if (p) p.classList.remove('open');
  }

  // ── now playing open/close ──
  function openPlayer()  { $('now-playing').classList.add('open'); }
  function closePlayer() {
    document.querySelectorAll('.np-panel').forEach(p => p.classList.remove('open'));
    $('now-playing').classList.remove('open');
  }

  // ── skeletons ──
  function skeletons(n=10) {
    return Array(n).fill(0).map(() => `
      <div class="skel-card">
        <div class="skeleton skel-thumb"></div>
        <div class="skel-lines">
          <div class="skeleton skel-line" style="width:${50+Math.random()*40}%"></div>
          <div class="skeleton skel-line" style="width:${25+Math.random()*30}%"></div>
        </div>
      </div>
    `).join('');
  }
  function skeletonsGrid(n=6) {
    return `<div class="skel-grid">${Array(n).fill(0).map(()=>`
      <div>
        <div class="skeleton skel-square"></div>
        <div class="skeleton skel-block" style="width:80%"></div>
        <div class="skeleton skel-block" style="width:55%;margin-top:5px"></div>
      </div>
    `).join('')}</div>`;
  }

  // ── track list ──
  function renderTracks(tracks, container, currentId) {
    if (!tracks.length) { container.innerHTML = emptyState('No results','Try a different search'); return; }
    container.className = 'track-list';
    container.innerHTML = tracks.map((t,i) => {
      const badge    = qualityBadge(t);
      const isActive = t.id === currentId;
      const isVideo  = t.source === 'youtube';
      return `
        <div class="track-card-wrap" data-index="${i}">
          <div class="swipe-actions">
            <div class="swipe-action-right">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="4" x2="19" y2="20"/></svg>
              Next
            </div>
            <div class="swipe-action-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Remove
            </div>
          </div>
          <div class="track-card ${isActive?'playing':''}">
            <img class="${isVideo?'track-thumb-video':'track-thumb'}"
                 src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
            <div class="track-info">
              <div class="track-name ${isActive?'playing':''}">${escHtml(t.title)}</div>
              <div class="track-meta">${escHtml(t.artist||'')}${t.album?` · ${escHtml(t.album)}`:''}</div>
            </div>
            <div class="track-right">
              ${isActive
                ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
                : badge
                  ? `<span class="quality-badge ${badge.cls}">${badge.label}</span>`
                  : ''}
              <span class="track-dur">${t.dur||''}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    container._tracks = tracks;
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
      let lpt;
      card.addEventListener('touchstart', ()=>{ lpt=setTimeout(()=>App.showTrackMenu(container._tracks[idx]),520); },{passive:true});
      card.addEventListener('touchend', ()=>clearTimeout(lpt));
      card.addEventListener('touchmove', ()=>clearTimeout(lpt));
    });
  }

  // ── album / artist renders ──
  function renderAlbums(albums, container) {
    if (!albums.length) { container.innerHTML=emptyState('No albums found'); return; }
    container.className='album-grid';
    container.innerHTML=albums.map((a,i)=>`
      <div class="album-card" data-index="${i}">
        <img class="album-art" src="${escHtml(a.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="album-title">${escHtml(a.title||a.name||'')}</div>
        <div class="album-artist">${escHtml(a.artist||'')}</div>
      </div>
    `).join('');
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
        <svg class="artist-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    `).join('');
    container._artists=artists;
    container.querySelectorAll('.artist-card').forEach(card=>{
      card.addEventListener('click',()=>{
        const a=artists[parseInt(card.dataset.index)];
        App.searchArtistTracks(a.name);
      });
    });
  }

  // ── page nav ──
  function showPage(name) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    const page = $('page-'+name);
    const btn  = document.querySelector(`.nav-btn[data-page="${name}"]`);
    if (page) page.classList.add('active');
    if (btn)  btn.classList.add('active');
  }

  function setProviderStatus(label) {
    const el = $('provider-label');
    if (el) el.textContent = label;
  }

  // ── empty state ──
  function emptyState(msg, sub='') {
    return `<div class="empty">
      <svg width="52" height="52" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <p>${escHtml(msg)}</p>
      ${sub?`<small>${escHtml(sub)}</small>`:''}
    </div>`;
  }

  return {
    toast, setTrackInfo, setPlayState, updateProgress, updateVolume,
    setShuffle, setRepeat, renderQueue,
    openPlayer, closePlayer, openPanel, closePanel,
    skeletons, skeletonsGrid, renderTracks, renderAlbums, renderArtists,
    showPage, setProviderStatus, emptyState,
  };
})();
