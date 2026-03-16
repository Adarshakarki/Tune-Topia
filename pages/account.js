import * as UI from '../app/ui.js'
import State from '../app/state.js'
import * as Capsule from './capsule.js'

const $ = (id) => document.getElementById(id)

let _editing = false
let _showPage = null

// ── Public ───────────────────────────────────────────────────────────────────

export function render() {
  _syncProfile()
  Capsule.render()
}

export function initEvents(showPageFn) {
  _showPage = showPageFn

  // Profile popup (home avatar button)
  $('home-account-btn')?.addEventListener('click', () => {
    _syncProfile()
    $('profile-popup-sheet')?.classList.add('open')
  })
  $('profile-popup-overlay')?.addEventListener('click', _closePopup)
  $('popup-goto-profile')?.addEventListener('click', () => {
    _closePopup()
    _showPage('account')
  })
  $('popup-goto-settings')?.addEventListener('click', () => {
    _closePopup()
    _showPage('settings')
  })
  $('popup-signin')?.addEventListener('click', () => {
    _closePopup()
    UI.toast('Sign in coming soon')
  })

  // Gear → settings
  $('profile-settings-btn')?.addEventListener('click', () =>
    _showPage('settings')
  )

  // Edit toggle
  $('profile-edit-btn')?.addEventListener('click', () => {
    _editing = !_editing
    $('profile-edit-section').style.display = _editing ? 'block' : 'none'
    if (_editing) {
      const ni = $('username-input')
      if (ni) ni.value = State.get('user.name') || ''
      const pi = $('pfp-url-input')
      if (pi) pi.value = State.get('user.pfp') || ''
      _syncPfpEl(
        'pfp-edit-img',
        'pfp-edit-preview',
        State.get('user.pfp') || ''
      )
    }
  })

  $('profile-cancel-btn')?.addEventListener('click', () => {
    _editing = false
    $('profile-edit-section').style.display = 'none'
  })

  $('pfp-url-input')?.addEventListener('input', () => {
    _syncPfpEl(
      'pfp-edit-img',
      'pfp-edit-preview',
      $('pfp-url-input').value.trim()
    )
  })

  $('profile-save-btn')?.addEventListener('click', () => {
    const name = $('username-input')?.value.trim() || 'Friend'
    const pfp = $('pfp-url-input')?.value.trim() || ''
    State.setUser(name, pfp)
    UI.renderGreeting()
    import('../app/init.js').then((m) => m.renderAccountBtn())
    _editing = false
    $('profile-edit-section').style.display = 'none'
    _syncProfile()
    UI.toast('Profile saved')
  })

  $('profile-signin-btn')?.addEventListener('click', () =>
    UI.toast('Sign in coming soon')
  )

  // Capsule owns its own period-btn events
  Capsule.initEvents()
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _closePopup() {
  $('profile-popup-sheet')?.classList.remove('open')
}

function _syncPfpEl(imgId, wrapId, url) {
  const img = $(imgId)
  const wrap = $(wrapId)
  if (!img || !wrap) return
  img.src = url
  img.style.display = url ? 'block' : 'none'
  const ph = wrap.querySelector('.pfp-placeholder')
  if (ph) ph.style.display = url ? 'none' : 'flex'
}

function _syncProfile() {
  const name = State.get('user.name') || 'Friend'
  const pfp = State.get('user.pfp') || ''

  const nameEl = $('profile-display-name')
  if (nameEl) nameEl.textContent = name
  _syncPfpEl('pfp-img', 'pfp-preview', pfp)

  const popupName = $('pfp-popup-name')
  if (popupName) popupName.textContent = name
  _syncPfpEl('pfp-popup-img', 'pfp-popup-wrap', pfp)
}
