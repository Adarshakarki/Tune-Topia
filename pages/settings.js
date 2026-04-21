// Settings
import * as UI from '../app/ui.js'
import State from '../app/state.js'
import * as Player from '../modules/player.js'
import { startLiveCheck } from '../api/status.js'
import { exportBackup, importBackup } from '../modules/backup.js'
import { escHtml } from '../api/utils.js'
import * as Cache from '../modules/cache.js'
import * as processor from '../modules/processor.js'
import { ParametricEq } from '../modules/parametricEq.js'
import * as Theme from '../modules/theme.js'

const $ = (id) => document.getElementById(id)
let _stopStatus = null

function _renderCacheSize() {
  const stats = Cache.getStats(), el = $('cache-size-label');
  if (el) el.textContent = stats.usage > 0 ? `${stats.text} items cached` : 'Cache is empty';
}

export function renderShortcuts() {
  const container = $('shortcuts-container');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-row no-border">
      <div class="settings-row-info">
        <span class="settings-row-label">Custom Bindings</span>
        <span class="settings-row-sub">View and edit keyboard shortcuts</span>
      </div>
      <button class="settings-save-btn btn-nowrap" id="open-shortcuts-btn">Manage</button>
    </div>`;
}

const KEY_SYMBOLS = {
  Control: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Meta: '⌘',
  Space: 'Space', ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓',
  Slash: '/', Backslash: '\\', BracketRight: ']', BracketLeft: '[', Comma: ',',
  Period: '.', Semicolon: ';', Quote: "'", Backquote: '`', Minus: '-', Equal: '=',
  Enter: '↵', Backspace: '⌫', Tab: '⇥', Escape: '⎋'
};

function _fmtK(code) {
  if (!code) return '...';
  return code.split('+').map(part => {
    if (KEY_SYMBOLS[part]) return KEY_SYMBOLS[part];
    if (part.startsWith('Key')) return part.slice(3);
    if (part.startsWith('Digit')) return part.slice(5);
    return part;
  }).join('+');
}

export function renderFullShortcutsList() {
  const container = $('shortcuts-list-container');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem('tt_shortcuts') || '{}');
  const map = { ...DEFAULT_SHORTCUTS, ...saved };

  container.innerHTML = Object.entries(SHORTCUT_LABELS).map(([action, label]) => `
    <div class="settings-row">
      <div class="settings-row-info">
        <div class="settings-row-label">${label}</div>
      </div>
      <div class="shortcut-actions">
        <kbd class="shortcut-key-trigger" data-action="${action}">${_fmtK(map[action])}</kbd>
        <button class="shortcut-reset-btn" data-action="${action}" title="Reset to default">
          ${UI.getIcon('refresh')}
        </button>
      </div>
    </div>`).join('');
}

const DEFAULT_SHORTCUTS = { toggle: 'Space', next: 'KeyN', prev: 'KeyP', seekFwd: 'ArrowRight', seekBack: 'ArrowLeft', volUp: 'ArrowUp', volDown: 'ArrowDown', mute: 'KeyM', shuffle: 'KeyS', repeat: 'KeyR', home: 'KeyH', search: 'Slash', settings: 'KeyI' };
const SHORTCUT_LABELS = { toggle: 'Play / Pause', next: 'Next Track', prev: 'Previous Track', seekFwd: 'Seek Forward', seekBack: 'Seek Backward', volUp: 'Volume Up', volDown: 'Volume Down', mute: 'Mute Toggle', shuffle: 'Toggle Shuffle', repeat: 'Toggle Repeat', home: 'Go to Home (Index)', search: 'Go to Search', settings: 'Open Settings' };

// Update
let _waitingWorker = null

function _hookSW() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) {
      _waitingWorker = reg.waiting
      _setUpdateAvailable()
    }
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing
      if (!nw) return
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          _waitingWorker = nw
          _setUpdateAvailable()
        }
      })
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
}

function _setUpdateAvailable() {
  const row = $('update-available-row')
  const lbl = $('update-status-label')
  if (row) row.style.display = ''
  if (lbl) lbl.textContent = 'Update ready to install'
}

