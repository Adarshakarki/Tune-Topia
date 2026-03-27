import * as UI from './ui.js'

const $ = (id) => document.getElementById(id)

let _prevPage = 'home'
let _isPopping = false

const _pageLoaders = {}
const _loadedPages = new Set()

// pages where the loader does heavy network work — skip on revisit
const CACHE_PAGES = new Set(['home', 'new'])

export function registerLoader(name, fn) {
  _pageLoaders[name] = fn
}

export function showPage(name, pushState = true) {
  _prevPage =
    document.querySelector('.page.active')?.id?.replace('page-', '') || 'home'
  if (pushState && !_isPopping) {
    history.pushState({ page: name }, '', `?p=${name}`)
  }
  UI.showPage(name)
  closeSidebar()
  $('main-content')?.scrollTo(0, 0)
  if (_pageLoaders[name] && !(CACHE_PAGES.has(name) && _loadedPages.has(name))) {
    _pageLoaders[name]()
    _loadedPages.add(name)
  }
  if (name === 'search') setTimeout(() => $('search-input')?.focus(), 100)
}

export function goBack(fallback = 'home') {
  if (history.length > 1) {
    history.back()
  } else {
    showPage(_prevPage || fallback)
  }
}

export function openSidebar() {
  $('sidebar')?.classList.add('open')
  $('sidebar-overlay')?.classList.add('visible')
}

export function closeSidebar() {
  $('sidebar')?.classList.remove('open')
  $('sidebar-overlay')?.classList.remove('visible')
}

// handle browser back/forward
window.addEventListener('popstate', (e) => {
  _isPopping = true
  const page = e.state?.page || 'home'
  showPage(page, false)
  _isPopping = false
})

export function invalidatePage(name) {
  _loadedPages.delete(name)
}

// initialize history state for current page
if (!history.state) {
  history.replaceState({ page: 'home' }, '', '?p=home')
}