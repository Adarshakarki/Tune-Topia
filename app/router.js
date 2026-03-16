// app/router.js — page switching and sidebar

import * as UI from './ui.js';

const $ = (id) => document.getElementById(id);

let _prevPage = 'home';

// Page load callbacks registered by each page module
const _pageLoaders = {};

export function registerLoader(name, fn) {
  _pageLoaders[name] = fn;
}

export function showPage(name) {
  _prevPage =
    document.querySelector('.page.active')?.id?.replace('page-', '') || 'home';
  UI.showPage(name);
  closeSidebar();
  $('main-content')?.scrollTo(0, 0);
  if (_pageLoaders[name]) _pageLoaders[name]();
  if (name === 'search') setTimeout(() => $('search-input')?.focus(), 100);
}

export function goBack(fallback = 'home') {
  showPage(_prevPage || fallback);
}

export function openSidebar() {
  $('sidebar')?.classList.add('open');
  $('sidebar-overlay')?.classList.add('visible');
}

export function closeSidebar() {
  $('sidebar')?.classList.remove('open');
  $('sidebar-overlay')?.classList.remove('visible');
}