async function _checkForUpdate() {
  const btn  = $('check-update-btn')
  const icon = $('check-update-icon')
  const lbl  = $('update-status-label')

  if (icon) icon.style.animation = 'tt-spin 1s linear infinite'
  if (lbl)  lbl.textContent = 'Checking…'
  $('update-available-row') && ($('update-available-row').style.display = 'none')

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) await reg.update()
    }

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }

    if (_waitingWorker) {
      _setUpdateAvailable()
    } else {
      if (lbl) lbl.textContent = "You're up to date ✓"
    }
  } catch (err) {
    if (lbl) { lbl.textContent = 'Could not check — try again'; }
  } finally {
    if (icon) icon.style.animation = ''
  }
}

function _applyUpdate() {
  if (_waitingWorker) {
    _waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  } else {
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => location.reload(true))
    } else {
      location.reload(true)
    }
  }
}

function _injectSpinStyle() {
  if (document.getElementById('tt-spin-style')) return
  const s = document.createElement('style')
  s.id = 'tt-spin-style'
  s.textContent = '@keyframes tt-spin { to { transform: rotate(360deg); } }'
  document.head.appendChild(s)
}

// UI
export function render() {
  const cached = Cache.get('status_check');
  if (cached) _onStatusUpdate(cached);

  if (_stopStatus) { _stopStatus(); _stopStatus = null; }
  _stopStatus = startLiveCheck(groups => {
    Cache.set('status_check', groups);
    _onStatusUpdate(groups);
  }, 300000);

  renderQuality()
  renderSpeed()
  renderGapless()
  renderThemes()
  Theme.loadFonts();
  renderFonts();
  _renderCacheSize()
  renderShortcuts();
  renderDownloadQuality()
  _initEqualizers()
  _injectSpinStyle()
  _hookSW()
}

let _paraEqInstance = null;

async function _initEqualizers() {
  const card = document.querySelector('.eq-card');
  if (!card) return;

  const masterToggle = $('eq-master-toggle');
  const contentWrap = $('eq-content-wrap');
  const container = $('eq-container');

  const refreshUI = async () => {
    const enabled = localStorage.getItem('tt_eq_enabled') === 'true';
    const mode = localStorage.getItem('tt_eq_mode') || 'legacy';

    masterToggle?.setAttribute('aria-checked', String(enabled));
    card.querySelector('.settings-row')?.classList.toggle('no-border', !enabled);
    if (contentWrap) contentWrap.style.display = enabled ? 'block' : 'none';

    if (enabled && container) {
      card.querySelectorAll('.eq-type-btn').forEach(b => b.classList.toggle('active', b.dataset.eqType === mode));
      if (mode === 'legacy') {
        const EQ = await import('../modules/eq.js');
        EQ.render(container);
      } else {
        if (!_paraEqInstance) _paraEqInstance = new ParametricEq(processor);
        _paraEqInstance.renderUI(container);
      }
    }
  };

  masterToggle.onclick = () => {
    const isNowEnabled = masterToggle.getAttribute('aria-checked') !== 'true';
    localStorage.setItem('tt_eq_enabled', String(isNowEnabled));

    // If disabling, explicitly reset the audio processor to a flat response
    if (!isNowEnabled) {
      processor.resetEQ();
      processor.resetParaEQ();
      processor.setNormalizationGain(1.0);
    }

    refreshUI();
  };

  card.querySelectorAll('.eq-type-btn').forEach(btn => {
    btn.onclick = () => {
      localStorage.setItem('tt_eq_mode', btn.dataset.eqType);
      refreshUI();
    };
  });

  refreshUI();
}

