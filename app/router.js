import * as UI from './ui.js'

const $ = id => document.getElementById(id);
let _prev = 'home', _isPop = false;
const _loaders = {}, _loaded = new Set(), CACHE = new Set(['home', 'new']);

export function registerLoader(name, fn) { _loaders[name] = fn; }

// Navigate to page
export function showPage(name, push = true) {
  _prev = document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
  if (push && !_isPop) history.pushState({ page: name }, '', `?p=${name}`);
  UI.showPage(name);
  closeSidebar();
  $('main-content')?.scrollTo(0, 0);
  if (_loaders[name] && !(CACHE.has(name) && _loaded.has(name))) { _loaders[name](); _loaded.add(name); }
  if (name === 'search') setTimeout(() => $('search-input')?.focus(), 100);
}

export function goBack(fb = 'home') { history.length > 1 ? history.back() : showPage(_prev || fb); }

export function openSidebar() { $('sidebar')?.classList.add('open'); $('sidebar-overlay')?.classList.add('visible'); }

export function closeSidebar() { $('sidebar')?.classList.remove('open'); $('sidebar-overlay')?.classList.remove('visible'); }

// Popstate handling
window.addEventListener('popstate', e => { _isPop = true; showPage(e.state?.page || 'home', false); _isPop = false; });

export function invalidatePage(name) { _loaded.delete(name); }

if (!history.state) history.replaceState({ page: 'home' }, '', '?p=home');