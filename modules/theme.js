/* modules/theme.js */

import State from '../app/state.js'

export let THEMES = [{ id: 'monochrome', name: 'Monochrome' }];

/**
 * Fetch theme manifest and update global list
 */
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

/**
 * Apply appearance mode (Light/Dark/System)
 */
export function applyAppearance(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  State.set('ui.themeMode', mode);
}

/**
 * Apply a specific skin/theme by ID
 */
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
  
  // Note: Local paths are inherently safe from SSRF/XSS as they are hardcoded
  if (theme.id === 'none') {
    link.href = '';
  } else {
    link.href = `./theme/${theme.id}.css`;
  }
}

/**
 * Load saved fonts from localStorage on startup
 */
export function loadFonts() {
  const p = localStorage.getItem('tt_font_primary') || '';
  const s = localStorage.getItem('tt_font_secondary') || '';
  applyFonts(p, s);
}

/**
 * Update font links in head and set CSS variables
 */
export function applyFonts(primaryLink, secondaryLink) {
  State.set('ui.fontPrimaryLink', primaryLink);
  State.set('ui.fontSecondaryLink', secondaryLink);

  localStorage.setItem('tt_font_primary', primaryLink || '');
  localStorage.setItem('tt_font_secondary', secondaryLink || '');

  _updateFontLink('font-link-primary', primaryLink);
  _updateFontLink('font-link-secondary', secondaryLink);

  const pName = _extractFontName(primaryLink);
  const sName = _extractFontName(secondaryLink);

  // Sanitized CSS Variable updates to prevent property injection
  const root = document.documentElement.style;
  if (pName) root.setProperty('--font-primary', pName);
  else root.removeProperty('--font-primary');

  if (sName) root.setProperty('--font-secondary', sName);
  else root.removeProperty('--font-secondary');
}

/**
 * INTERNAL: Securely updates <link> tags in the document head.
 * Satisfies CodeQL Rule js/xss-through-dom
 */
function _updateFontLink(id, href) {
  let link = document.getElementById(id);
  
  if (!href) {
    if (link) link.remove();
    return;
  }

  // 1. URL Validation & Re-serialization (The "Sanitizer Pattern")
  // By passing the user-provided string through the URL constructor and only using
  // the resulting .href property, we ensure the string is a valid, well-formed URL.
  let validatedHref = '';
  try {
    const url = new URL(href);
    // Strict protocol check: Only allow web schemes to prevent javascript: or data: URIs
    if (['http:', 'https:'].includes(url.protocol)) {
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

  // 2. Safe DOM Injection
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  
  // Use the re-serialized 'validatedHref' to prevent XSS
  link.setAttribute('href', validatedHref);
}

/**
 * INTERNAL: Extracts the font-family name from a Google Fonts URL or raw string.
 * Strips special characters to prevent CSS injection.
 */
function _extractFontName(input) {
  if (!input) return '';
  
  let name = '';
  try {
    const url = new URL(input);
    const family = url.searchParams.get('family');
    // Extract first family name, e.g., "Roboto:400" -> "Roboto"
    if (family) name = family.split(':')[0].split(',')[0].replace(/\+/g, ' ');
  } catch (e) {
    // If not a URL, treat as raw font name
    name = input;
  }

  // 3. CSS Injection Guard: Strip anything that isn't alphanumeric, space, or hyphen
  const sanitized = name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  
  if (!sanitized) return '';
  // Wrap in single quotes if it has spaces for CSS syntax compatibility
  return sanitized.includes(' ') ? `'${sanitized}'` : sanitized;
}