const PARAMETRIC_PRESETS = {
  "Flat": [0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [8, 6, 2, 0, 0, 0, 0],
  "Treble Boost": [0, 0, 0, 0, 2, 5, 9],
  "Pop": [2, 3, 1, 0, 1, 2, 3],
  "Rock": [4, 3, 1, -1, 1, 2, 4],
  "Electronic": [7, 5, 1, -1, 2, 4, 6],
  "Vocal": [-4, -2, 0, 3, 4, 2, -1]
};

export class ParametricEq {
  constructor(processor) {
    this.processor = processor;
    this.storageKey = 'tt_para_eq_state';
    this.bands = [
      { type: 'peaking',  f: 40,    q: 1.2, g: 0, label: 'Sub'      },
      { type: 'peaking',  f: 100,   q: 1.2, g: 0, label: 'Bass'     },
      { type: 'peaking',  f: 300,   q: 1.2, g: 0, label: 'Low Mid'  },
      { type: 'peaking',  f: 1000,  q: 1.2, g: 0, label: 'Mid'      },
      { type: 'peaking',  f: 3000,  q: 1.2, g: 0, label: 'High Mid' },
      { type: 'peaking',  f: 8000,  q: 1.2, g: 0, label: 'Treble'   },
      { type: 'peaking',  f: 16000, q: 1.2, g: 0, label: 'Air'      },
    ];
    this.colors = [
      '#ff6b9d', // Sub      - Pink
      '#ff9f43', // Bass     - Orange
      '#ffd32a', // Low Mid  - Yellow
      '#4cd137', // Mid      - Green
      '#48dbfb', // High Mid - Cyan
      '#7f8ff4', // Treble   - Indigo
      '#e056fd', // Air      - Magenta
    ];
    this.enabled = false;
    this.draggingIndex = -1;
    this.preamp = 0;
    this.canvas = null;
    this._nodePos = [];
    this._W = 0;
    this._H = 0;
    this._dpr = 1;
    this._animFrame = null;
    this._resizeObserver = null;
    this._load();
  }

  // --- Persistence ---

  _load() {
    const saved = localStorage.getItem(this.storageKey);
    this.enabled = localStorage.getItem('tt_eq_enabled') === 'true';
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Array.isArray(data.bands)) {
          data.bands.forEach((b, i) => {
            if (!this.bands[i]) return;
            // Force peaking behavior for all bands to ensure local movement
            if (b.type === 'lowshelf' || b.type === 'highshelf') b.type = 'peaking';
            Object.assign(this.bands[i], b);
          });
        }
        this.preamp  = data.preamp  || 0;
      } catch (e) {}
    }
    this.sync();
  }

  _save() {
    localStorage.setItem(this.storageKey, JSON.stringify({
      bands:   this.bands,
      preamp:  this.preamp,
    }));
    localStorage.setItem('tt_eq_enabled', String(this.enabled));
  }

  // --- Audio Processor Bridge ---

  sync() {
    if (!this.enabled) {
      this.processor.resetParaEQ();
      this.processor.setNormalizationGain(1.0);
      return;
    }
    this.bands.forEach((b, i) => this.processor.setParaBand(i, b));
    this.processor.setNormalizationGain(Math.pow(10, this.preamp / 20));
  }

  updateBand(index, params) {
    const b = this.bands[index];
    if (!b) return;
    Object.assign(b, params);
    if (this.enabled) this.processor.setParaBand(index, b);
    this._save();
  }

  toggle(state) {
    this.enabled = state ?? !this.enabled;
    this.sync();
    this._save();
  }

  applyPreset(name) {
    const gains = PARAMETRIC_PRESETS[name];
    if (!gains) return;
    if (name === 'Flat') this.preamp = 0;
    this.bands.forEach((b, i) => {
      if (gains[i] !== undefined) b.g = gains[i];
    });
    this.sync();
    this._save();
    this.drawResponse();
  }

  // --- Coordinate Helpers ---

  get _PAD() { return { L: 38, R: 12, T: 12, B: 26 }; }

  _xFromF(f) {
    const { L, R } = this._PAD;
    const w = this._W - L - R;
    return L + w * Math.log10(f / 20) / Math.log10(1000);
  }

  _fFromX(x) {
    const { L, R } = this._PAD;
    const w = this._W - L - R;
    return 20 * Math.pow(1000, (x - L) / w);
  }

  _yFromDB(db) {
    const { T, B } = this._PAD;
    const h = this._H - T - B;
    return T + h * (0.5 - db / 36);   // +/- 18 dB range
  }

  _dbFromY(y) {
    const { T, B } = this._PAD;
    const h = this._H - T - B;
    return (0.5 - (y - T) / h) * 36;
  }

  // --- Biquad Math ---
  // Exact H(z) magnitude calculation for frequency response visualization

  _bandResponseDB(band, freq) {
    // g=0 is always identity, return early to avoid floating-point shelf artifacts
    if (band.g === 0) return 0;

    const SR    = this.processor.getContext()?.sampleRate || 48000;
    const w0    = 2 * Math.PI * band.f / SR;
    const A     = Math.pow(10, band.g / 40);
    const cos0  = Math.cos(w0);
    const sin0  = Math.sin(w0);
    const alpha = sin0 / (2 * band.q);
    let b0, b1, b2, a0, a1, a2;

    if (band.type === 'peaking') {
      b0 = 1 + alpha * A;  b1 = -2 * cos0;  b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;  a1 = -2 * cos0;  a2 = 1 - alpha / A;
    } else if (band.type === 'lowshelf') {
      const sa = 2 * Math.sqrt(A) * alpha;
      b0 =      A * ((A + 1) - (A - 1) * cos0 + sa);
      b1 =  2 * A * ((A - 1) - (A + 1) * cos0     );
      b2 =      A * ((A + 1) - (A - 1) * cos0 - sa);
      a0 =          (A + 1) + (A - 1) * cos0 + sa;
      a1 = -2 *    ((A - 1) + (A + 1) * cos0     );
      a2 =          (A + 1) + (A - 1) * cos0 - sa;
    } else {
      // highshelf
      const sa = 2 * Math.sqrt(A) * alpha;
      b0 =      A * ((A + 1) + (A - 1) * cos0 + sa);
      b1 = -2 * A * ((A - 1) + (A + 1) * cos0     );
      b2 =      A * ((A + 1) + (A - 1) * cos0 - sa);
      a0 =          (A + 1) - (A - 1) * cos0 + sa;
      a1 =  2 *    ((A - 1) - (A + 1) * cos0     );
      a2 =          (A + 1) - (A - 1) * cos0 - sa;
    }

    // Exact H(z) magnitude: evaluate numerator and denominator as complex numbers
    const w    = 2 * Math.PI * freq / SR;
    const cw   = Math.cos(w),   sw  = Math.sin(w);
    const c2w  = Math.cos(2*w), s2w = Math.sin(2*w);

    const BRe = b0 + b1 * cw + b2 * c2w;
    const BIm =    - b1 * sw - b2 * s2w;
    const ARe = a0 + a1 * cw + a2 * c2w;
    const AIm =    - a1 * sw - a2 * s2w;

    const magSq = (BRe*BRe + BIm*BIm) / (ARe*ARe + AIm*AIm);
    return 10 * Math.log10(Math.max(1e-15, magSq));
  }

  // --- Canvas Drawing ---

  drawResponse() {
    if (!this.canvas) return;
    cancelAnimationFrame(this._animFrame);
    this._animFrame = requestAnimationFrame(() => this._draw());
  }

  _draw() {
    if (!this.canvas || this._W <= 0 || this._H <= 0) return;
    
    const ctx = this.canvas.getContext('2d');
    const { L, R, T, B } = this._PAD;
    const W = this._W, H = this._H;
    const plotW = W - L - R, plotH = H - T - B;

    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, W, H);

    // ── Grid ──────────────────────────────────────────────────────────────────

    const DB_MARKS   = [14, 9, 4, -1, -6, -11, -16];
    const FREQ_MARKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;

    DB_MARKS.forEach(db => {
      const y = this._yFromDB(db);
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
    });
    FREQ_MARKS.forEach(f => {
      const x = this._xFromF(f);
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, H - B); ctx.stroke();
    });

    // 0 dB centre line
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    const y0 = this._yFromDB(0);
    ctx.beginPath(); ctx.moveTo(L, y0); ctx.lineTo(W - R, y0); ctx.stroke();

    // ── Axis Labels ───────────────────────────────────────────────────────────

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    DB_MARKS.forEach(db => ctx.fillText(db, L - 5, this._yFromDB(db)));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    FREQ_MARKS.forEach(f => {
      const label = f >= 1000 ? (f / 1000) + 'k' : String(f);
      ctx.fillText(label, this._xFromF(f), H - B + 5);
    });

    // ── Per-band response curves ──────────────────────────────────────────────

    const N = Math.ceil(plotW);
    const freqs = Array.from({ length: N }, (_, i) => this._fFromX(L + i));
    const bandDBs = this.bands.map(b => freqs.map(f => this._bandResponseDB(b, f)));

    this.bands.forEach((band, bi) => {
      if (band.g === 0 && !this.enabled) return;
      const color = this.colors[bi];
      const [r, g, bv] = [
        parseInt(color.slice(1,3), 16),
        parseInt(color.slice(3,5), 16),
        parseInt(color.slice(5,7), 16),
      ];

      // Fill
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = L + i, y = this._yFromDB(bandDBs[bi][i] + this.preamp);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const py0 = this._yFromDB(this.preamp);
      ctx.lineTo(L + N - 1, py0);
      ctx.lineTo(L, py0);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${bv},0.12)`;
      ctx.fill();

      // Stroke
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = L + i, y = this._yFromDB(bandDBs[bi][i] + this.preamp);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${r},${g},${bv},0.55)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // ── Total response (white) ────────────────────────────────────────────────

    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const totalDB = bandDBs.reduce((s, bd) => s + bd[i], 0) + this.preamp;
      const x = L + i, y = this._yFromDB(totalDB);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── Nodes ─────────────────────────────────────────────────────────────────

    // Clip to plot area so nodes don't bleed into label gutters
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, plotW, plotH);
    ctx.clip();

    // Cache screen positions — include preamp so dots sit on the white Total Response line
    this._nodePos = this.bands.map(b => ({
      x: this._xFromF(b.f),
      y: this._yFromDB(b.g + this.preamp),
    }));

    this.bands.forEach((b, i) => {
      const { x, y } = this._nodePos[i];
      const isDrag = this.draggingIndex === i;
      const radius = isDrag ? 9 : 7;
      const color  = this.colors[i];

      // Outer glow ring when dragging
      if (isDrag) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = color + '55';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isDrag ? '#ffffff' : color;
      ctx.fill();
      ctx.strokeStyle = isDrag ? color : 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tooltip while dragging
      if (isDrag) {
        const fLabel = b.f >= 1000 ? (b.f / 1000).toFixed(1) + 'k' : Math.round(b.f);
        const gLabel = (b.g >= 0 ? '+' : '') + b.g.toFixed(1) + 'dB';
        const tip    = `${fLabel}Hz  ${gLabel}  Q${b.q.toFixed(1)}`;
        ctx.font = 'bold 10px monospace';
        const tw = ctx.measureText(tip).width;
        const tx = Math.min(Math.max(x, L + tw / 2 + 4), W - R - tw / 2 - 4);
        const ty = y - radius - 6;

        ctx.fillStyle = 'rgba(13,13,20,0.85)';
        const rx = tx - tw / 2 - 5, ry = ty - 14, rw = tw + 10, rh = 16, rad = 3;
        ctx.beginPath();
        ctx.moveTo(rx + rad, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rad);
        ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rad);
        ctx.arcTo(rx, ry + rh, rx, ry, rad);
        ctx.arcTo(rx, ry, rx + rw, ry, rad);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(tip, tx, ty);
      }
    });

    ctx.restore();
  }

  // --- Resize Canvas ---

  _resizeCanvas() {
    const cvs = this.canvas;
    if (!cvs) return;
    this._dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this._W = rect.width;
    this._H = rect.height;
    this.canvas.width  = rect.width  * this._dpr;
    this.canvas.height = rect.height * this._dpr;
  }

  // --- Render UI ---

  renderUI(container) {
    // Cleanup previous instances/listeners before re-rendering
    this._resizeObserver?.disconnect();
    this.enabled = localStorage.getItem('tt_eq_enabled') === 'true';
    if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
    if (this._onMouseUp) window.removeEventListener('mouseup', this._onMouseUp);

    container.innerHTML = `
      <div class="eq-root">
        ${this.enabled ? `
          <div class="eq-presets-scroll">
            <div class="eq-presets-list">
              ${Object.keys(PARAMETRIC_PRESETS).map(p => `
                <button class="eq-preset-btn para-preset-btn" data-preset="${p}">${p}</button>
              `).join('')}
            </div>
          </div>

          <div class="para-eq-viz">
            <canvas id="para-eq-canvas" style="display:block;width:100%;height:100%"></canvas>
          </div>

          <div class="para-preamp-row">
            <span class="para-preamp-label">Preamp</span>
            <input id="para-preamp-slider" type="range"
                   min="-12" max="12" step="0.5"
                   value="${this.preamp}"
                   class="para-preamp-slider">
            <span id="para-preamp-val" class="para-preamp-val">
              ${(this.preamp >= 0 ? '+' : '') + this.preamp.toFixed(1)} dB
            </span>
          </div>
        ` : ''}
      </div>
    `;

    // ── Canvas setup ───────────────────────────────────────────────────────────

    this.canvas = container.querySelector('#para-eq-canvas');
    if (this.canvas) {
      this._resizeCanvas();
      this.drawResponse();

      const getCanvasPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this._W / rect.width;
        const scaleY = this._H / rect.height;
        if (e.touches) {
          return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top)  * scaleY,
          };
        }
        return { x: e.offsetX * scaleX, y: e.offsetY * scaleY };
      };

      const findNearest = ({ x, y }) =>
        (this._nodePos || []).findIndex(p => Math.hypot(p.x - x, p.y - y) < 20);

      this.canvas.onmousedown = (e) => {
        this.draggingIndex = findNearest(getCanvasPos(e));
        if (this.draggingIndex !== -1) this.drawResponse();
      };

      this._onMouseMove = (e) => {
        if (this.draggingIndex === -1) return;
        const rect = this.canvas?.getBoundingClientRect();
        if (!rect) return;
        const scaleX = this._W / rect.width;
        const scaleY = this._H / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top)  * scaleY;

        this.updateBand(this.draggingIndex, {
          f: Math.max(20,    Math.min(20000, this._fFromX(x))),
          g: Math.max(-18,   Math.min(18,   this._dbFromY(y) - this.preamp)),
        });
        this.drawResponse();
      };

      this._onMouseUp = () => {
        if (this.draggingIndex !== -1) { 
          this.draggingIndex = -1; 
          this.drawResponse(); 
          this._updatePresetButtons(container);
        }
      };

      window.addEventListener('mousemove', this._onMouseMove);
      window.addEventListener('mouseup',   this._onMouseUp);

      // Touch
      this.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.draggingIndex = findNearest(getCanvasPos(e));
        if (this.draggingIndex !== -1) this.drawResponse();
      }, { passive: false });

      this.canvas.addEventListener('touchmove', (e) => {
        if (this.draggingIndex === -1) return;
        e.preventDefault();
        const { x, y } = getCanvasPos(e);
        this.updateBand(this.draggingIndex, {
          f: Math.max(20,  Math.min(20000, this._fFromX(x))),
          g: Math.max(-18, Math.min(18,   this._dbFromY(y) - this.preamp)),
        });
        this.drawResponse();
      }, { passive: false });

      this.canvas.addEventListener('touchend', () => {
        this.draggingIndex = -1; this.drawResponse();
      });

      // Scroll to adjust Q
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this._W / rect.width, scaleY = this._H / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top)  * scaleY;
        const idx = (this._nodePos || []).findIndex(p =>
          Math.hypot(p.x - x, p.y - y) < 20
        );
        if (idx === -1) return;
        this.bands[idx].q = Math.max(0.1, Math.min(10, this.bands[idx].q - e.deltaY * 0.005));
        this.updateBand(idx, { q: this.bands[idx].q });
        this.drawResponse();
      }, { passive: false });

      this._resizeObserver = new ResizeObserver(() => {
        this._resizeCanvas();
        this.drawResponse();
      });
      this._resizeObserver.observe(this.canvas);
    }

    // ── Controls ───────────────────────────────────────────────────────────────

    container.querySelectorAll('.para-preset-btn').forEach(btn => {
      btn.onclick = () => {
        this.applyPreset(btn.dataset.preset);
        this._updatePresetButtons(container);
        if (btn.dataset.preset === 'Flat') {
          const slider = container.querySelector('#para-preamp-slider');
          const valText = container.querySelector('#para-preamp-val');
          if (slider) slider.value = 0;
          if (valText) valText.textContent = '+0.0 dB';
        }
      };
    });

    const preampSlider = container.querySelector('#para-preamp-slider');
    if (preampSlider) {
      preampSlider.oninput = (e) => {
        this.preamp = parseFloat(e.target.value);
        const sign = this.preamp >= 0 ? '+' : '';
        const preampVal = container.querySelector('#para-preamp-val');
        if (preampVal) preampVal.textContent = `${sign}${this.preamp.toFixed(1)} dB`;
        if (this.enabled) this.processor.setNormalizationGain(Math.pow(10, this.preamp / 20));
        this._save();
        this.drawResponse();
      };
    }

    this.sync();
    this._updatePresetButtons(container);
  }

  _updatePresetButtons(container) {
    container.querySelectorAll('.para-preset-btn').forEach(btn => {
      const p = PARAMETRIC_PRESETS[btn.dataset.preset];
      const isMatch = p && p.every((val, idx) => this.bands[idx] && Math.abs(val - this.bands[idx].g) < 0.1);
      btn.classList.toggle('active', isMatch);
    });
  }

  // Call this before removing the EQ panel to avoid listener leaks
  destroy() {
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup',   this._onMouseUp);
    this._resizeObserver?.disconnect();
    cancelAnimationFrame(this._animFrame);
  }
}