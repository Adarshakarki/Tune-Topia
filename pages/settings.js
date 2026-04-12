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
  const n = Cache.size(), el = $('cache-size-label');
  if (el) el.textContent = n > 0 ? `${n} item${n !== 1 ? 's' : ''} cached` : 'Cache is empty';
}

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

  $('speed-options')?.addEventListener('click', e => { const btn = e.target.closest('.speed-btn'); if (!btn) return; const speed = parseFloat(btn.dataset.speed); localStorage.setItem('tt_speed', speed); renderSpeed(); UI.toast(`Playback speed: ${speed}×`); });

  Player.on('trackChanged', () => { const speed = parseFloat(localStorage.getItem('tt_speed') || '1'); if (speed !== 1) setTimeout(() => document.querySelectorAll('audio,video').forEach(el => el.playbackRate = speed), 300); });
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