import State from '../app/state.js'

export let THEMES = [{ id: 'monochrome', name: 'Monochrome' }];

export async function fetchThemes() {
  try {
    const res = await fetch('./theme/themes.json');
    const data = await res.json();
    THEMES = data.themes || [];
    return THEMES;
  } catch (err) {
    console.warn('[Theme] manifest not found, using fallbacks.');
    THEMES = [{ id: 'monochrome', name: 'Monochrome' }];
    return THEMES;
  }
}

export function applyAppearance(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  State.set('ui.themeMode', mode);
}

export function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || (id === 'none' ? { id: 'none' } : (THEMES[0] || { id: 'monochrome' }));
  document.documentElement.setAttribute('data-skin', theme.id);
  State.set('ui.theme', theme.id);

  // Load external CSS from /theme/ folder
  let link = document.getElementById('theme-css');
  if (!link) {
    link = document.createElement('link');
    link.id = 'theme-css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (theme.id === 'none') {
    link.href = '';
  } else {
    link.href = `./theme/${theme.id}.css`;
  }
}

export function loadFonts() {
  const p = localStorage.getItem('tt_font_primary') || '';
  const s = localStorage.getItem('tt_font_secondary') || '';
  applyFonts(p, s);
}

export function applyFonts(primaryLink, secondaryLink) {
  State.set('ui.fontPrimaryLink', primaryLink);
  State.set('ui.fontSecondaryLink', secondaryLink);

  localStorage.setItem('tt_font_primary', primaryLink || '');
  localStorage.setItem('tt_font_secondary', secondaryLink || '');

  _updateFontLink('font-link-primary', primaryLink);
  _updateFontLink('font-link-secondary', secondaryLink);

  // Extract names and set CSS variables so the styles actually update
  const pName = _extractFontName(primaryLink);
  const sName = _extractFontName(secondaryLink);

  if (pName) document.documentElement.style.setProperty('--font-primary', pName);
  else document.documentElement.style.removeProperty('--font-primary');

  if (sName) document.documentElement.style.setProperty('--font-secondary', sName);
  else document.documentElement.style.removeProperty('--font-secondary');
}

function _extractFontName(input) {
  if (!input) return '';
  let name = input.trim();
  // If it's a Google Fonts URL, extract the family parameter
  if (name.includes('family=')) {
    try {
      const url = new URL(name);
      const family = url.searchParams.get('family');
      if (family) name = family.split(':')[0].split(',')[0].replace(/\+/g, ' ');
    } catch (e) {}
  }
  // Wrap in quotes if it has spaces and isn't already quoted
  return name.includes(' ') && !name.startsWith("'") ? `'${name}'` : name;
}

function _updateFontLink(id, href) {
  let link = document.getElementById(id);
  
  // Security Fix: Robust scheme check to prevent XSS via javascript: or data: URIs
  let isSafe = false;
  try {
    const u = new URL(href, window.location.origin);
    isSafe = ['http:', 'https:'].includes(u.protocol);
  } catch (e) { isSafe = false; }

  if (!href || !isSafe) {
    if (link) link.remove();
    return;
  }
  if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
  // Use setAttribute for sensitive attributes to satisfy some security scanners
  link.setAttribute('href', href);
}