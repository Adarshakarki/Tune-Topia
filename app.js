const App = (() => {
  let currentId = null;
  let currentSearchTab = 'music';
  let lastQuery = '';
  let searchTimer;

  const GENRES = [
    { label:'🔥 Trending', q:'trending music 2025' },
    { label:'New',         q:'new music releases 2025' },
    { label:'Lo-Fi',       q:'lo-fi hip hop chill' },
    { label:'Pop',         q:'pop hits 2025' },
    { label:'Hip-Hop',     q:'hip hop rap 2025' },
    { label:'R&B',         q:'rnb soul 2025' },
    { label:'Indie',       q:'indie alternative 2025' },
    { label:'EDM',         q:'electronic dance 2025' },
    { label:'Jazz',        q:'jazz chill' },
    { label:'K-Pop',       q:'kpop 2025' },
    { label:'Metal',       q:'metal rock 2025' },
    { label:'Classical',   q:'classical piano' },
  ];

  // genre chips
  function buildGenreChips() {
    const wrap = $('genre-chips');
    if (!wrap) return;
    wrap.innerHTML = GENRES.map((g,i) => `
      <div class="chip ${i===0?'active':''}" data-idx="${i}">${escHtml(g.label)}</div>
    `).join('');
    wrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', function() {
        wrap.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
        this.classList.add('active');
        loadHome(GENRES[parseInt(this.dataset.idx)].q);
      });
    });
  }

  // home
  async function loadHome(q=GENRES[0].q) {
    const el = $('home-tracks');
    if (!el) return;
    el.innerHTML = UI.skeletons();
    try {
      const tracks = await search(q);
      // update hero with first track
      if (tracks.length) updateHero(tracks[0]);
      UI.renderTracks(tracks, el, currentId);
    } catch (e) {
      el.innerHTML = UI.emptyState('Failed to load', e.message);
    }
  }

  function updateHero(track) {
    const bg     = $('home-hero-bg');
    const title  = $('home-hero-title');
    const artist = $('home-hero-artist');
    if (!bg) return;
    if (track.cover) {
      bg.style.backgroundImage = `url('${escHtml(track.cover)}')`;
      bg.classList.add('has-image');
    }
    if (title)  title.textContent  = track.title || 'TuneTopia';
    if (artist) artist.textContent = track.artist || '';
    // click hero to play
    const hero = $('home-hero');
    if (hero) {
      hero.onclick = () => App.onTrackClick([track], 0);
    }
  }

  // search
  function initSearch() {
    const input = $('search-input');
    const clear = $('search-clear');
    if (!input) return;
    input.addEventListener('input', () => {
      lastQuery = input.value.trim();
      clear.style.display = lastQuery ? 'flex' : 'none';
      clearTimeout(searchTimer);
      if (!lastQuery) { showSearchEmpty(); return; }
      $('search-results').innerHTML = UI.skeletons();
      showSearchResults();
      searchTimer = setTimeout(() => runSearch(lastQuery, currentSearchTab), 380);
    });
    clear.addEventListener('click', () => {
      input.value=''; clear.style.display='none';
      lastQuery=''; showSearchEmpty();
    });
    document.querySelectorAll('.ios-seg-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.ios-seg-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        currentSearchTab = this.dataset.tab;
        if (lastQuery) runSearch(lastQuery, currentSearchTab);
      });
    });
    document.querySelectorAll('.ios-cat-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        input.value = tile.textContent.trim();
        clear.style.display='flex'; lastQuery=input.value.trim();
        $('search-results').innerHTML = UI.skeletons();
        showSearchResults(); runSearch(lastQuery,'music');
      });
    });
  }

  function showSearchEmpty() {
    $('search-empty-state').style.display='';
    $('search-results').style.display='none';
  }
  function showSearchResults() {
    $('search-empty-state').style.display='none';
    $('search-results').style.display='';
  }

  async function runSearch(q, tab) {
    const el = $('search-results');
    el.innerHTML = tab==='albums' ? UI.skeletonsGrid() : UI.skeletons();
    try {
      if (tab==='music') {
        let t=[]; try{t=await hifiSearch(q);}catch{}
        if (!t.length) t = await ivSearch(q);
        UI.renderTracks(t, el, currentId);
      } else if (tab==='video') {
        UI.renderTracks(await ivSearch(q), el, currentId);
      } else if (tab==='albums') {
        UI.renderAlbums(await hifiSearchAlbums(q), el);
      } else if (tab==='artists') {
        UI.renderArtists(await hifiSearchArtist(q), el);
      } else if (tab==='playlists') {
        UI.renderAlbums(await hifiSearchAlbums(q), el);
      }
    } catch(e) {
      el.innerHTML = UI.emptyState('Search failed', e.message);
    }
  }

  // artist drill-down
  function searchArtistTracks(name) {
    showPage('search');
    const input = $('search-input');
    if (input) { input.value=name; $('search-clear').style.display='flex'; }
    lastQuery=name;
    document.querySelectorAll('.ios-seg-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('.ios-seg-btn[data-tab="music"]')?.classList.add('active');
    currentSearchTab='music';
    $('search-results').innerHTML=UI.skeletons();
    showSearchResults(); runSearch(name,'music');
  }

  // library
  function renderLibrary() {
    const hist = Player.loadHistory();
    const el   = $('library-tracks');
    if (!el) return;
    if (!hist.length) {
      el.innerHTML=`<div class="empty">
        <svg width="52" height="52" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <p>Nothing here yet</p>
        <small>Songs you play will appear here</small>
      </div>`;
      return;
    }
    UI.renderTracks(hist, el, currentId);
  }

  // track interactions
  function onTrackClick(tracks, idx) {
    currentId = tracks[idx].id;
    Player.play(tracks[idx], tracks, idx);
    refreshActiveCards();
  }
  function playNext(tracks, idx) {
    const s = Player.getState();
    if (!s.queue.length) return;
    s.queue.splice(s.qIdx+1, 0, tracks[idx]);
  }
  function removeTrack(container, idx) {
    if (!container._tracks) return;
    container._tracks.splice(idx,1);
    UI.renderTracks(container._tracks, container, currentId);
  }
  function showTrackMenu(track) { UI.toast(`♡ ${track.title}`); }
  function refreshActiveCards() {
    document.querySelectorAll('.track-card-wrap').forEach(wrap => {
      const idx   = parseInt(wrap.dataset.index);
      const cont  = wrap.parentElement;
      const track = cont._tracks?.[idx];
      const card  = wrap.querySelector('.track-card');
      const name  = wrap.querySelector('.track-name');
      if (!card) return;
      card.classList.toggle('playing', track?.id===currentId);
      name?.classList.toggle('playing', track?.id===currentId);
    });
  }

  // page nav
  function showPage(name) {
    UI.showPage(name);
    if (name==='library') renderLibrary();
    if (name==='search') setTimeout(()=>$('search-input')?.focus(),100);
  }

  // player controls
  function initPlayerControls() {
    // np progress bar click
    $('np-progress-bar').addEventListener('click', e => {
      const r=$('np-progress-bar').getBoundingClientRect();
      Player.seek(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
    });
    // volume
    $('vol-bar').addEventListener('click', e => {
      const r=$('vol-bar').getBoundingClientRect();
      Player.setVolume(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
    });
    // swipe down to close
    let ty0=0;
    $('np-content').addEventListener('touchstart', e=>{ ty0=e.touches[0].clientY; },{passive:true});
    $('np-content').addEventListener('touchmove', e=>{
      if (e.touches[0].clientY-ty0>90) UI.closePlayer();
    },{passive:true});
    // panel progress bars
    ['np-lyrics-mini-bar','np-queue-mini-bar'].forEach(id => {
      $(id)?.addEventListener('click', e => {
        const r=$(id).getBoundingClientRect();
        Player.seek(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
      });
    });
  }

  function initProviderStatus() {
    const names = Object.values(PROVIDERS).map(p=>p.label).join(' · ');
    UI.setProviderStatus(`${ALL_HIFI_BASES.length} providers · ${names}`);
  }

  // init
  function init() {
    buildGenreChips();
    loadHome();
    initSearch();
    renderLibrary();
    initPlayerControls();
    initProviderStatus();
    showSearchEmpty();

    // nav bar
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', ()=>showPage(btn.dataset.page));
    });

    // mini player
    $('mini-player-inner').addEventListener('click', ()=>UI.openPlayer());
    $('mini-play-btn').addEventListener('click', e=>{ e.stopPropagation(); Player.toggle(); });
    $('mini-next-btn').addEventListener('click', e=>{ e.stopPropagation(); Player.next(); });
    $('mini-prev-btn').addEventListener('click', e=>{ e.stopPropagation(); Player.prev(); });

    // now playing main controls
    $('np-close-btn').addEventListener('click', ()=>UI.closePlayer());
    $('np-play-btn').addEventListener('click',  ()=>Player.toggle());
    $('np-prev-btn').addEventListener('click',  ()=>Player.prev());
    $('np-next-btn').addEventListener('click',  ()=>Player.next());
    $('shuffle-btn').addEventListener('click',  ()=>Player.toggleShuffle());
    $('repeat-btn').addEventListener('click',   ()=>Player.toggleRepeat());
    $('np-love-btn').addEventListener('click',  function(){ this.classList.toggle('active'); });

    // more options button
    $('np-more-btn').addEventListener('click', ()=>{
      const t = Player.getCurrentTrack();
      if (!t) return;
      const url = t.source==='youtube' ? `https://youtu.be/${t.id}` : `https://tidal.com/track/${t.id}`;
      if (navigator.share) navigator.share({ title:`${t.title} — ${t.artist}`, url });
      else navigator.clipboard.writeText(url).then(()=>UI.toast('Link copied'));
    });

    // lyrics panel
    $('np-lyrics-btn').addEventListener('click',   ()=>UI.openPanel('np-lyrics-panel'));
    $('np-lyrics-back').addEventListener('click',  ()=>UI.closePanel('np-lyrics-panel'));
    $('np-lyrics-play').addEventListener('click',  ()=>Player.toggle());
    $('np-lyrics-prev').addEventListener('click',  ()=>Player.prev());
    $('np-lyrics-next').addEventListener('click',  ()=>Player.next());

    // queue panel
    $('np-queue-toggle-btn').addEventListener('click', ()=>UI.openPanel('np-queue-panel'));
    $('np-queue-back').addEventListener('click',       ()=>UI.closePanel('np-queue-panel'));
    $('np-queue-play').addEventListener('click',       ()=>Player.toggle());
    $('np-queue-prev').addEventListener('click',       ()=>Player.prev());
    $('np-queue-next').addEventListener('click',       ()=>Player.next());

    // library items
    $('lib-liked')?.addEventListener('click',   ()=>{ showPage('library'); });
    $('lib-albums')?.addEventListener('click',  ()=>{ showPage('search'); });
    $('lib-artists')?.addEventListener('click', ()=>{ showPage('search'); });
    $('lib-songs')?.addEventListener('click',   ()=>{ showPage('library'); });
    $('lib-history')?.addEventListener('click', ()=>{ showPage('library'); });
    $('home-search-btn')?.addEventListener('click', ()=>showPage('search'));
  }

  return { init, onTrackClick, playNext, removeTrack, showTrackMenu, showPage, searchArtistTracks };
})();

