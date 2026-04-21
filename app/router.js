// Router
import * as UI from './ui.js'

const $ = id => document.getElementById(id);
let _prev = 'home', _isPop = false;
const _loaders = {}, _loaded = new Set(), CACHE = new Set(['home', 'new']);

const _handlers = {};
export function registerHandler(name, fn) { _handlers[name] = fn; }

export function registerLoader(name, fn) { _loaders[name] = fn; }

export function showPage(name, push = true, params = {}) {
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
    // Ensure the sub-page overlay itself is scrollable since the background is locked
    const subPage = document.getElementById(`page-${name}`);
    if (subPage) Object.assign(subPage.style, { overflowY: 'auto', height: '100%' });
  } else if (!isSub) {
    UI.closeAllOverlays();
    UI.showPage(name);
    closeSidebar();
    const scroller = $('main-content') || document.querySelector('.main-wrap');
    if (scroller) scroller.scrollTo(0, 0);
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
  // Use replaceState to update metadata/slugs without bloating the history stack
  history.replaceState({ page: name, params }, '', `?${urlParams.toString()}`);
}

export function goBack(fb = 'home') { history.length > 1 ? history.back() : showPage(_prev || fb); }

export function openSidebar() { 
  $('sidebar')?.classList.add('open'); 
  $('sidebar-overlay')?.classList.add('visible'); 
  UI.setMainContentOverlayState(true);
}

export function closeSidebar() { 
  $('sidebar')?.classList.remove('open'); 
  $('sidebar-overlay')?.classList.remove('visible'); 
  UI.setMainContentOverlayState(false);
}

// History
window.addEventListener('popstate', e => { 
  _isPop = true; 
  const name = e.state?.page || 'home';
  const params = e.state?.params || {};
  showPage(name, false, params); 
  _isPop = false; 
});

export function invalidatePage(name) { _loaded.delete(name); }

if (!history.state) history.replaceState({ page: 'home' }, '', '?p=home');