// Stream
export function renderQuality() {
  const saved = localStorage.getItem('tt_quality') || 'lossless'
  const subs = { hires: 'Hi-Res FLAC 24-bit', lossless: 'CD Quality (FLAC)', high: 'AAC 320kbps', low: 'AAC 96kbps' }
  const sub = $('quality-sub');
  if (sub) sub.textContent = subs[saved] || subs.lossless;
  $('quality-options')?.querySelectorAll('.quality-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.quality === saved));
}

// Download
export function renderDownloadQuality() {
  const saved = localStorage.getItem('tt_download_quality') || 'mp3_320'
  const subs = {
    hires: 'FLAC (Hi-Res)',
    lossless: 'FLAC (Lossless)',
    mp3_320: 'MP3 320kbps',
    mp3_256: 'MP3 256kbps',
    mp3_96: 'MP3 96kbps',
    aac_320: 'AAC 320kbps',
    aac_256: 'AAC 256kbps',
    aac_96: 'AAC 96kbps',
    ogg_320: 'OGG 320kbps',
    ogg_256: 'OGG 256kbps',
    ogg_96: 'OGG 96kbps'
  }
  const sub = $('download-quality-sub');
  if (sub) sub.textContent = subs[saved] || subs.mp3_320;
  $('download-quality-options')?.querySelectorAll('.quality-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.quality === saved));
}

// Speed
export function renderSpeed() {
  const saved = parseFloat(localStorage.getItem('tt_speed') || '1')
  const labels = { 0.5: '0.5× Slow', 0.75: '0.75× Slow', 1: '1× Normal', 1.25: '1.25× Fast', 1.5: '1.5× Fast', 2: '2× Fast' }
  const sub = $('speed-sub');
  if (sub) sub.textContent = labels[saved] || '1× Normal';
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === saved));
  document.querySelectorAll('audio,video').forEach(el => el.playbackRate = saved);
}

// Gapless
export function renderGapless() {
  const on = localStorage.getItem('tt_gapless') === 'true'
  $('gapless-toggle')?.setAttribute('aria-checked', String(on))
}

// Themes
export async function renderThemes() {
  await Theme.fetchThemes();
  const currentSkin = State.get('ui.theme') || 'dark';
  const mode = State.get('ui.themeMode') || 'dark';
  
  $('appearance-toggle')?.setAttribute('aria-checked', mode === 'dark' ? 'true' : 'false');

  const select = $('theme-select');
  if (select) {
    select.innerHTML = '<option value="default">Default</option>' +
      Theme.THEMES.map(t => `<option value="${t.id}" ${t.id === currentSkin ? 'selected' : ''}>${t.name}</option>`).join('');
  }
}

// Fonts
export function renderFonts() {
  if ($('primary-font-input')) $('primary-font-input').value = State.get('ui.fontPrimaryLink') || '';
  if ($('secondary-font-input')) $('secondary-font-input').value = State.get('ui.fontSecondaryLink') || '';
}

