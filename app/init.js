// Initialization
import State from './state.js'
import * as UI from './ui.js'
import * as Player from '../modules/player.js'
import Queue from '../modules/queue.js'
import * as Playlists from '../modules/playlists.js'
import * as PlayerEvents from './playerEvents.js'
import * as Router from './router.js'
import * as Sheets from '../ui/sheets.js'
import * as NowPlaying from '../ui/nowplaying.js'
import * as Home from '../pages/home.js'
import * as Library from '../pages/library.js'
import * as Liked from '../pages/liked.js'
import * as Settings from '../pages/settings.js'
import * as AccountPage from '../pages/account.js'
import * as PlaylistsUI from '../pages/playlists-ui.js'
import * as SearchPage from '../pages/search.js'
import * as AlbumPage from '../pages/album.js'
import * as ArtistPage from '../pages/artist.js'
import * as GenrePage from '../pages/genre.js'
import * as MixPage from '../pages/mix.js'
import * as PlaylistPage from '../pages/playlist.js'
import * as UserPlaylistPage from '../pages/userplaylist.js'
import * as LikedVideosPage from '../pages/likedVideos.js'
import * as VideoPage from '../pages/video.js'
import * as AboutPage from '../pages/about.js'
import * as LoginPage from '../pages/login.js'
import { playTrack } from './playback.js'
import * as processor from '../modules/processor.js'
import * as EQ from '../modules/eq.js'
import * as Theme from '../modules/theme.js'

const $ = (id) => document.getElementById(id)

export function renderAccountBtn() {
  const btn = $('home-account-btn'), pfp = State.get('user.pfp');
  if (!btn) return;
  if (!pfp) return btn.innerHTML = UI.getIcon('person');

  const img = new Image();
  img.src = pfp;
  img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:var(--r-full);";
  img.onload = () => { btn.innerHTML = ''; btn.appendChild(img); };
  img.onerror = () => btn.innerHTML = UI.getIcon('person');
}

function _stripBackButtonText() {
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.innerHTML = UI.getIcon('chevron-left');
  });
}

async function init() {
  State.init();

  if (Player.audioA) {
    processor.init(Player.audioA);
    EQ.init();
  }

  await Theme.fetchThemes();

  const _refreshQueue = () => {
    const pos = State.get('player.queuePosition');
    const tracks = State.get('queue.tracks') || [];
    UI.renderQueue(tracks, pos, Queue.getUpcoming());
  };

  State.subscribe('queue.tracks', _refreshQueue);
  State.subscribe('player.queuePosition', _refreshQueue);
  State.subscribe('queue.priorityOffset', _refreshQueue);
  State.subscribe('player.isShuffle', _refreshQueue);
  State.subscribe('player.isRepeat', _refreshQueue);
  State.subscribe('library.followedArtists', Library.render);
  State.subscribe('ui.theme', UI.revertThemeColor);
  State.subscribe('library.likedPlaylists', Library.render);
  State.subscribe('library.likedMixes', Library.render);
  State.subscribe('ui.themeMode', UI.revertThemeColor);
  State.subscribe('library.savedAlbums', () => {
    Library.render();
    if (document.querySelector('#page-albums.active')) Library.loadAlbums();
  });

  Theme.applyTheme(State.get('ui.theme') || 'default');
  Theme.applyAppearance(State.get('ui.themeMode') || 'light');

  Theme.loadFonts();
  UI.renderGreeting();
  UI.replaceHtmlIcons();
  renderAccountBtn();

  Playlists.init(State);
  AlbumPage.init(playTrack);
  ArtistPage.init(playTrack, AlbumPage.open);
  PlaylistPage.init(playTrack);
  MixPage.init(playTrack);
  UserPlaylistPage.init(playTrack, () => { PlaylistsUI.renderPage(); Library.render(); });
  LikedVideosPage.init(VideoPage.open);
  GenrePage.init(PlaylistPage.open, AlbumPage.open, playTrack);
  
  Router.registerHandler('artist', (p) => ArtistPage.open(p));
  Router.registerHandler('album', (p) => AlbumPage.open(p));
  Router.registerHandler('playlist', (p) => PlaylistPage.open(p));
  Router.registerHandler('mix', (p) => MixPage.open(p));
  Router.registerHandler('user-playlist', (p) => UserPlaylistPage.open(p.id));
  Router.registerHandler('genre', (p) => GenrePage.open(p.id, p.label));

  PlayerEvents.bind();
  SearchPage.init();
  Liked.initEvents();
  Settings.initEvents();
  AccountPage.initEvents(Router.showPage);
  PlaylistsUI.initEvents();
  Sheets.initEvents();
  NowPlaying.init();
  UI.updateVolume(State.get('player.volume') ?? 0.8);

  const routes = {
    'home': Home.load, 'library': Library.render, 'liked': Liked.render,
    'account': AccountPage.render, 'settings': Settings.render, 'albums': Library.loadAlbums,
    'artists': Library.loadArtists, 'history': Library.loadHistory, 'recent': Library.loadRecent,
    'new': Library.loadNew, 'playlists': PlaylistsUI.renderPage, 'liked-videos': LikedVideosPage.onEnter,
    'about': AboutPage.render, 'login': LoginPage.render,
    'tidal-playlists': Library.loadTidalPlaylists
  };
  Object.entries(routes).forEach(([k, v]) => Router.registerLoader(k, v));

  requestAnimationFrame(() => {
    Home.load();
    const next = () => { Library.render(); _stripBackButtonText(); };
    'requestIdleCallback' in window ? requestIdleCallback(next) : setTimeout(next, 200);

    const urlParams = new URLSearchParams(window.location.search);
    const p = urlParams.get('p');
    if (p && ['artist', 'album', 'playlist', 'mix', 'user-playlist', 'genre'].includes(p)) {
      const params = {};
      urlParams.forEach((v, k) => { if (k !== 'p') params[k] = v; });
      Router.showPage(p, false, params);
    }
  });

  UI.revertThemeColor();

  _bindNavigationListeners();
  _bindPlayerUIListeners();
  _bindGlobalScrollListeners();
}

