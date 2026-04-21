// Account
import * as UI from '../app/ui.js'
import State from '../app/state.js'
import * as Capsule from './capsule.js'
import { escHtml } from '../api/utils.js'

const $ = (id) => document.getElementById(id)

let _editing = false, _showPage = null;

const _safeImg = (url) => {
  if (!url) return '';
  try {
    const { protocol, href } = new URL(url);
    return ['https:', 'http:', 'data:'].includes(protocol) ? href : '';
  } catch { return ''; }
};

export function render() {
  _sync();
  Capsule.render();
}

export function initEvents(showFn) {
  _showPage = showFn;

  $('home-account-btn')?.addEventListener('click', () => { 
    _sync();
    $('profile-popup-sheet')?.classList.add('open');
    UI.setMainContentOverlayState(true);
  });
  $('profile-popup-overlay')?.addEventListener('click', _close);
  
  // Popup
  const routes = { 
    'popup-goto-profile': 'account', 
    'popup-goto-settings': 'settings', 
    'popup-goto-about': 'about'
  };
  Object.entries(routes).forEach(([id, pg]) => $(id)?.addEventListener('click', () => { _close(); _showPage(pg); }));

  $('profile-settings-btn')?.addEventListener('click', () => _showPage('settings'));

  // Edit
  $('profile-edit-btn')?.addEventListener('click', () => {
    _editing = !_editing;
    $('profile-edit-section').style.display = _editing ? 'block' : 'none';
    if (_editing) {
      const u = State.get('user');
      if ($('username-input')) $('username-input').value = u.name || '';
      if ($('pfp-url-input')) $('pfp-url-input').value = u.pfp || '';
      if ($('cover-url-input')) $('cover-url-input').value = u.cover || '';
      if ($('bio-input')) $('bio-input').value = u.bio || '';
      for (let i = 1; i <= 4; i++) {
        const input = $(`social-${i}-input`);
        if (input) input.value = u.socials?.[i - 1]?.url || '';
      }
      _syncEl('pfp-edit-img', 'pfp-edit-preview', u.pfp || '');
    }
  });

  $('profile-cancel-btn')?.addEventListener('click', () => { _editing = false; $('profile-edit-section').style.display = 'none'; });
  $('pfp-url-input')?.addEventListener('input', () => _syncEl('pfp-edit-img', 'pfp-edit-preview', $('pfp-url-input').value.trim()));

  $('profile-save-btn')?.addEventListener('click', () => {
    const n = $('username-input')?.value.trim() || 'Friend', p = $('pfp-url-input')?.value.trim() || '';
    const c = $('cover-url-input')?.value.trim() || '', b = $('bio-input')?.value.trim() || '';
    const socials = [1, 2, 3, 4].map(i => ({ url: $(`social-${i}-input`)?.value.trim() })).filter(s => s.url);

    State.set('user.name', n);
    State.set('user.pfp', p);
    State.set('user.cover', c);
    State.set('user.bio', b);
    State.set('user.socials', socials);
    UI.renderGreeting();
    import('../app/init.js').then(m => m.renderAccountBtn());
    _editing = false; $('profile-edit-section').style.display = 'none'; _sync();
    UI.toast('Profile saved');
  });

  Capsule.initEvents();
}

const _close = () => { 
  $('profile-popup-sheet')?.classList.remove('open');
  UI.setMainContentOverlayState(false);
};

function _syncEl(imgId, wrapId, url) {
  const img = $(imgId), wrap = $(wrapId), safe = _safeImg(url);
  if (!img || !wrap) return;
  img.src = safe; img.style.display = safe ? 'block' : 'none';
  const ph = wrap.querySelector('.pfp-placeholder');
  if (ph) ph.style.display = safe ? 'none' : 'flex';
}

function _getSocialInfo(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    const is = (d) => domain === d || domain.endsWith('.' + d);
    if (is('pinterest.com')) return { icon: 'pinterest', name: 'Pinterest' };
    if (is('instagram.com')) return { icon: 'instagram', name: 'Instagram' };
    if (is('github.com')) return { icon: 'github', name: 'GitHub' };
    if (is('twitter.com') || is('x.com')) return { icon: 'twitter-x', name: 'Twitter' };
    if (is('youtube.com') || is('youtu.be')) return { icon: 'youtube', name: 'YouTube' };
    if (is('linkedin.com')) return { icon: 'linkedin', name: 'LinkedIn' };
    if (is('facebook.com')) return { icon: 'facebook', name: 'Facebook' };
    if (is('discord.com') || is('discord.gg')) return { icon: 'discord', name: 'Discord' };
    if (is('spotify.com')) return { icon: 'spotify', name: 'Spotify' };
    return { icon: 'link-45deg', name: 'Link' };
  } catch {
    return { icon: 'link-45deg', name: 'Link' };
  }
}

function _sync() {
  const u = State.get('user') || {};
  const name = u.name || 'Friend', pfp = u.pfp || '', cover = u.cover || '', bio = u.bio || '';
  const socials = u.socials || [];

  if ($('profile-display-name')) $('profile-display-name').textContent = name;
  if ($('profile-bio')) $('profile-bio').textContent = bio;

  _syncEl('pfp-img', 'pfp-preview', pfp);

  const card = document.querySelector('.account-card');
  if (card) {
    const safeCover = _safeImg(cover);
    // Default gradient
    const defaultDesign = 'radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)';
    card.style.backgroundImage = safeCover ? `url('${safeCover}')` : defaultDesign;
  }

  const socialList = $('profile-social-links');
  if (socialList) {
    socialList.innerHTML = socials.slice(0, 4).map(s => {
      const info = _getSocialInfo(s.url);
      return `<a href="${escHtml(s.url)}" target="_blank" class="account-social-pill">
        <i class="bi bi-${info.icon}"></i> <span>${info.name}</span>
      </a>`;
    }).join('');
  }

  if ($('pfp-popup-name')) $('pfp-popup-name').textContent = name;
  _syncEl('pfp-popup-img', 'pfp-popup-wrap', pfp);
}