document.addEventListener('DOMContentLoaded', ()=>App.init());


// ── DESKTOP APP ──

const DesktopApp = (() => {
  let currentDtPage = 'home';
  let currentDtTab  = 'music';
  let currentDtId   = null;
  let dtTimer;
  let dtLastQuery   = '';

  const GENRES = [
    { label:'Trending',  q:'trending music 2025' },
    { label:'New',       q:'new music releases 2025' },
    { label:'Lo-Fi',     q:'lo-fi hip hop chill' },
    { label:'Pop',       q:'pop hits 2025' },
    { label:'Hip-Hop',   q:'hip hop rap 2025' },
    { label:'R&B',       q:'rnb soul 2025' },
    { label:'Indie',     q:'indie alternative 2025' },
    { label:'EDM',       q:'electronic dance 2025' },
    { label:'Jazz',      q:'jazz chill' },
    { label:'K-Pop',     q:'kpop 2025' },
    { label:'Metal',     q:'metal rock 2025' },
    { label:'Classical', q:'classical piano' },
  ];

  function showDtPage(name) {
    document.querySelectorAll('.dt-page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
    const page = document.getElementById('dt-page-'+name);
    const item = document.querySelector(`.sb-item[data-dtpage="${name}"]`);
    if (page) page.classList.add('active');
    if (item) item.classList.add('active');
    currentDtPage = name;
    if (name==='home')           loadDtHome();
    if (name==='albums')         loadDtAlbums();
    if (name==='songs')          loadDtSongs();
    if (name==='artists')        loadDtArtists();
    if (name==='recently-added') loadDtRecentlyAdded();
    if (name==='history')        loadDtHistory();
    if (name==='new')            loadDtNew();
  }

  function buildDtGenreChips() {
    const wrap = document.getElementById('dt-genre-chips');
    if (!wrap) return;
    wrap.innerHTML = GENRES.map((g,i)=>`
      <div class="chip ${i===0?'active':''}" data-idx="${i}" style="font-size:12px;padding:4px 12px;flex-shrink:0">${escHtml(g.label)}</div>
    `).join('');
    wrap.querySelectorAll('.chip').forEach(chip=>{
      chip.addEventListener('click', function(){
        wrap.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
        this.classList.add('active');
        loadDtHome(GENRES[parseInt(this.dataset.idx)].q);
      });
    });
  }

  async function loadDtHome(q=GENRES[0].q) {
    const grid=document.getElementById('dt-home-grid');
    grid.innerHTML=dtSkeletonGrid();
    try {
      const tracks=await search(q);
      renderDtAlbumGrid(tracks,grid,'tracks');
    } catch(e){ grid.innerHTML=dtEmpty('Failed to load',e.message); }
  }
  async function loadDtNew() {
    const grid=document.getElementById('dt-new-grid');
    grid.innerHTML=dtSkeletonGrid();
    try { renderDtAlbumGrid(await search('new music releases 2025'),grid,'tracks'); }
    catch(e){ grid.innerHTML=dtEmpty('Failed',e.message); }
  }
  async function loadDtAlbums() {
    const grid=document.getElementById('dt-albums-grid');
    grid.innerHTML=dtSkeletonGrid();
    try { renderDtAlbumGrid(await hifiSearchAlbums('popular albums 2025'),grid,'albums'); }
    catch { try { renderDtAlbumGrid(await search('popular albums 2025'),grid,'tracks'); } catch(e){ grid.innerHTML=dtEmpty('Failed',e.message); } }
  }
  async function loadDtSongs() {
    const el=document.getElementById('dt-songs-list');
    el.innerHTML=Array(12).fill(0).map(()=>`<div class="dt-skel-row" style="margin-bottom:2px"></div>`).join('');
    try {
      let t=[]; try{t=await hifiSearch('popular songs 2025');}catch{}
      if (!t.length) t=await ivSearch('popular songs 2025');
      renderDtTrackList(t,el);
    } catch(e){ el.innerHTML=dtEmpty('Failed',e.message); }
  }
  async function loadDtArtists() {
    const grid=document.getElementById('dt-artists-grid');
    grid.innerHTML=dtSkeletonGrid(8,'circle');
    try { renderDtArtistGrid(await hifiSearchArtist('popular artists 2025'),grid); }
    catch(e){ grid.innerHTML=dtEmpty('Failed',e.message); }
  }
  function loadDtRecentlyAdded() {
    const grid=document.getElementById('dt-recent-grid');
    const hist=Player.loadHistory();
    if (!hist.length){ grid.innerHTML=dtEmpty('Nothing here yet','Play some tracks first'); return; }
    renderDtAlbumGrid(hist,grid,'tracks');
  }
  function loadDtHistory() {
    const el=document.getElementById('dt-history-list');
    const hist=Player.loadHistory();
    if (!hist.length){ el.innerHTML=dtEmpty('No history yet'); return; }
    renderDtTrackList(hist,el);
  }

  function renderDtAlbumGrid(items,container,mode) {
    if (!items.length){ container.innerHTML=dtEmpty('No results'); return; }
    container.className='dt-album-grid';
    container.innerHTML=items.map((item,i)=>`
      <div class="dt-album-card" data-index="${i}">
        <img class="dt-album-art" src="${escHtml(item.cover||item.coverSmall||'')}" onerror="this.src=''" alt=""/>
        <div class="dt-album-title">${escHtml(item.title||item.name||'—')}</div>
        <div class="dt-album-artist">${escHtml(item.artist||'')}</div>
      </div>
    `).join('');
    container._items=items;
    container.querySelectorAll('.dt-album-card').forEach(card=>{
      card.addEventListener('click',()=>{
        const item=items[parseInt(card.dataset.index)];
        if (item.source||item.quality){ currentDtId=item.id; Player.play(item,items,parseInt(card.dataset.index)); updateDtTopbar(); refreshDtRows(); }
        else UI.toast(`Album: ${item.title}`);
      });
    });
  }

  function renderDtTrackList(tracks,container) {
    if (!tracks.length){ container.innerHTML=dtEmpty('No tracks'); return; }
    container.className='dt-track-list';
    container.innerHTML=tracks.map((t,i)=>{
      const badge=qualityBadge(t);
      const act=t.id===currentDtId;
      return `
        <div class="dt-track-row ${act?'playing':''}" data-index="${i}">
          <div class="dt-track-num">
            ${act?`<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`:`<span>${i+1}</span>`}
          </div>
          <div class="dt-track-main">
            <img class="dt-track-thumb" src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
            <div class="dt-track-info">
              <div class="dt-track-name">${escHtml(t.title)}</div>
              <div class="dt-track-sub">${escHtml(t.artist||'')}</div>
            </div>
          </div>
          <div class="dt-track-album">${escHtml(t.album||'')}</div>
          <div class="dt-track-badge">${badge?`<span class="quality-badge ${badge.cls}">${badge.label}</span>`:''}</div>
          <div class="dt-track-dur">${t.dur||''}</div>
        </div>
      `;
    }).join('');
    container._tracks=tracks;
    container.querySelectorAll('.dt-track-row').forEach(row=>{
      row.addEventListener('click',()=>{
        const i=parseInt(row.dataset.index);
        currentDtId=tracks[i].id;
        Player.play(tracks[i],tracks,i);
        updateDtTopbar(); refreshDtRows();
      });
    });
  }

  function renderDtArtistGrid(artists,container) {
    if (!artists.length){ container.innerHTML=dtEmpty('No artists'); return; }
    container.className='dt-artist-grid';
    container.innerHTML=artists.map((a,i)=>`
      <div class="dt-artist-card" data-index="${i}">
        <img class="dt-artist-avatar" src="${escHtml(a.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="dt-artist-name">${escHtml(a.name)}</div>
        <div class="dt-artist-label">Artist</div>
      </div>
    `).join('');
    container.querySelectorAll('.dt-artist-card').forEach(card=>{
      card.addEventListener('click',()=>{ const a=artists[parseInt(card.dataset.index)]; dtSearchQuery(a.name,'music'); showDtPage('search'); });
    });
  }

  function initDtSearch() {
    const input=document.getElementById('dt-search-input');
    if (!input) return;
    input.addEventListener('input',()=>{
      dtLastQuery=input.value.trim();
      clearTimeout(dtTimer);
      if (!dtLastQuery){ document.getElementById('dt-search-results').innerHTML=dtEmpty('Search for anything'); return; }
      document.getElementById('dt-search-results').innerHTML=Array(8).fill(0).map(()=>`<div class="dt-skel-row" style="margin-bottom:2px;border-radius:6px"></div>`).join('');
      dtTimer=setTimeout(()=>dtSearchQuery(dtLastQuery,currentDtTab),380);
      showDtPage('search');
    });
    document.querySelectorAll('.dt-search-tab').forEach(tab=>{
      tab.addEventListener('click',function(){
        document.querySelectorAll('.dt-search-tab').forEach(t=>t.classList.remove('active'));
        this.classList.add('active');
        currentDtTab=this.dataset.dttab;
        if (dtLastQuery) dtSearchQuery(dtLastQuery,currentDtTab);
      });
    });
  }

  async function dtSearchQuery(q,tab='music') {
    const el=document.getElementById('dt-search-results');
    if (!el) return;
    el.innerHTML=(tab==='albums')?dtSkeletonGrid():Array(10).fill(0).map(()=>`<div class="dt-skel-row" style="margin-bottom:2px;border-radius:6px"></div>`).join('');
    try {
      if (tab==='music'){ let t=[]; try{t=await hifiSearch(q);}catch{} if(!t.length)t=await ivSearch(q); renderDtTrackList(t,el); }
      else if(tab==='video'){ renderDtTrackList(await ivSearch(q),el); }
      else if(tab==='albums'){ renderDtAlbumGrid(await hifiSearchAlbums(q),el,'albums'); }
      else if(tab==='artists'){ renderDtArtistGrid(await hifiSearchArtist(q),el); }
    } catch(e){ el.innerHTML=dtEmpty('Search failed',e.message); }
  }

  function updateDtTopbar() {
    const t=Player.getCurrentTrack();
    if (!t) return;
    const ta=document.getElementById('tb-art');
    const tt=document.getElementById('tb-title');
    const ta2=document.getElementById('tb-artist');
    if (ta) ta.src=t.coverSmall||t.cover||'';
    if (tt) tt.textContent=t.title||'—';
    if (ta2) ta2.textContent=t.artist||'—';
  }

  function syncDtProgress(pct,cur,dur) {
    const f=document.getElementById('tb-progress-fill');
    const c=document.getElementById('tb-time-cur');
    const d=document.getElementById('tb-time-tot');
    if (f) f.style.width=pct+'%';
    if (c) c.textContent=fmtTime(cur);
    if (d) d.textContent=fmtTime(dur);
  }

  function setDtPlayState(playing) {
    const icon=document.getElementById('dt-play-icon');
    if (!icon) return;
    const pause=`<line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>`;
    const play=`<polygon points="5 3 19 12 5 21 5 3"/>`;
    icon.innerHTML=playing?pause:play;
  }

  function refreshDtRows() {
    document.querySelectorAll('.dt-track-row').forEach(row=>{
      const i=parseInt(row.dataset.index);
      const c=row.closest('.dt-track-list');
      const t=c?._tracks?.[i];
      const a=t?.id===currentDtId;
      row.classList.toggle('playing',a);
      const num=row.querySelector('.dt-track-num');
      if (num) num.innerHTML=a?`<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`:`<span>${i+1}</span>`;
    });
  }

  function dtSkeletonGrid(n=10,shape='square') {
    return `<div class="dt-skel-grid">${Array(n).fill(0).map(()=>`
      <div>
        <div class="dt-skel-art" style="${shape==='circle'?'border-radius:50%':''}"></div>
        <div class="dt-skel-line" style="width:85%"></div>
        <div class="dt-skel-line-sm"></div>
      </div>
    `).join('')}</div>`;
  }

  function dtEmpty(msg,sub='') {
    return `<div class="dt-empty">
      <svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <h3>${escHtml(msg)}</h3>${sub?`<p>${escHtml(sub)}</p>`:''}
    </div>`;
  }

  function initDtTopbarControls() {
    const audio=document.getElementById('audio');
    document.getElementById('dt-play-btn')?.addEventListener('click',  ()=>Player.toggle());
    document.getElementById('dt-prev-btn')?.addEventListener('click',  ()=>Player.prev());
    document.getElementById('dt-next-btn')?.addEventListener('click',  ()=>Player.next());
    document.getElementById('dt-shuffle-btn')?.addEventListener('click',()=>Player.toggleShuffle());
    document.getElementById('dt-repeat-btn')?.addEventListener('click', ()=>Player.toggleRepeat());
    document.getElementById('tb-progress-bar')?.addEventListener('click',e=>{
      const r=document.getElementById('tb-progress-bar').getBoundingClientRect();
      Player.seek(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
    });
    document.getElementById('tb-vol-bar')?.addEventListener('click',e=>{
      const r=document.getElementById('tb-vol-bar').getBoundingClientRect();
      Player.setVolume(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
      document.getElementById('tb-vol-fill').style.width=(audio.volume*100)+'%';
    });
    audio.addEventListener('timeupdate',()=>{
      if (!audio.duration) return;
      syncDtProgress((audio.currentTime/audio.duration)*100,audio.currentTime,audio.duration);
    });
    audio.addEventListener('play',()=>{ setDtPlayState(true); updateDtTopbar(); });
    audio.addEventListener('pause',()=>setDtPlayState(false));
  }

  function initDtSidebar() {
    document.querySelectorAll('.sb-item').forEach(item=>{
      item.addEventListener('click',function(){ showDtPage(this.dataset.dtpage); });
    });
  }

  function handleResize() {
    const isDesktop=window.matchMedia('(min-width: 900px)').matches;
    document.getElementById('app').style.display=isDesktop?'none':'';
    document.getElementById('desktop-shell').style.display=isDesktop?'flex':'none';
  }

  function init() {
    handleResize();
    window.addEventListener('resize',handleResize);
    buildDtGenreChips();
    initDtSidebar();
    initDtSearch();
    initDtTopbarControls();
    if (window.matchMedia('(min-width: 900px)').matches) loadDtHome();
  }

  return { init, updateDtTopbar, syncDtProgress, setDtPlayState, refreshDtRows };
})();

document.addEventListener('DOMContentLoaded', ()=>DesktopApp.init());
