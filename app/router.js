import * as UI from './ui.js'

const $ = id => document.getElementById(id);
let _prev = 'home', _isPop = false;
const _loaders = {}, _loaded = new Set(), CACHE = new Set(['home', 'new']);

const _handlers = {};
export function registerHandler(name, fn) { _handlers[name] = fn; }

export function registerLoader(name, fn) { _loaders[name] = fn; }

export function showPage(name, push = true, params = {}) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  const targetPage = $(`page-${name}`);
  if (targetPage) targetPage.classList.add('active');

  const isSub = ['artist', 'album', 'playlist', 'mix', 'user-playlist', 'genre'].includes(name);
  _prev = document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';

  const urlParams = new URLSearchParams();
  urlParams.set('p', name);
  Object.entries(params).forEach(([k, v]) => {
    if (v && typeof v !== 'object') urlParams.set(k, v);
  });
  const url = `?${urlParams.toString()}`;

  const isCurrentlyActive = document.querySelector(`.sub-page.open#page-${name}, .page.active#page-${name}`);

  if (push && !_isPop) {
    if (isCurrentlyActive) {
      history.replaceState({ page: name, params }, '', url);
    } else {
      history.pushState({ page: name, params }, '', url);
    }
  }

  if (isSub && _handlers[name]) {
    _handlers[name](params);
    UI.setMainContentOverlayState(true);
    const subPage = document.getElementById(`page-${name}`);
    if (subPage) Object.assign(subPage.style, { 
      overflowY: 'auto', 
      height: '100%', 
      webkitOverflowScrolling: 'touch',
      touchAction: 'pan-y'
    });
  } else if (!isSub) {
    UI.closeAllOverlays();
    UI.showPage(name);
    closeSidebar();

    // 3. Reset scroll position to top of the content area
    const mainContent = $('main-content');
    if (mainContent) mainContent.scrollTop = 0;

    if (_loaders[name] && !(CACHE.has(name) && _loaded.has(name))) { _loaders[name](); _loaded.add(name); }
    if (name === 'search') setTimeout(() => $('search-input')?.focus(), 100);
  }
}

export function updateURL(name, params = {}) {
  if (_isPop) return;
  const urlParams = new URLSearchParams();
  urlParams.set('p', name);
  Object.entries(params).forEach(([k, v]) => {
    if (v && typeof v !== 'object') urlParams.set(k, v);
  });
  history.replaceState({ page: name, params }, '', `?${urlParams.toString()}`);
}

export function goBack(fb = 'home') { history.length > 1 ? history.back() : showPage(_prev || fb); }

export function openSidebar() { 
  const sb = $('sidebar');
  if (sb) {
    sb.classList.add('open');
    sb.style.overflowY = 'auto';
    sb.style.webkitOverflowScrolling = 'touch';
  }
  $('sidebar-overlay')?.classList.add('visible'); 
}

export function closeSidebar() { 
  $('sidebar')?.classList.remove('open'); 
  $('sidebar-overlay')?.classList.remove('visible'); 
  UI.setMainContentOverlayState(false);
}

window.addEventListener('popstate', e => { 
  _isPop = true; 
  const name = e.state?.page || 'home';
  const params = e.state?.params || {};
  showPage(name, false, params); 
  _isPop = false; 
});

export function invalidatePage(name) { _loaded.delete(name); }

if (!history.state) history.replaceState({ page: 'home' }, '', '?p=home');