import * as processor from './processor.js';

const STORAGE_KEY = 'tt_eq_gains';
const ENABLED_KEY = 'tt_eq_enabled';
const MIN_DB = -12, MAX_DB = 12;

let _gains = processor.EQ_BANDS.map(() => 0);
let _enabled = false;

// --- Persistence ---
function _save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_gains));
  localStorage.setItem(ENABLED_KEY, String(_enabled));
  _syncAudio();
}

function _load() {
  const g = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (g?.length === processor.EQ_BANDS.length) _gains = g;
  _enabled = localStorage.getItem(ENABLED_KEY) === 'true';
}

/**
 * Updates the processor.js engine with current gains.
 * If disabled, it sends 0dB (Flat) to the engine while keeping UI state.
 */
function _syncAudio() {
  if (_enabled) {
    processor.setAllBands(_gains);
  } else {
    processor.resetEQ();
  }
}

/**
 * Renders the EQ interface into a target container.
 * @param {HTMLElement} container 
 */
export function render(container) {
  if (!container) return;
  _load();

  container.innerHTML = `
    <div class="eq-root">
      ${_enabled ? `
      <div class="eq-body">
        <div class="eq-presets-scroll">
          <div class="eq-presets-list">
            ${Object.keys(processor.PRESETS).map(p => `
              <button class="eq-preset-btn" data-preset="${p}">${p}</button>
            `).join('')}
          </div>
        </div>
        <div class="eq-sliders">
        ${processor.EQ_BANDS.map((freq, i) => {
          const label = freq >= 1000 ? `${freq / 1000}k` : freq;
          const db = _gains[i];
          return `
            <div class="eq-band">
              <span class="eq-freq-label">${label}</span>
              <div class="eq-slider-outer">
              <div class="eq-slider-wrap">
                <input type="range" class="eq-slider" data-index="${i}"
                       min="${MIN_DB}" max="${MAX_DB}" step="0.5" value="${db}">
              </div>
              </div>
              <span class="eq-db-label" id="eq-val-${i}">${_fmtDb(db)}</span>
            </div>
          `;
        }).join('')}
        </div>
      </div>` : ''}
    </div>
  `;

  _attachEventListeners(container);
  _syncAudio(); // Ensure engine matches loaded state
}

function _attachEventListeners(container) {
  const sliders = container.querySelectorAll('.eq-slider');

  // Band Sliders
  sliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      const val = parseFloat(e.target.value);
      _gains[index] = val;
      const label = container.querySelector(`#eq-val-${index}`);
      if (label) label.textContent = _fmtDb(val);
      _save();
    });
  });

  // Preset Buttons
  container.querySelectorAll('.eq-preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const gains = processor.PRESETS[e.currentTarget.dataset.preset];
    if (gains) {
      _gains = [...gains];
      _save();
      _updateUIBars(container);
    }
    });
  });

  if (_enabled) _updateUIBars(container);
}

function _updateUIBars(container) {
  _gains.forEach((db, i) => {
    const slider = container.querySelector(`.eq-slider[data-index="${i}"]`);
    const label = container.querySelector(`#eq-val-${i}`);
    if (slider) slider.value = db;
    if (label) label.textContent = _fmtDb(db);
  });

  // Highlight active preset
  const presetBtns = container.querySelectorAll('.eq-preset-btn');
  presetBtns.forEach(btn => {
    const p = processor.PRESETS[btn.dataset.preset];
    const isMatch = p && p.every((val, idx) => Math.abs(val - _gains[idx]) < 0.1);
    btn.classList.toggle('active', isMatch);
  });
}

const _fmtDb = db => db === 0 ? '0' : (db > 0 ? '+' : '') + db.toFixed(1).replace('.0', '') + 'dB';

// --- Legacy API compatibility ---
export function init() { _load(); _syncAudio(); }
export const isEnabled = () => _enabled;
export const getGains = () => [..._gains];