function _bindNavigationListeners() {
  document.body.addEventListener('click', e => {
    const p = e.target.closest('[data-page]'), b = e.target.closest('[data-back]');
    if (p) Router.showPage(p.dataset.page);
    else if (b) window.history.length > 1 ? window.history.back() : Router.showPage(b.dataset.back);
  });

  $('sidebar-overlay')?.addEventListener('click', Router.closeSidebar);
}

function _bindPlayerUIListeners() {
  $('np-queue-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.q-stack-btn');
    if (!btn) return;
    e.stopPropagation();
    if (btn.id === 'q-shuffle-btn') Player.toggleShuffle();
    else if (btn.id === 'q-repeat-btn') Player.toggleRepeat();
    else if (btn.id === 'q-add-pl-btn') {
      const t = Player.getCurrentTrack();
      if (t) PlaylistsUI.openPicker(t);
    }
    else if (btn.id === 'q-sleep-btn') {
      $('sleep-timer-popup')?.classList.add('open');
    }
  });

  $('np-more-btn')?.addEventListener('click', () => {
    const track = Player.getCurrentTrack();
    if (track) UI.openMoreSheet(track);
  });

  $('home-radio-btn')?.addEventListener('click', () => {
    const current = Player.getCurrentTrack();
    Player.startRadio(current);
    UI.toast(current ? `Starting radio based on ${current.title}` : 'Starting personalized radio...');
  });

  $('np-more-sheet')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="radio"]');
    if (btn) {
      const track = $('np-more-sheet')._currentTrack;
      if (track) {
        Player.startRadio(track);
        UI.closeMoreSheet();
        UI.toast(`Starting radio based on ${track.title}`);
      }
    }
  });

  $('np-more-sheet')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="mix"]');
    if (btn) {
      const track = $('np-more-sheet')._currentTrack;
      if (track) {
        UI.closeMoreSheet();
        MixPage.open(track);
      }
    }
  });

  $('track-options-sheet')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="mix"]');
    if (btn) {
      const track = Sheets.getTrack();
      if (track) {
        UI.closeAllOverlays();
        MixPage.open(track);
      }
    }
  });

  $('pl-modal-import-btn')?.addEventListener('click', () => $('pl-import-file')?.click());
  $('pl-import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    UI.toast('Reading import file...');
    try {
      const { parseImportFile, resolveTracks } = await import('../modules/playlistImport.js');
      const trackRefs = await parseImportFile(file);
      
      if (!trackRefs.length) throw new Error('No tracks found in file');
      
      UI.toast(`Finding ${trackRefs.length} songs in library...`);
      const { resolved, failed } = await resolveTracks(trackRefs, (cur, total) => {
        if (cur % 5 === 0) UI.toast(`Matching: ${cur}/${total}`);
      });
      
      if (resolved.length > 0) {
        UI.toast(`Imported ${resolved.length} songs successfully.`);
        if ($('pl-modal-name-input')) $('pl-modal-name-input').value = file.name.replace(/\.[^/.]+$/, "");
        const createBtn = $('pl-modal-create');
        if (createBtn) createBtn._importedTracks = resolved;
      }
    } catch (err) {
      UI.toast(err.message || 'Import failed');
    }
    e.target.value = '';
  });

  const shell = $('shell'), sbBtn = $('sb-collapse-btn');
  if (shell && sbBtn) {
    shell.classList.toggle('sb-collapsed', localStorage.getItem('tt_sb_collapsed') === 'true');
    sbBtn.addEventListener('click', () => localStorage.setItem('tt_sb_collapsed', String(shell.classList.toggle('sb-collapsed'))));
  }

  $('sb-theme-btn')?.addEventListener('click', () => {});

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      UI.updatePlayerPosition();
      NowPlaying.syncMoreSheetPosition();
    }, 150);
  });
}

function _bindGlobalScrollListeners() {
  window.addEventListener('wheel', (e) => {
    // Target the actual wrapper that handles the overflow-x
    const container = e.target.closest('.horiz-scroll');
    if (!container) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll <= 0) return;

    // If vertical scroll intent is stronger than horizontal, convert it
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const isAtStart = container.scrollLeft <= 1;
      const isAtEnd = container.scrollLeft >= maxScroll - 1;

      // Directional guard: If at boundaries, allow vertical page scroll to take over
      if (e.deltaY > 0 && isAtEnd) return;
      if (e.deltaY < 0 && isAtStart) return;

      // Direct addition for discrete wheel steps
      container.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
}

document.addEventListener('DOMContentLoaded', init)
