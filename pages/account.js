import * as UI from '../app/ui.js'
import State from '../app/state.js'
import * as Capsule from './capsule.js'

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

  $('home-account-btn')?.addEventListener('click', () => { _sync(); $('profile-popup-sheet')?.classList.add('open'); });
  $('profile-popup-overlay')?.addEventListener('click', _close);
  
  // Popup actions
  const routes = { 'popup-goto-profile': 'account', 'popup-goto-settings': 'settings', 'popup-goto-about': 'about' };
  Object.entries(routes).forEach(([id, pg]) => $(id)?.addEventListener('click', () => { _close(); _showPage(pg); }));

  $('popup-signin')?.addEventListener('click', () => { _close(); UI.toast('Sign in coming soon'); });
  $('profile-settings-btn')?.addEventListener('click', () => _showPage('settings'));

  // Profile Edit
  $('profile-edit-btn')?.addEventListener('click', () => {
    _editing = !_editing;
    $('profile-edit-section').style.display = _editing ? 'block' : 'none';
    if (_editing) {
      const u = State.get('user');
      if ($('username-input')) $('username-input').value = u.name || '';
      if ($('pfp-url-input')) $('pfp-url-input').value = u.pfp || '';
      _syncEl('pfp-edit-img', 'pfp-edit-preview', u.pfp || '');
    }
  });

  $('profile-cancel-btn')?.addEventListener('click', () => { _editing = false; $('profile-edit-section').style.display = 'none'; });
  $('pfp-url-input')?.addEventListener('input', () => _syncEl('pfp-edit-img', 'pfp-edit-preview', $('pfp-url-input').value.trim()));

  $('profile-save-btn')?.addEventListener('click', () => {
    const n = $('username-input')?.value.trim() || 'Friend', p = $('pfp-url-input')?.value.trim() || '';
    State.setUser(n, p); UI.renderGreeting();
    import('../app/init.js').then(m => m.renderAccountBtn());
    _editing = false; $('profile-edit-section').style.display = 'none'; _sync();
    UI.toast('Profile saved');
  });

  $('profile-signin-btn')?.addEventListener('click', () => UI.toast('Sign in coming soon'));
  Capsule.initEvents();
}

const _close = () => $('profile-popup-sheet')?.classList.remove('open');

function _syncEl(imgId, wrapId, url) {
  const img = $(imgId), wrap = $(wrapId), safe = _safeImg(url);
  if (!img || !wrap) return;
  img.src = safe; img.style.display = safe ? 'block' : 'none';
  const ph = wrap.querySelector('.pfp-placeholder');
  if (ph) ph.style.display = safe ? 'none' : 'flex';
}

function _sync() {
  const n = State.get('user.name') || 'Friend', p = State.get('user.pfp') || '';
  if ($('profile-display-name')) $('profile-display-name').textContent = n;
  _syncEl('pfp-img', 'pfp-preview', p);
  if ($('pfp-popup-name')) $('pfp-popup-name').textContent = n;
  _syncEl('pfp-popup-img', 'pfp-popup-wrap', p);
}