// Events
export function initEvents() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.quality-btn');
    if (!btn || !btn.dataset.quality) return;

    const streamingContainer = btn.closest('#quality-options');
    const downloadContainer = btn.closest('#download-quality-options');

    if (streamingContainer) {
      localStorage.setItem('tt_quality', btn.dataset.quality);
      renderQuality();
    } else if (downloadContainer) {
      localStorage.setItem('tt_download_quality', btn.dataset.quality);
      renderDownloadQuality();
      const label = btn.querySelector('.quality-label')?.textContent || btn.textContent;
      UI.toast(`Download quality: ${label}`);
    }
  });

  $('shortcuts-container')?.addEventListener('click', e => {
    if (e.target.id === 'open-shortcuts-btn') {
      renderFullShortcutsList();
      $('shortcuts-sheet')?.classList.add('open');
      UI.setMainContentOverlayState(true);
    }
  });

  $('shortcuts-sheet')?.addEventListener('click', e => {
    const trigger = e.target.closest('.shortcut-key-trigger');
    const resetItemBtn = e.target.closest('.shortcut-reset-btn');

    if (trigger) {
      const action = trigger.dataset.action;
      trigger.classList.add('active');
      trigger.textContent = '...';

      const capture = (ke) => {
        // Ignore if only a modifier is pressed (allows holding Shift/Ctrl)
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(ke.key)) {
          ke.preventDefault();
          return;
        }

        ke.preventDefault(); ke.stopPropagation();

        const mods = [];
        if (ke.ctrlKey) mods.push('Control');
        if (ke.altKey) mods.push('Alt');
        if (ke.shiftKey) mods.push('Shift');
        if (ke.metaKey) mods.push('Meta');

        const combo = (mods.length ? mods.join('+') + '+' : '') + ke.code;

        const saved = JSON.parse(localStorage.getItem('tt_shortcuts') || '{}');
        saved[action] = combo;
        localStorage.setItem('tt_shortcuts', JSON.stringify(saved));
        
        window.removeEventListener('keydown', capture, { capture: true });
        trigger.classList.remove('active');
        renderFullShortcutsList();
        UI.toast(`Mapped ${SHORTCUT_LABELS[action]} to ${_fmtK(combo)}`);
      };

      window.addEventListener('keydown', capture, { capture: true });
    }

    if (resetItemBtn) {
      const action = resetItemBtn.dataset.action;
      const saved = JSON.parse(localStorage.getItem('tt_shortcuts') || '{}');
      if (saved[action]) {
        delete saved[action];
        localStorage.setItem('tt_shortcuts', JSON.stringify(saved));
        renderFullShortcutsList();
        UI.toast(`Reset ${SHORTCUT_LABELS[action]} to default`);
      }
    }

    if (e.target.id === 'shortcuts-sheet-reset') {
      if (confirm('Reset all shortcuts?')) {
        localStorage.removeItem('tt_shortcuts');
        renderFullShortcutsList();
        UI.toast('Shortcuts reset');
      }
    }

    if (e.target.id === 'shortcuts-sheet-overlay' || e.target.id === 'shortcuts-sheet-close') {
      $('shortcuts-sheet')?.classList.remove('open');
      UI.setMainContentOverlayState(false);
    }
  });

  $('speed-options')?.addEventListener('click', e => { const btn = e.target.closest('.speed-btn'); if (!btn) return; const speed = parseFloat(btn.dataset.speed); localStorage.setItem('tt_speed', speed); renderSpeed(); UI.toast(`Playback speed: ${speed}×`); });
  $('gapless-toggle')?.addEventListener('click', function () { const on = this.getAttribute('aria-checked') === 'true'; localStorage.setItem('tt_gapless', String(!on)); renderGapless(); UI.toast(on ? 'Gapless playback off' : 'Gapless playback on'); });


  $('appearance-toggle')?.addEventListener('click', function() {
    const isDark = this.getAttribute('aria-checked') === 'true';
    Theme.applyAppearance(isDark ? 'light' : 'dark');
    this.setAttribute('aria-checked', String(!isDark));
  });

  $('theme-select')?.addEventListener('change', (e) => {
    Theme.applyTheme(e.target.value);
  });

  $('fonts-save-btn')?.addEventListener('click', () => {
    const p = $('primary-font-input').value.trim();
    const s = $('secondary-font-input').value.trim();
    Theme.applyFonts(p, s);
    UI.toast('Typography links applied');
  });

  $('fonts-clear-btn')?.addEventListener('click', () => {
    if (confirm('Reset typography to system defaults?')) {
      Theme.applyFonts('', '');
      if ($('primary-font-input')) $('primary-font-input').value = '';
      if ($('secondary-font-input')) $('secondary-font-input').value = '';
      UI.toast('Typography reset to default');
    }
  });

  $('clear-cache-btn')?.addEventListener('click', () => { Cache.clear(); _renderCacheSize(); UI.toast('Cache cleared'); });

  $('backup-export-btn')?.addEventListener('click', () => exportBackup(State));
  $('backup-import-btn')?.addEventListener('click', () => importBackup(State, () => { UI.toast('✓ Backup restored'); render(); }, err => UI.toast(`Import failed: ${err}`)));

  $('check-update-btn')?.addEventListener('click', _checkForUpdate)
  $('install-update-btn')?.addEventListener('click', _applyUpdate)
}

// API Health UI
function _onStatusUpdate(groups) {
  [['status-api-list', 'api'], ['status-streaming-list', 'streaming']].forEach(([id, key]) => {
    const el = $(id);
    if (!el) return;
    el.innerHTML = (groups[key] || []).map(item => `
      <div class="status-row">
        <div class="status-dot ${item.online ? 'online' : 'offline'}"></div>
        <span class="status-url">${escHtml(item.url)}</span>
        <span class="status-latency ${item.online ? 'online' : 'offline'}">${item.online ? 'online' : 'offline'}</span>
      </div>`).join('');
    if (!el.innerHTML) el.innerHTML = `<div class="status-loading">${UI.getIcon('refresh', 'spinning')} Checking…</div>`;
  })
}