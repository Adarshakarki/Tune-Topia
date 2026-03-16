// app/init.js — bootstrap only

import State from './state.js';
import * as UI from './ui.js';
import * as Player from '../modules/player.js';
import Queue from '../modules/queue.js';
import * as Playlists from '../modules/playlists.js';
import * as PlayerEvents from './playerEvents.js';
import * as Router from './router.js';
import * as Sheets from '../ui/sheets.js';
import * as NowPlaying from '../ui/nowplaying.js';
import * as Home from '../pages/home.js';
import * as Library from '../pages/library.js';
import * as Liked from '../pages/liked.js';
import * as Settings from '../pages/settings.js';
import * as AccountPage from '../pages/account.js';
import * as PlaylistsUI from '../pages/playlists-ui.js';
import * as SearchPage from '../pages/search.js';
import * as AlbumPage from '../pages/album.js';
import * as ArtistPage from '../pages/artist.js';
import * as GenrePage from '../pages/genre.js';
import * as PlaylistPage from '../pages/playlist.js';
import * as UserPlaylistPage from '../pages/userplaylist.js';
import * as LikedVideosPage from '../pages/likedVideos.js';
import { playTrack } from './playback.js';

const $ = (id) => document.getElementById(id);

export function renderAccountBtn() {
  const btn = $('home-account-btn');
  if (!btn) return;
  const pfp = State.get('user.pfp') || '';
  btn.innerHTML = pfp
    ? `<img src="${pfp}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r-full);" onerror="this.parentElement.innerHTML='<i class=\\'bi bi-person-circle\\'></i>'"/>`
    : '<i class="bi bi-person-circle" id="home-account-icon"></i>';
}

function init() {
  State.init();
  UI.applyTheme(State.get('ui.theme') || 'light');
  UI.renderGreeting();
  renderAccountBtn();

  // Module init
  Playlists.init(State);
  AlbumPage.init(playTrack);
  ArtistPage.init(playTrack, (album) => AlbumPage.open(album));
  PlaylistPage.init(playTrack);
  UserPlaylistPage.init(playTrack, () => {
    PlaylistsUI.renderPage();
    Library.render();
  });
  LikedVideosPage.init(playTrack);
  GenrePage.init(
    (pl) => PlaylistPage.open(pl),
    (album) => AlbumPage.open(album),
    playTrack,
  );
  PlayerEvents.bind();
  SearchPage.init();
  Liked.initEvents();
  Settings.initEvents();
  AccountPage.initEvents(Router.showPage);
  PlaylistsUI.initEvents();
  Sheets.initEvents();
  NowPlaying.init();

  // Page loaders
  Router.registerLoader('home', Home.load);
  Router.registerLoader('library', Library.render);
  Router.registerLoader('liked', Liked.render);
  Router.registerLoader('account', AccountPage.render);
  Router.registerLoader('settings', Settings.render);
  Router.registerLoader('albums', Library.loadAlbums);
  Router.registerLoader('artists', Library.loadArtists);
  Router.registerLoader('history', Library.loadHistory);
  Router.registerLoader('recent', Library.loadRecent);
  Router.registerLoader('new', Library.loadNew);
  Router.registerLoader('playlists', PlaylistsUI.renderPage);
  Router.registerLoader('liked-videos', LikedVideosPage.onEnter);

  UI.updateVolume(State.get('player.volume') ?? 0.8);
  setTimeout(() => {
    Home.load();
    Library.render();
  }, 0);

  // State subscriptions
  const _refreshQueue = () =>
    UI.renderQueue(
      State.get('queue.tracks') || [],
      State.get('player.queuePosition') || 0,
      Queue.getUpcoming(),
    );
  State.subscribe('queue.tracks', _refreshQueue);
  State.subscribe('player.queuePosition', _refreshQueue);
  State.subscribe('library.followedArtists', () => Library.render());
  State.subscribe('library.savedAlbums', () => {
    Library.render();
    if (document.querySelector('#page-albums.active')) Library.loadAlbums();
  });

  // Nav
  document
    .querySelectorAll('.nav-btn[data-page]')
    .forEach((btn) =>
      btn.addEventListener('click', () => Router.showPage(btn.dataset.page)),
    );
  document
    .querySelectorAll('.sb-item[data-page]')
    .forEach((item) =>
      item.addEventListener('click', () => Router.showPage(item.dataset.page)),
    );
  document.querySelectorAll('[data-page]').forEach((el) => {
    if (el.classList.contains('sb-item') || el.classList.contains('nav-btn'))
      return;
    el.addEventListener('click', () => Router.showPage(el.dataset.page));
  });
  document
    .querySelectorAll('[data-back]')
    .forEach((btn) =>
      btn.addEventListener('click', () => Router.showPage(btn.dataset.back)),
    );
  $('sidebar-overlay')?.addEventListener('click', Router.closeSidebar);

  // Sidebar collapse — desktop only
  (function () {
    const shell = document.getElementById('shell');
    const btn = $('sb-collapse-btn');
    if (!shell || !btn) return;
    const collapsed = localStorage.getItem('tt_sb_collapsed') === 'true';
    if (collapsed) shell.classList.add('sb-collapsed');
    btn.addEventListener('click', () => {
      const next = !shell.classList.contains('sb-collapsed');
      shell.classList.toggle('sb-collapsed', next);
      localStorage.setItem('tt_sb_collapsed', String(next));
    });
  })();

  // Library shortcuts
  $('lib-liked')?.addEventListener('click', () => Router.showPage('liked'));
  $('lib-playlists')?.addEventListener('click', () =>
    Router.showPage('playlists'),
  );
  $('lib-albums')?.addEventListener('click', () => Router.showPage('albums'));
  $('lib-artists')?.addEventListener('click', () => Router.showPage('artists'));
  $('lib-history')?.addEventListener('click', () => Router.showPage('history'));
  $('lib-liked-videos')?.addEventListener('click', () =>
    Router.showPage('liked-videos'),
  );

  // Theme toggle
  $('sb-theme-btn')?.addEventListener('click', () => {
    const next = State.get('ui.theme') === 'dark' ? 'light' : 'dark';
    State.setTheme(next);
    UI.applyTheme(next);
  });

  // More sheet position sync
  NowPlaying.syncMoreSheetPosition();
  window.addEventListener('resize', NowPlaying.syncMoreSheetPosition);
}

document.addEventListener('DOMContentLoaded', init);
