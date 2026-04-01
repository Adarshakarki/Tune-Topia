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
import * as PlaylistPage from '../pages/playlist.js'
import * as UserPlaylistPage from '../pages/userplaylist.js'
import * as LikedVideosPage from '../pages/likedVideos.js'
import * as VideoPage from '../pages/video.js'
import * as AboutPage from '../pages/about.js'
import { playTrack } from './playback.js'
import { ICONS } from './icons.js'

const $ = (id) => document.getElementById(id)

// Update account PFP
export function renderAccountBtn() {
  const btn = $('home-account-btn'), pfp = State.get('user.pfp');
  if (!btn) return;
  if (!pfp) return btn.innerHTML = `<i class="bi ${ICONS.person}" id="home-account-icon"></i>`;

  const img = new Image();
  img.src = pfp;
  img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:var(--r-full);";
  img.onload = () => { btn.innerHTML = ''; btn.appendChild(img); };
  img.onerror = () => btn.innerHTML = `<i class="bi ${ICONS.person}"></i>`;
}

function _stripBackButtonText() {
  document.querySelectorAll('.back-btn').forEach(btn => {
    const icon = btn.querySelector('i.bi');
    if (icon) { btn.textContent = ''; btn.appendChild(icon); }
  });
}

function init() {
  State.init();
  UI.applyTheme(State.get('ui.theme') || 'light');
  UI.renderGreeting();
  renderAccountBtn();

  // Page Inits
  Playlists.init(State);
  AlbumPage.init(playTrack);
  ArtistPage.init(playTrack, AlbumPage.open);
  PlaylistPage.init(playTrack);
  UserPlaylistPage.init(playTrack, () => { PlaylistsUI.renderPage(); Library.render(); });
  LikedVideosPage.init(VideoPage.open);
  GenrePage.init(PlaylistPage.open, AlbumPage.open, playTrack);
  
  PlayerEvents.bind();
  SearchPage.init();
  Liked.initEvents();
  Settings.initEvents();
  AccountPage.initEvents(Router.showPage);
  PlaylistsUI.initEvents();
  Sheets.initEvents();
  NowPlaying.init();
  UI.updateVolume(State.get('player.volume') ?? 0.8);

  // Routes
  const routes = {
    'home': Home.load, 'library': Library.render, 'liked': Liked.render,
    'account': AccountPage.render, 'settings': Settings.render, 'albums': Library.loadAlbums,
    'artists': Library.loadArtists, 'history': Library.loadHistory, 'recent': Library.loadRecent,
    'new': Library.loadNew, 'playlists': PlaylistsUI.renderPage, 'liked-videos': LikedVideosPage.onEnter,
    'about': AboutPage.render
  };
  Object.entries(routes).forEach(([k, v]) => Router.registerLoader(k, v));

  // App Load
  requestAnimationFrame(() => {
    Home.load();
    const next = () => { Library.render(); _stripBackButtonText(); };
    'requestIdleCallback' in window ? requestIdleCallback(next) : setTimeout(next, 200);
  });

  // Subscriptions
  const _refreshQueue = () => UI.renderQueue(State.get('queue.tracks') || [], State.get('player.queuePosition') || 0, Queue.getUpcoming());
  State.subscribe('queue.tracks', _refreshQueue);
  State.subscribe('player.queuePosition', _refreshQueue);
  State.subscribe('library.followedArtists', Library.render);
  State.subscribe('library.savedAlbums', () => {
    Library.render();
    if (document.querySelector('#page-albums.active')) Library.loadAlbums();
  });

  // Nav
  document.body.addEventListener('click', e => {
    const p = e.target.closest('[data-page]'), b = e.target.closest('[data-back]');
    if (p) Router.showPage(p.dataset.page);
    else if (b) window.history.length > 1 ? window.history.back() : Router.showPage(b.dataset.back);
  });

  $('sidebar-overlay')?.addEventListener('click', Router.closeSidebar);
  
  const shell = $('shell'), sbBtn = $('sb-collapse-btn');
  if (shell && sbBtn) {
    shell.classList.toggle('sb-collapsed', localStorage.getItem('tt_sb_collapsed') === 'true');
    sbBtn.addEventListener('click', () => localStorage.setItem('tt_sb_collapsed', String(shell.classList.toggle('sb-collapsed'))));
  }

  $('sb-theme-btn')?.addEventListener('click', () => {
    const theme = State.get('ui.theme') === 'dark' ? 'light' : 'dark';
    State.setTheme(theme); UI.applyTheme(theme);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(NowPlaying.syncMoreSheetPosition, 150);
  });
}

document.addEventListener('DOMContentLoaded', init)