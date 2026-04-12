// Theme
import State from '../app/state.js'

export let THEMES = [{ id: 'default', name: 'Default' }];

// API
export async function fetchThemes() {
  try {
    const res = await fetch('./theme/themes.json');
    const data = await res.json();
    THEMES = data.themes || [];
    return THEMES;
  } catch (err) {
    console.warn('[Theme] manifest not found, using fallbacks.');
    THEMES = [{ id: 'default', name: 'Default' }];
    return THEMES;
  }
}

// UI
export function applyAppearance(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  State.set('ui.themeMode', mode);
}

// Skin
export function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || (id === 'default' ? { id: 'default' } : (THEMES[0] || { id: 'default' }));
  document.documentElement.setAttribute('data-skin', theme.id);
  State.set('ui.theme', theme.id);

  let link = document.getElementById('theme-css');
  if (!link) {
    link = document.createElement('link');
    link.id = 'theme-css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  
  if (theme.id === 'default') {
    link.href = '';
  } else {
    link.href = `./theme/${theme.id}.css`;
  }
}

// Load
export function loadFonts() {
  const p = localStorage.getItem('tt_font_primary') || '';
  const s = localStorage.getItem('tt_font_secondary') || '';
  applyFonts(p, s);
}

// Fonts
export function applyFonts(primaryLink, secondaryLink) {
  State.set('ui.fontPrimaryLink', primaryLink);
  State.set('ui.fontSecondaryLink', secondaryLink);

  localStorage.setItem('tt_font_primary', primaryLink || '');
  localStorage.setItem('tt_font_secondary', secondaryLink || '');

  _updateFontLink('font-link-primary', primaryLink);
  _updateFontLink('font-link-secondary', secondaryLink);

  const pName = _extractFontName(primaryLink);
  const sName = _extractFontName(secondaryLink);

  // Root properties
  const root = document.documentElement.style;
  if (pName) root.setProperty('--font-primary', pName);
  else root.removeProperty('--font-primary');

  if (sName) root.setProperty('--font-secondary', sName);
  else root.removeProperty('--font-secondary');
}

// Link
function _updateFontLink(id, href) {
  let link = document.getElementById(id);
  
  if (!href) {
    if (link) link.remove();
    return;
  }

  let validatedHref = '';
  try {
    const url = new URL(href);
    // HTTPS
    if (url.protocol === 'https:') {
      validatedHref = url.href; 
    }
  } catch (e) {
    // If invalid URL, ensure the old link is removed for safety
    if (link) link.remove();
    return;
  }

  if (!validatedHref) {
    if (link) link.remove();
    return;
  }

  // Inject
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  
  link.setAttribute('href', validatedHref);
}

// Name
function _extractFontName(input) {
  if (!input) return '';
  
  let name = '';
  try {
    const url = new URL(input);
    const family = url.searchParams.get('family');
    if (family) name = family.split(':')[0].split(',')[0].replace(/\+/g, ' ');
  } catch (e) {
    name = input;
  }

  const sanitized = name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  
  if (!sanitized) return '';
  return sanitized.includes(' ') ? `'${sanitized}'` : sanitized;
}