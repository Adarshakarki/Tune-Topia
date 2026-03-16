const BANDS = [
  { freq: 32, type: 'lowshelf', label: '32' },
  { freq: 64, type: 'peaking', label: '64' },
  { freq: 125, type: 'peaking', label: '125' },
  { freq: 250, type: 'peaking', label: '250' },
  { freq: 500, type: 'peaking', label: '500' },
  { freq: 1000, type: 'peaking', label: '1K' },
  { freq: 2000, type: 'peaking', label: '2K' },
  { freq: 4000, type: 'peaking', label: '4K' },
  { freq: 8000, type: 'peaking', label: '8K' },
  { freq: 16000, type: 'highshelf', label: '16K' },
]

const STORAGE_KEY = 'tt_eq_gains'
const ENABLED_KEY = 'tt_eq_enabled'
const MIN_DB = -12
const MAX_DB = 12

export const PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [+8, +6, +4, 0, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, +2, +4, +6, +8, +8],
  vocal: [-2, -1, 0, +3, +5, +5, +3, 0, -1, -2],
  pop: [-1, 0, +2, +4, +5, +3, +2, +1, 0, -1],
  rock: [+5, +3, 0, -1, -2, 0, +2, +4, +5, +5],
  jazz: [+3, +2, 0, +2, 0, 0, -2, 0, +2, +3],
  classical: [0, 0, 0, 0, 0, 0, -4, -4, -4, -6],
  hiphop: [+5, +5, +2, 0, -1, -1, +2, +3, +2, +1],
}

let _gains = BANDS.map(() => 0)
let _enabled = false

function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_gains))
    localStorage.setItem(ENABLED_KEY, String(_enabled))
  } catch {}
}

function _load() {
  try {
    const g = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (Array.isArray(g) && g.length === BANDS.length) _gains = g
  } catch {}
  _enabled = localStorage.getItem(ENABLED_KEY) === 'true'
}

export function setGain(bandIndex, db) {
  if (bandIndex < 0 || bandIndex >= BANDS.length) return
  _gains[bandIndex] = Math.max(MIN_DB, Math.min(MAX_DB, db))
  _save()
}

export function getGains() {
  return [..._gains]
}
export function isEnabled() {
  return _enabled
}
export function connectAudio() {} // no-op until DSP phase
export function resumeContext() {} // no-op until DSP phase

export function setEnabled(val) {
  _enabled = Boolean(val)
  _save()
  _updateToggleBtn()
}

export function applyPreset(name) {
  const gains = PRESETS[name]
  if (!gains) return
  gains.forEach((db, i) => {
    _gains[i] = db
  })
  _save()
  _renderUI()
}

export function reset() {
  _gains = BANDS.map(() => 0)
  _save()
  _renderUI()
}

export function init() {
  _load()
  _renderUI()
}

function _renderUI() {
  const container = document.getElementById('eq-container')
  if (!container) return

  container.innerHTML = `
    <div class="eq-header">
      <span class="eq-title">Equalizer</span>
      <button class="eq-toggle-btn ${_enabled ? 'active' : ''}" id="eq-toggle-btn">
        ${_enabled ? 'On' : 'Off'}
      </button>
    </div>
    <div class="eq-presets" id="eq-presets">
      ${Object.keys(PRESETS)
        .map(
          (p) =>
            `<button class="eq-preset-btn" data-preset="${p}">${_cap(p)}</button>`
        )
        .join('')}
    </div>
    <div class="eq-sliders">
      ${BANDS.map(
        (band, i) => `
        <div class="eq-band">
          <span class="eq-db-label" id="eq-db-${i}">${_fmtDb(_gains[i])}</span>
          <div class="eq-slider-wrap">
            <input class="eq-slider" type="range" id="eq-band-${i}"
              min="${MIN_DB}" max="${MAX_DB}" step="0.5" value="${_gains[i]}"
              style="writing-mode:vertical-lr;direction:rtl"
              ${_enabled ? '' : 'disabled'}/>
          </div>
          <span class="eq-freq-label">${band.label}</span>
        </div>`
      ).join('')}
    </div>
    <button class="eq-reset-btn" id="eq-reset-btn">Reset</button>`

  document.getElementById('eq-toggle-btn')?.addEventListener('click', () => {
    setEnabled(!_enabled)
    _renderUI()
  })

  BANDS.forEach((_, i) => {
    const slider = document.getElementById(`eq-band-${i}`)
    const label = document.getElementById(`eq-db-${i}`)
    slider?.addEventListener('input', () => {
      const db = parseFloat(slider.value)
      setGain(i, db)
      if (label) label.textContent = _fmtDb(db)
      _highlightPreset()
    })
  })

  document.getElementById('eq-presets')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.eq-preset-btn')
    if (!btn) return
    applyPreset(btn.dataset.preset)
    _syncSliders()
    _highlightPreset(btn.dataset.preset)
  })

  document.getElementById('eq-reset-btn')?.addEventListener('click', () => {
    reset()
    _syncSliders()
    _highlightPreset('flat')
  })

  _highlightPreset()
}

function _updateToggleBtn() {
  const btn = document.getElementById('eq-toggle-btn')
  if (!btn) return
  btn.textContent = _enabled ? 'On' : 'Off'
  btn.classList.toggle('active', _enabled)
  BANDS.forEach((_, i) => {
    const s = document.getElementById(`eq-band-${i}`)
    if (s) s.disabled = !_enabled
  })
}

function _syncSliders() {
  BANDS.forEach((_, i) => {
    const s = document.getElementById(`eq-band-${i}`)
    const l = document.getElementById(`eq-db-${i}`)
    if (s) s.value = _gains[i]
    if (l) l.textContent = _fmtDb(_gains[i])
  })
}

function _highlightPreset(forceName) {
  document.querySelectorAll('.eq-preset-btn').forEach((btn) => {
    const active = forceName
      ? btn.dataset.preset === forceName
      : PRESETS[btn.dataset.preset]?.every((db, i) => db === _gains[i])
    btn.classList.toggle('active', active)
  })
}

function _fmtDb(db) {
  if (db === 0) return '0'
  return (db > 0 ? '+' : '') + db.toFixed(1).replace('.0', '')
}

function _cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
