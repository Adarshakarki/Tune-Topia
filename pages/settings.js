import * as UI from '../app/ui.js'
import State from '../app/state.js'
import * as Player from '../modules/player.js'
import { startLiveCheck } from '../api/status.js'
import { exportBackup, importBackup } from '../modules/backup.js'
import { escHtml } from '../api/utils.js'

const $ = (id) => document.getElementById(id)
let _stopStatus = null

export function render() {
  const theme = State.get('ui.theme') || 'light'
  $('theme-toggle-btn')?.setAttribute(
    'aria-checked',
    theme === 'dark' ? 'true' : 'false'
  )

  if (_stopStatus) {
    _stopStatus()
    _stopStatus = null
  }
  _stopStatus = startLiveCheck(_onStatusUpdate, 30000)

  renderQuality()
  renderSpeed()
  renderGapless()
  _initEQ()
}

let _eqReady = false
function _initEQ() {
  if (_eqReady) return
  const container = $('eq-container')
  if (!container) return
  import('../modules/eq.js')
    .then((EQ) => {
      EQ.init()
      _eqReady = true
    })
    .catch(() => {
      if ($('eq-container'))
        $('eq-container').innerHTML =
          '<div class="eq-loading">EQ unavailable</div>'
    })
}

export function renderQuality() {
  const saved = localStorage.getItem('tt_quality') || 'lossless'
  const subs = {
    low: 'AAC 96kbps',
    high: 'AAC 320kbps',
    lossless: 'CD Quality (FLAC)',
    hires: 'Hi-Res FLAC 24-bit',
  }
  const sub = $('quality-sub')
  if (sub) sub.textContent = subs[saved] || subs.lossless
  document
    .querySelectorAll('.quality-btn')
    .forEach((btn) =>
      btn.classList.toggle('active', btn.dataset.quality === saved)
    )
}

export function renderSpeed() {
  const saved = parseFloat(localStorage.getItem('tt_speed') || '1')
  const labels = {
    0.5: '0.5× Slow',
    0.75: '0.75× Slow',
    1: '1× Normal',
    1.25: '1.25× Fast',
    1.5: '1.5× Fast',
    2: '2× Fast',
  }
  const sub = $('speed-sub')
  if (sub) sub.textContent = labels[saved] || '1× Normal'
  document
    .querySelectorAll('.speed-btn')
    .forEach((b) =>
      b.classList.toggle('active', parseFloat(b.dataset.speed) === saved)
    )
  document.querySelectorAll('audio,video').forEach((el) => {
    el.playbackRate = saved
  })
}

export function renderGapless() {
  const on = localStorage.getItem('tt_gapless') === 'true'
  $('gapless-toggle')?.setAttribute('aria-checked', String(on))
}

export function initEvents() {
  $('quality-options')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.quality-btn')
    if (!btn) return
    localStorage.setItem('tt_quality', btn.dataset.quality)
    renderQuality()
  })

  $('speed-options')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.speed-btn')
    if (!btn) return
    const speed = parseFloat(btn.dataset.speed)
    localStorage.setItem('tt_speed', speed)
    renderSpeed()
    UI.toast(`Playback speed: ${speed}×`)
  })

  // Apply speed on track change
  Player.on('trackChanged', () => {
    const speed = parseFloat(localStorage.getItem('tt_speed') || '1')
    if (speed !== 1)
      setTimeout(() => {
        document.querySelectorAll('audio,video').forEach((el) => {
          el.playbackRate = speed
        })
      }, 300)
  })

  $('gapless-toggle')?.addEventListener('click', function () {
    const on = this.getAttribute('aria-checked') === 'true'
    localStorage.setItem('tt_gapless', String(!on))
    renderGapless()
    UI.toast(on ? 'Gapless playback off' : 'Gapless playback on')
  })

  $('theme-toggle-btn')?.addEventListener('click', function () {
    const isDark = this.getAttribute('aria-checked') === 'true'
    const next = isDark ? 'light' : 'dark'
    this.setAttribute('aria-checked', String(!isDark))
    State.setTheme(next)
    UI.applyTheme(next)
  })

  $('backup-export-btn')?.addEventListener('click', () => exportBackup(State))
  $('backup-import-btn')?.addEventListener('click', () =>
    importBackup(
      State,
      () => {
        UI.toast('✓ Backup restored')
        render()
      },
      (err) => UI.toast(`Import failed: ${err}`)
    )
  )
}

function _onStatusUpdate(groups) {
  ;[
    ['status-api-list', 'api'],
    ['status-streaming-list', 'streaming'],
  ].forEach(([id, key]) => {
    const el = $(id)
    if (!el) return
    el.innerHTML = (groups[key] || [])
      .map(
        (item) => `
      <div class="status-row">
        <div class="status-dot ${item.online ? 'online' : 'offline'}"></div>
        <span class="status-url">${escHtml(item.url)}</span>
        <span class="status-latency ${item.online ? 'online' : 'offline'}">${item.online ? 'online' : 'offline'}</span>
      </div>`
      )
      .join('')
  })
}
