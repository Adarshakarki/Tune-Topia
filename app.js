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

/* LIKED SONGS */
const LikedSongs = (() => {
  const KEY = 'tt_liked';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; } }
  function save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }
  function has(id) { return load().some(t=>t.id===String(id)); }
  function toggle(track) {
    let arr = load();
    const exists = arr.findIndex(t=>t.id===String(track.id));
    if (exists>=0) arr.splice(exists,1); else arr.unshift({...track,id:String(track.id)});
    save(arr);
    return exists<0; // true = now liked
  }
  function getAll() { return load(); }
  function count()  { return load().length; }
  return { has, toggle, getAll, count };
})();

/* MOBILE APP */
const App = (() => {
  let currentId = null;
  let currentSearchTab = 'music';
  let lastQuery = '';
  let searchTimer;
  let likedSortMode = 'recent'; // 'recent' | 'az'

  /* ── greeting ── */
  function setGreeting() {
    const h = new Date().getHours();
    const g = h<12 ? 'Good morning' : h<18 ? 'Good afternoon' : 'Good evening';
    const el = $('home-greeting'); if(el) el.textContent = g;
  }

  /* ── genre chips ── */
  function buildGenreChips() {
    const wrap = $('genre-chips'); if (!wrap) return;
    wrap.innerHTML = GENRES.map((g,i)=>`
      <div class="chip ${i===0?'active':''}" data-idx="${i}">${escHtml(g.label)}</div>`).join('');
    wrap.querySelectorAll('.chip').forEach(chip=>{
      chip.addEventListener('click', function(){
        wrap.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
        this.classList.add('active');
        loadHome(GENRES[parseInt(this.dataset.idx)].q);
      });
    });
  }

  /* ── home ── */
  async function loadHome(q=GENRES[0].q) {
    const el = $('home-tracks'); if (!el) return;
    el.innerHTML = UI.skeletons();
    const newRow = $('home-new-row');
    if (newRow) newRow.innerHTML = '';
    try {
      const tracks = await search(q);
      // What's New horizontal scroll
      if (newRow) UI.renderHorizCards(tracks, newRow);
      // Recently played
      const hist = Player.loadHistory();
      const recentSection = $('home-recent-section');
      const recentRow = $('home-recent-row');
      if (hist.length && recentSection && recentRow) {
        recentSection.style.display='';
        UI.renderHorizCards(hist, recentRow);
      }
      // Track list
      UI.renderTracks(tracks, el, currentId);
    } catch(e) {
      el.innerHTML = UI.emptyState('Failed to load', e.message);
    }
  }

  /* ── search ── */
  function initSearch() {
    const input  = $('search-input');
    const clear  = $('search-clear');
    const segWrap = $('search-seg-wrap');
    if (!input) return;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q === lastQuery) return;
      lastQuery = q;
      clear.style.display = q ? 'flex' : 'none';
      clearTimeout(searchTimer);
      if (!q) { showSearchEmpty(); return; }
      if (segWrap) segWrap.style.display='';
      $('search-results').innerHTML = UI.skeletons();
      showSearchResults();
      searchTimer = setTimeout(() => runSearch(q, currentSearchTab), 380);
    });
    clear.addEventListener('click', () => {
      input.value=''; clear.style.display='none';
      lastQuery=''; showSearchEmpty();
      if (segWrap) segWrap.style.display='none';
    });
    document.querySelectorAll('.ios-seg-btn').forEach(btn=>{
      btn.addEventListener('click', function(){
        document.querySelectorAll('.ios-seg-btn').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        currentSearchTab = this.dataset.tab;
        if (lastQuery) runSearch(lastQuery, currentSearchTab);
      });
    });
    // Mood tiles
    document.querySelectorAll('.ios-mood-tile').forEach(tile=>{
      tile.addEventListener('click', ()=>{
        const q = tile.dataset.q;
        input.value = tile.textContent.trim();
        clear.style.display='flex';
        lastQuery = q;
        if (segWrap) segWrap.style.display='';
        $('search-results').innerHTML = UI.skeletons();
        showSearchResults();
        runSearch(q, 'music');
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

  /* ── artist drill-down ── */
  function searchArtistTracks(name) {
    showPage('search');
    const input = $('search-input');
    if (input) { input.value=name; $('search-clear').style.display='flex'; }
    lastQuery=name;
    const segWrap = $('search-seg-wrap');
    if (segWrap) segWrap.style.display='';
    document.querySelectorAll('.ios-seg-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('.ios-seg-btn[data-tab="music"]')?.classList.add('active');
    currentSearchTab='music';
    $('search-results').innerHTML=UI.skeletons();
    showSearchResults(); runSearch(name,'music');
  }

  /* ── library ── */
  function renderLibrary() {
    // Recently played horizontal scroll
    const hist = Player.loadHistory();
    const recentRow = $('lib-recent-row');
    const recentSec = $('lib-recent-section');
    if (recentRow && hist.length) {
      UI.renderHorizCards(hist, recentRow);
      if (recentSec) recentSec.style.display='';
    }
    // Liked count label
    updateLikedCountLabel();
  }

  function updateLikedCountLabel() {
    const n = LikedSongs.count();
    const el = $('liked-count-label'); if(el) el.textContent = `${n} song${n!==1?'s':''}`;
    const el2 = $('liked-hero-sub'); if(el2) el2.textContent = `${n} song${n!==1?'s':''}`;
  }

  /* ── liked songs page ── */
  function renderLikedPage() {
    updateLikedCountLabel();
    let songs = LikedSongs.getAll();
    if (likedSortMode === 'az') songs = [...songs].sort((a,b)=>a.title.localeCompare(b.title));
    const el = $('liked-tracks'); if (!el) return;
    if (!songs.length) {
      el.innerHTML = `<div class="empty"><i data-lucide="heart" style="width:52px;height:52px"></i><p>No liked songs yet</p><small>Heart songs to save them here</small></div>`;
      lucide.createIcons({nodes:Array.from(el.querySelectorAll('i[data-lucide]'))});
      return;
    }
    // filter by search input
    const filterInput = $('liked-filter-input');
    const q = filterInput ? filterInput.value.trim().toLowerCase() : '';
    const filtered = q ? songs.filter(t=>t.title.toLowerCase().includes(q)||t.artist.toLowerCase().includes(q)) : songs;
    UI.renderTracks(filtered, el, currentId);
  }

  /* ── toggle like ── */
  function toggleLike(btn, idx) {
    const cont = btn.closest('[class]');
    const tracks = cont?.parentElement?._tracks || cont?._tracks;
    const track = tracks ? tracks[idx] : Player.getCurrentTrack();
    if (!track) return;
    const nowLiked = LikedSongs.toggle(track);
    btn.classList.toggle('liked', nowLiked);
    const icon = btn.querySelector('i');
    if (icon) { icon.style.fill = nowLiked ? 'var(--purple)' : ''; }
    UI.syncLikeButtons(track.id);
    updateLikedCountLabel();
    if (nowLiked) UI.toast(`♥ Liked "${track.title}"`);
    else          UI.toast(`Removed from Liked Songs`);
  }

  /* ── track interactions ── */
  function onTrackClick(tracks, idx) {
    currentId = tracks[idx].id;
    Player.play(tracks[idx], tracks, idx);
    refreshActiveCards();
  }
  function playNext(tracks, idx) {
    const s = Player.getState();
    if (!s.queue.length) { Player.play(tracks[idx], [tracks[idx]], 0); return; }
    s.queue.splice(s.qIdx+1, 0, tracks[idx]);
  }
  function removeTrack(container, idx) {
    if (!container._tracks) return;
    container._tracks.splice(idx,1);
    UI.renderTracks(container._tracks, container, currentId);
  }
  function refreshActiveCards() {
    document.querySelectorAll('.track-card-wrap').forEach(wrap=>{
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

  /* ── page nav ── */
  function showPage(name) {
    if (name==='liked') {
      // sub-page: keep library tab active visually
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      const p = $('page-liked'); if(p) p.classList.add('active');
      renderLikedPage();
      return;
    }
    UI.showPage(name);
    if (name==='library') renderLibrary();
    if (name==='search')  setTimeout(()=>$('search-input')?.focus(),100);
  }

  /* ── player controls ── */
  function initPlayerControls() {
    // progress scrub
    $('np-progress-bar').addEventListener('click', e=>{
      const r=$('np-progress-bar').getBoundingClientRect();
      Player.seek(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
    });
    // volume
    $('vol-bar').addEventListener('click', e=>{
      const r=$('vol-bar').getBoundingClientRect();
      Player.setVolume(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
    });
    // swipe down to close NP
    let ty0=0;
    $('np-content').addEventListener('touchstart', e=>{ ty0=e.touches[0].clientY; },{passive:true});
    $('np-content').addEventListener('touchmove', e=>{
      if (e.touches[0].clientY-ty0>90) UI.closePlayer();
    },{passive:true});
    // panel progress bars
    ['np-lyrics-mini-bar','np-queue-mini-bar'].forEach(id=>{
      $(id)?.addEventListener('click', e=>{
        const r=$(id).getBoundingClientRect();
        Player.seek(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
      });
    });
  }

  /* ── provider status ── */
  function initProviderStatus() {
    const names = Object.values(PROVIDERS).map(p=>p.label).join(' · ');
    const el = $('provider-label');
    if (el) el.textContent = `${ALL_HIFI_BASES.length} providers · ${names}`;
  }

  /* ── init ── */
  function init() {
    setGreeting();
    buildGenreChips();
    loadHome();
    initSearch();
    renderLibrary();
    initPlayerControls();
    initProviderStatus();
    showSearchEmpty();

    // Nav bar
    document.querySelectorAll('.nav-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>showPage(btn.dataset.page));
    });

    // Mini player
    $('mini-player-inner').addEventListener('click', ()=>UI.openPlayer());
    $('mini-play-btn').addEventListener('click',  e=>{ e.stopPropagation(); Player.toggle(); });
    $('mini-next-btn').addEventListener('click',  e=>{ e.stopPropagation(); Player.next(); });
    $('mini-prev-btn').addEventListener('click',  e=>{ e.stopPropagation(); Player.prev(); });

    // NP controls
    $('np-close-btn').addEventListener('click',  ()=>UI.closePlayer());
    $('np-play-btn').addEventListener('click',   ()=>Player.toggle());
    $('np-prev-btn').addEventListener('click',   ()=>Player.prev());
    $('np-next-btn').addEventListener('click',   ()=>Player.next());
    $('shuffle-btn').addEventListener('click',   ()=>Player.toggleShuffle());
    $('repeat-btn').addEventListener('click',    ()=>Player.toggleRepeat());

    // Love btn
    $('np-love-btn').addEventListener('click', function(){
      const track = Player.getCurrentTrack(); if (!track) return;
      const nowLiked = LikedSongs.toggle(track);
      this.classList.toggle('active', nowLiked);
      UI.syncLikeButtons(track.id);
      updateLikedCountLabel();
      UI.toast(nowLiked ? `♥ Liked "${track.title}"` : 'Removed from Liked Songs');
    });

    // More options
    $('np-more-btn').addEventListener('click', ()=>{
      const t = Player.getCurrentTrack(); if (!t) return;
      UI.openMoreSheet(t);
    });
    $('np-more-sheet-overlay')?.addEventListener('click', ()=>UI.closeMoreSheet());
    $('sheet-add-queue')?.addEventListener('click', ()=>{
      const t = Player.getCurrentTrack(); if (!t) return;
      playNext([t], 0); UI.toast('Added to queue'); UI.closeMoreSheet();
    });
    $('sheet-share')?.addEventListener('click', ()=>{
      const t = Player.getCurrentTrack(); if (!t) return;
      const url = t.source==='youtube' ? `https://youtu.be/${t.id}` : `https://tidal.com/track/${t.id}`;
      if (navigator.share) navigator.share({title:`${t.title} — ${t.artist}`, url});
      else navigator.clipboard.writeText(url).then(()=>UI.toast('Link copied'));
      UI.closeMoreSheet();
    });
    $('sheet-open-source')?.addEventListener('click', ()=>{
      const t = Player.getCurrentTrack(); if (!t) return;
      const url = t.source==='youtube' ? `https://youtu.be/${t.id}` : `https://tidal.com/track/${t.id}`;
      window.open(url, '_blank'); UI.closeMoreSheet();
    });

    // Lyrics panel
    $('np-lyrics-btn').addEventListener('click',  ()=>UI.openPanel('np-lyrics-panel'));
    $('np-lyrics-back').addEventListener('click', ()=>UI.closePanel('np-lyrics-panel'));
    $('np-lyrics-play').addEventListener('click', ()=>Player.toggle());
    $('np-lyrics-prev').addEventListener('click', ()=>Player.prev());
    $('np-lyrics-next').addEventListener('click', ()=>Player.next());
    $('np-lyrics-love-btn')?.addEventListener('click', ()=>$('np-love-btn').click());

    // Queue panel
    $('np-queue-toggle-btn').addEventListener('click', ()=>UI.openPanel('np-queue-panel'));
    $('np-queue-back').addEventListener('click',       ()=>UI.closePanel('np-queue-panel'));
    $('np-queue-play').addEventListener('click',       ()=>Player.toggle());
    $('np-queue-prev').addEventListener('click',       ()=>Player.prev());
    $('np-queue-next').addEventListener('click',       ()=>Player.next());
    $('np-queue-love-btn')?.addEventListener('click',  ()=>$('np-love-btn').click());

    // Library items
    $('lib-liked')?.addEventListener('click',   ()=>showPage('liked'));
    $('lib-albums')?.addEventListener('click',  ()=>showPage('search'));
    $('lib-artists')?.addEventListener('click', ()=>showPage('search'));
    $('lib-history')?.addEventListener('click', ()=>showPage('library'));

    // Liked back
    $('liked-back-btn')?.addEventListener('click', ()=>showPage('library'));

    // Liked play all
    $('liked-play-all')?.addEventListener('click', ()=>{
      const songs = LikedSongs.getAll();
      if (!songs.length) { UI.toast('No liked songs yet'); return; }
      onTrackClick(songs, 0);
    });

    // Liked filter
    $('liked-filter-input')?.addEventListener('input', ()=>renderLikedPage());

    // Liked sort
    $('liked-sort-btn')?.addEventListener('click', ()=>{
      likedSortMode = likedSortMode==='recent' ? 'az' : 'recent';
      const lb = $('liked-sort-label'); if(lb) lb.textContent = likedSortMode==='az'?'A–Z':'Recent';
      renderLikedPage();
    });

    // Home search btn
    $('home-search-btn')?.addEventListener('click', ()=>showPage('search'));
  }

  return { init, onTrackClick, playNext, removeTrack, showTrackMenu: (t)=>UI.toast(`♫ ${t.title}`),
           showPage, searchArtistTracks, toggleLike };
})();

document.addEventListener('DOMContentLoaded', ()=>App.init());


/* DESKTOP APP */
const DesktopApp = (() => {
  let currentDtPage = 'home';
  let currentDtTab  = 'music';
  let currentDtId   = null;
  let dtTimer;
  let dtLastQuery   = '';
  let dtLikedSort   = 'recent';

  /* ── greeting ── */
  function setDtGreeting() {
    const h = new Date().getHours();
    const g = h<12 ? 'Good morning' : h<18 ? 'Good afternoon' : 'Good evening';
    const el = $('dt-greeting'); if(el) el.textContent = g;
  }

  /* ── sidebar collapse ── */
  function initSidebarCollapse() {
    const btn = $('sb-collapse-btn'); if (!btn) return;
    const sb  = $('desktop-sidebar');
    const icon = $('sb-collapse-icon');
    btn.addEventListener('click', ()=>{
      const collapsed = sb.classList.toggle('sidebar-collapsed');
      if (icon) {
        icon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
        lucide.createIcons({nodes:[icon]});
      }
    });
  }

  /* ── page navigation ── */
  function showDtPage(name) {
    document.querySelectorAll('.dt-page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
    const page = $('dt-page-'+name);
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
    if (name==='liked-songs')    loadDtLikedSongs();
  }

  /* ── genre chips ── */
  function buildDtGenreChips() {
    const wrap = $('dt-genre-chips'); if (!wrap) return;
    wrap.innerHTML = GENRES.map((g,i)=>`
      <div class="chip ${i===0?'active':''}" data-idx="${i}">${escHtml(g.label)}</div>`).join('');
    wrap.querySelectorAll('.chip').forEach(chip=>{
      chip.addEventListener('click', function(){
        wrap.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
        this.classList.add('active');
        loadDtHome(GENRES[parseInt(this.dataset.idx)].q);
      });
    });
  }

  /* ── load functions ── */
  async function loadDtHome(q=GENRES[0].q) {
    const newGrid    = $('dt-home-new-grid');
    const recentGrid = $('dt-home-recent-grid');
    const recentSec  = $('dt-home-recent-section');
    if (newGrid) newGrid.innerHTML = dtSkeletonGrid();
    try {
      const tracks = await search(q);
      if (newGrid) renderDtAlbumGrid(tracks, newGrid, 'tracks');
      const hist = Player.loadHistory();
      if (hist.length && recentGrid && recentSec) {
        recentSec.style.display='';
        renderDtAlbumGrid(hist, recentGrid, 'tracks');
      }
    } catch(e) { if(newGrid) newGrid.innerHTML=dtEmpty('Failed to load',e.message); }
  }

  async function loadDtNew() {
    const grid = $('dt-new-grid'); if(!grid) return;
    grid.innerHTML = dtSkeletonGrid();
    try { renderDtAlbumGrid(await search('new music releases 2025'), grid, 'tracks'); }
    catch(e) { grid.innerHTML=dtEmpty('Failed',e.message); }
  }

  async function loadDtAlbums() {
    const grid = $('dt-albums-grid'); if(!grid) return;
    grid.innerHTML = dtSkeletonGrid();
    try { renderDtAlbumGrid(await hifiSearchAlbums('popular albums 2025'), grid, 'albums'); }
    catch { try { renderDtAlbumGrid(await search('popular albums 2025'), grid, 'tracks'); } catch(e){ grid.innerHTML=dtEmpty('Failed',e.message); } }
  }

  async function loadDtSongs() {
    const el = $('dt-songs-list'); if(!el) return;
    el.innerHTML = dtSkeletonRows();
    try {
      let t=[]; try{t=await hifiSearch('popular songs 2025');}catch{}
      if (!t.length) t=await ivSearch('popular songs 2025');
      renderDtTrackList(t, el);
    } catch(e){ el.innerHTML=dtEmpty('Failed',e.message); }
  }

  async function loadDtArtists() {
    const grid = $('dt-artists-grid'); if(!grid) return;
    grid.innerHTML = dtSkeletonGrid(8,'circle');
    try { renderDtArtistGrid(await hifiSearchArtist('popular artists 2025'), grid); }
    catch(e){ grid.innerHTML=dtEmpty('Failed',e.message); }
  }

  function loadDtRecentlyAdded() {
    const grid = $('dt-recent-grid'); if(!grid) return;
    const hist = Player.loadHistory();
    if (!hist.length){ grid.innerHTML=dtEmpty('Nothing here yet','Play some tracks first'); return; }
    renderDtAlbumGrid(hist, grid, 'tracks');
  }

  function loadDtHistory() {
    const el = $('dt-history-list'); if(!el) return;
    const hist = Player.loadHistory();
    if (!hist.length){ el.innerHTML=dtEmpty('No history yet'); return; }
    renderDtTrackList(hist, el);
  }

  function loadDtLikedSongs() {
    let songs = LikedSongs.getAll();
    const n = songs.length;
    const sub = $('dt-liked-sub'); if(sub) sub.textContent=`${n} song${n!==1?'s':''}`;
    const el = $('dt-liked-list'); if(!el) return;
    if (dtLikedSort==='az') songs=[...songs].sort((a,b)=>a.title.localeCompare(b.title));
    const filterInput = $('dt-liked-filter');
    const q = filterInput ? filterInput.value.trim().toLowerCase() : '';
    const filtered = q ? songs.filter(t=>t.title.toLowerCase().includes(q)||t.artist.toLowerCase().includes(q)) : songs;
    if (!filtered.length) { el.innerHTML=dtEmpty('No liked songs'); return; }
    renderDtTrackList(filtered, el);
  }

  /* ── render helpers ── */
  function renderDtAlbumGrid(items, container, mode) {
    if (!items.length){ container.innerHTML=dtEmpty('No results'); return; }
    container.className='dt-album-grid';
    container.innerHTML=items.map((item,i)=>`
      <div class="dt-album-card" data-index="${i}">
        <img class="dt-album-art" src="${escHtml(item.cover||item.coverSmall||'')}" onerror="this.src=''" alt=""/>
        <div class="dt-album-title">${escHtml(item.title||item.name||'—')}</div>
        <div class="dt-album-artist">${escHtml(item.artist||'')}</div>
      </div>`).join('');
    container._items=items;
    container.querySelectorAll('.dt-album-card').forEach(card=>{
      card.addEventListener('click',()=>{
        const item=items[parseInt(card.dataset.index)];
        if (item.source||item.quality){ currentDtId=item.id; Player.play(item,items,parseInt(card.dataset.index)); updateDtBar(); refreshDtRows(); }
        else UI.toast(`Album: ${item.title}`);
      });
    });
  }

  function renderDtTrackList(tracks, container) {
    if (!tracks.length){ container.innerHTML=dtEmpty('No tracks'); return; }
    container.innerHTML=tracks.map((t,i)=>{
      const badge=qualityBadge(t);
      const act=t.id===currentDtId;
      const liked=LikedSongs.has(t.id);
      return `
        <div class="dt-track-row ${act?'playing':''}" data-index="${i}">
          <div class="dt-track-num">
            ${act?`<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`:`<span>${i+1}</span>`}
          </div>
          <div class="dt-track-main">
            <img class="dt-track-thumb" src="${escHtml(t.coverSmall||t.cover||'')}" onerror="this.src=''" alt=""/>
            <div class="dt-track-info">
              <div class="dt-track-name-row">
                <div class="dt-track-name">${escHtml(t.title)}</div>
                ${t.explicit?`<span class="explicit-tag">E</span>`:''}
              </div>
              <div class="dt-track-sub">${escHtml(t.artist||'')}</div>
            </div>
          </div>
          <div class="dt-track-album">${escHtml(t.album||'')}</div>
          <div class="dt-track-right">
            ${badge?`<span class="quality-badge ${badge.cls}">${badge.label}</span>`:''}
            <button class="dt-track-like ${liked?'liked':''}" data-tid="${escHtml(t.id)}" data-ridx="${i}" onclick="event.stopPropagation();DesktopApp.toggleDtLike(this)">
              <i data-lucide="heart" style="width:14px;height:14px;${liked?'fill:var(--purple)':''}"></i>
            </button>
          </div>
          <div class="dt-track-dur">${t.dur||''}</div>
        </div>`;
    }).join('');
    container._tracks=tracks;
    lucide.createIcons({nodes:Array.from(container.querySelectorAll('i[data-lucide]'))});
    container.querySelectorAll('.dt-track-row').forEach(row=>{
      row.addEventListener('click',()=>{
        const i=parseInt(row.dataset.index);
        currentDtId=tracks[i].id;
        Player.play(tracks[i],tracks,i);
        updateDtBar(); refreshDtRows();
      });
    });
  }

  function renderDtArtistGrid(artists, container) {
    if (!artists.length){ container.innerHTML=dtEmpty('No artists'); return; }
    container.className='dt-artist-grid';
    container.innerHTML=artists.map((a,i)=>`
      <div class="dt-artist-card" data-index="${i}">
        <img class="dt-artist-avatar" src="${escHtml(a.cover||'')}" onerror="this.src=''" alt=""/>
        <div class="dt-artist-name">${escHtml(a.name)}</div>
        <div class="dt-artist-label">Artist</div>
      </div>`).join('');
    container.querySelectorAll('.dt-artist-card').forEach(card=>{
      card.addEventListener('click',()=>{ const a=artists[parseInt(card.dataset.index)]; dtSearchQuery(a.name,'music'); showDtPage('search'); });
    });
  }

  /* ── toggle like (desktop) ── */
  function toggleDtLike(btn) {
    const tid = btn.dataset.tid;
    const track = (() => {
      const row = btn.closest('.dt-track-row');
      const cont = row?.parentElement;
      const i = parseInt(row?.dataset.index);
      return cont?._tracks?.[i];
    })();
    if (!track) return;
    const nowLiked = LikedSongs.toggle(track);
    btn.classList.toggle('liked', nowLiked);
    const icon = btn.querySelector('i');
    if (icon) { icon.style.fill = nowLiked?'var(--purple)':''; }
    UI.syncLikeButtons(track.id);
    UI.toast(nowLiked ? `♥ Liked "${track.title}"` : 'Removed from Liked Songs');
  }

  /* ── search ── */
  function initDtSearch() {
    const input = $('dt-search-input'); if(!input) return;
    input.addEventListener('input', ()=>{
      dtLastQuery = input.value.trim();
      clearTimeout(dtTimer);
      if (!dtLastQuery){ $('dt-search-results').innerHTML=dtEmpty('Search for anything'); return; }
      $('dt-search-results').innerHTML = dtSkeletonRows();
      dtTimer = setTimeout(()=>dtSearchQuery(dtLastQuery, currentDtTab), 380);
      showDtPage('search');
    });
    document.querySelectorAll('.dt-search-tab').forEach(tab=>{
      tab.addEventListener('click', function(){
        document.querySelectorAll('.dt-search-tab').forEach(t=>t.classList.remove('active'));
        this.classList.add('active');
        currentDtTab = this.dataset.dttab;
        if (dtLastQuery) dtSearchQuery(dtLastQuery, currentDtTab);
      });
    });
  }

  async function dtSearchQuery(q, tab='music') {
    const el = $('dt-search-results'); if(!el) return;
    el.innerHTML = (tab==='albums') ? dtSkeletonGrid() : dtSkeletonRows();
    try {
      if (tab==='music'){
        let t=[]; try{t=await hifiSearch(q);}catch{} if(!t.length)t=await ivSearch(q);
        renderDtTrackList(t,el);
      } else if(tab==='video'){ renderDtTrackList(await ivSearch(q),el); }
      else if(tab==='albums'){ renderDtAlbumGrid(await hifiSearchAlbums(q),el,'albums'); }
      else if(tab==='artists'){ renderDtArtistGrid(await hifiSearchArtist(q),el); }
    } catch(e){ el.innerHTML=dtEmpty('Search failed',e.message); }
  }

  /* ── bottom bar ── */
  function updateDtBar() {
    const t = Player.getCurrentTrack(); if(!t) return;
    const art = $('dt-bar-art'); if(art) art.src=t.coverSmall||t.cover||'';
    const title = $('dt-bar-title'); if(title) title.textContent=t.title||'—';
    const artist = $('dt-bar-artist'); if(artist) artist.textContent=t.artist||'—';
    const expl = $('dt-bar-explicit');
    if (expl) expl.style.display = t.explicit ? 'inline-flex' : 'none';
    // like state
    const liked = LikedSongs.has(t.id);
    const likeBtn = $('dt-bar-like-btn');
    if (likeBtn) {
      likeBtn.classList.toggle('liked', liked);
      const icon = likeBtn.querySelector('i');
      if (icon) icon.style.fill = liked ? 'var(--purple)' : '';
    }
  }

  function syncDtProgress(pct, cur, dur) {
    const f=$('dt-bar-progress-fill'); if(f) f.style.width=pct+'%';
    const c=$('dt-bar-time-cur'); if(c) c.textContent=fmtTime(cur);
    const d=$('dt-bar-time-tot'); if(d) d.textContent=fmtTime(dur);
  }

  function setDtPlayState(playing) {
    const icon=$('dt-play-icon'); if(!icon) return;
    icon.setAttribute('data-lucide', playing?'pause':'play');
    lucide.createIcons({nodes:[icon]});
  }

  function refreshDtRows() {
    document.querySelectorAll('.dt-track-row').forEach(row=>{
      const i=parseInt(row.dataset.index);
      const c=row.closest('[class]');
      const t=c?._tracks?.[i];
      const a=t?.id===currentDtId;
      row.classList.toggle('playing',a);
      const num=row.querySelector('.dt-track-num');
      if(num) num.innerHTML=a?`<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`:`<span>${i+1}</span>`;
    });
  }

  /* ── skeleton helpers ── */
  function dtSkeletonGrid(n=10, shape='square') {
    return `<div class="dt-skel-grid">${Array(n).fill(0).map(()=>`
      <div>
        <div class="dt-skel-art" style="${shape==='circle'?'border-radius:50%':''}"></div>
        <div class="dt-skel-line" style="width:85%"></div>
        <div class="dt-skel-line-sm"></div>
      </div>`).join('')}</div>`;
  }
  function dtSkeletonRows(n=10) {
    return Array(n).fill(0).map(()=>`<div class="dt-skel-row"></div>`).join('');
  }
  function dtEmpty(msg, sub='') {
    return `<div class="dt-empty">
      <i data-lucide="search" style="width:52px;height:52px"></i>
      <h3>${escHtml(msg)}</h3>${sub?`<p>${escHtml(sub)}</p>`:''}
    </div>`;
  }

  /* ── topbar controls ── */
  function initDtBarControls() {
    const audio = $('audio');
    $('dt-play-btn')?.addEventListener('click',    ()=>Player.toggle());
    $('dt-prev-btn')?.addEventListener('click',    ()=>Player.prev());
    $('dt-next-btn')?.addEventListener('click',    ()=>Player.next());
    $('dt-shuffle-btn')?.addEventListener('click', ()=>Player.toggleShuffle());
    $('dt-repeat-btn')?.addEventListener('click',  ()=>Player.toggleRepeat());

    $('dt-bar-progress-bar')?.addEventListener('click', e=>{
      const r=$('dt-bar-progress-bar').getBoundingClientRect();
      Player.seek(Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100)));
    });
    $('dt-vol-bar')?.addEventListener('click', e=>{
      const r=$('dt-vol-bar').getBoundingClientRect();
      Player.setVolume(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)));
    });

    $('dt-bar-like-btn')?.addEventListener('click', ()=>{
      const t = Player.getCurrentTrack(); if(!t) return;
      const nowLiked = LikedSongs.toggle(t);
      const btn = $('dt-bar-like-btn');
      btn.classList.toggle('liked', nowLiked);
      const icon = btn.querySelector('i');
      if(icon) icon.style.fill = nowLiked?'var(--purple)':'';
      UI.syncLikeButtons(t.id);
      UI.toast(nowLiked?`♥ Liked "${t.title}"`:'Removed from Liked Songs');
    });

    $('dt-queue-btn')?.addEventListener('click', ()=>UI.toast('Queue coming soon'));

    audio.addEventListener('play',    ()=>{ setDtPlayState(true);  updateDtBar(); });
    audio.addEventListener('pause',   ()=>setDtPlayState(false));
    audio.addEventListener('timeupdate',()=>{
      if (!audio.duration) return;
      syncDtProgress((audio.currentTime/audio.duration)*100, audio.currentTime, audio.duration);
    });
  }

  /* ── liked songs desktop ── */
  function initDtLiked() {
    $('dt-liked-play-all')?.addEventListener('click', ()=>{
      const songs = LikedSongs.getAll();
      if (!songs.length){ UI.toast('No liked songs yet'); return; }
      currentDtId=songs[0].id;
      Player.play(songs[0],songs,0);
      updateDtBar(); refreshDtRows();
    });
    $('dt-liked-filter')?.addEventListener('input', ()=>loadDtLikedSongs());
    $('dt-liked-sort-btn')?.addEventListener('click', ()=>{
      dtLikedSort = dtLikedSort==='recent'?'az':'recent';
      const lbl=$('dt-liked-sort-label'); if(lbl) lbl.textContent=dtLikedSort==='az'?'A–Z':'Recent';
      loadDtLikedSongs();
    });
  }

  /* ── account btn ── */
  function initDtAccount() {
    $('dt-account-btn')?.addEventListener('click', ()=>UI.toast('Account & Settings'));
    $('sb-user-btn')?.addEventListener('click',    ()=>UI.toast('Account & Settings'));
  }

  /* ── resize handler ── */
  function handleResize() {
    const isDesktop = window.matchMedia('(min-width: 900px)').matches;
    const appEl = $('app'); const dtEl = $('desktop-shell');
    if (appEl) appEl.style.display = isDesktop ? 'none' : '';
    if (dtEl)  dtEl.style.display  = isDesktop ? 'flex' : 'none';
  }

  /* ── init ── */
  function init() {
    handleResize();
    window.addEventListener('resize', handleResize);
    setDtGreeting();
    buildDtGenreChips();
    initSidebarCollapse();
    initDtSearch();
    initDtBarControls();
    initDtLiked();
    initDtAccount();
    document.querySelectorAll('.sb-item').forEach(item=>{
      item.addEventListener('click', function(){ showDtPage(this.dataset.dtpage); });
    });
    if (window.matchMedia('(min-width: 900px)').matches) loadDtHome();
  }

  return { init, updateDtBar, syncDtProgress, setDtPlayState, refreshDtRows, toggleDtLike };
})();

document.addEventListener('DOMContentLoaded', ()=>DesktopApp.init());