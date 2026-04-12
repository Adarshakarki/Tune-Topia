// Audio Processor

let audioCtx;
let sourceNode;
let gainNode;
let eqFilters = [];
let paraFilters = [];

// Industry standard ISO 1/1 octave bands for a 10-band Equalizer
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/**
 * Descriptive metadata for each band to help users understand what they are tuning.
 */
export const BAND_METADATA = [
  { desc: "Sub-Bass", info: "Rumble and power" },
  { desc: "Bass", info: "Kick and bass punch" },
  { desc: "Low-Bass", info: "Warmth and body" },
  { desc: "Low-Mids", info: "Instrument thickness" },
  { desc: "Mids", info: "Vocal fundamentals" },
  { desc: "Upper-Mids", info: "Clarity and definition" },
  { desc: "Presence", info: "Edge and attack" },
  { desc: "Detail", info: "Sharpness" },
  { desc: "Highs", info: "Brightness" },
  { desc: "Air", info: "Breathiness and openness" }
];

export const PRESETS = {
  "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  "Treble Boost": [0, 0, 0, 0, 0, 0, 0, 2, 5, 8],
  "Pop": [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
  "Rock": [4, 3, 2, 1, -1, -2, 0, 1, 2, 3],
  "Electronic": [5, 4, 2, 0, -2, 2, 1, 1, 4, 5],
  "Vocal": [-2, -3, -3, 1, 3, 4, 4, 3, 1, -2]
};

/**
 * Initializes the audio graph.
 * Should be called once the <audio> element is available in the DOM.
 * @param {HTMLAudioElement|HTMLAudioElement[]} audioElement 
 */
export function init(elements) {
  if (audioCtx) return;
  const els = Array.isArray(elements) ? elements : [elements];

  // Initialize Context
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Entry point for all audio sources
  const inputNode = audioCtx.createGain();
  els.forEach(el => {
    audioCtx.createMediaElementSource(el).connect(inputNode);
  });

  // 1. Build Equalizer Graph
  // We chain multiple peaking filters together.
  let lastNode = inputNode;

  eqFilters = EQ_BANDS.map(freq => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.414; // Controls the bandwidth/sharpness of the band
    filter.gain.value = 0;  // Default is flat (0dB)

    lastNode.connect(filter);
    lastNode = filter;
    return filter;
  });

  // 2. Build Parametric EQ Graph (7 bands)
  const paraConfig = [
    { type: 'peaking', f: 40, q: 1.2 },
    { type: 'peaking', f: 150, q: 1.2 },
    { type: 'peaking', f: 500, q: 1.2 },
    { type: 'peaking', f: 1500, q: 1.2 },
    { type: 'peaking', f: 4500, q: 1.2 },
    { type: 'peaking', f: 9000, q: 1.2 },
    { type: 'peaking', f: 16000, q: 1.2 }
  ];

  paraFilters = paraConfig.map(conf => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = conf.type;
    filter.frequency.value = conf.f;
    filter.Q.value = conf.q;
    filter.gain.value = 0;
    lastNode.connect(filter);
    lastNode = filter;
    return filter;
  });

  // 3. Build Loudness Normalization / Master Gain
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1.0; 

  lastNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);
}

/**
 * Returns the frequency labels for the UI.
 */
export function getFrequencies() {
  return EQ_BANDS.map(f => (f >= 1000 ? `${f / 1000}kHz` : `${f}Hz`));
}

/**
 * Adjusts the gain for a specific EQ band.
 * @param {number} index - Index of the band (0-9)
 * @param {number} db - Gain in decibels (-12 to 12 is typical)
 */
export function setEQBand(index, db) {
  if (audioCtx && eqFilters[index]) {
    // Use setTargetAtTime for smooth, click-free transitions
    eqFilters[index].gain.setTargetAtTime(db, audioCtx.currentTime, 0.05);
  }
}

/**
 * Applies an entire set of gains at once (e.g., for presets).
 * @param {number[]} gains - Array of 10 gain values.
 */
export function setAllBands(gains) {
  if (!gains || gains.length !== EQ_BANDS.length) return;
  gains.forEach((db, index) => setEQBand(index, db));
}

/**
 * Adjusts a parametric band.
 */
export function setParaBand(index, params) {
  if (!audioCtx || !paraFilters[index]) return;
  const f = paraFilters[index];
  if (params.type !== undefined && f.type !== params.type) f.type = params.type;
  if (params.f !== undefined) f.frequency.setTargetAtTime(params.f, audioCtx.currentTime, 0.05);
  if (params.g !== undefined) f.gain.setTargetAtTime(params.g, audioCtx.currentTime, 0.05);
  if (params.q !== undefined) f.Q.setTargetAtTime(params.q, audioCtx.currentTime, 0.05);
}

/**
 * Resets parametric EQ.
 */
export function resetParaEQ() {
  if (!audioCtx) return;
  paraFilters.forEach(f => f.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05));
}

/**
 * Returns the internal AudioContext and filters for visualization.
 */
export const getContext = () => audioCtx;
export const getParaFilters = () => paraFilters;

/**
 * Resets all EQ bands to 0dB (Flat).
 */
export function resetEQ() {
  if (!audioCtx) return;
  eqFilters.forEach((filter) => {
    filter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  });
}

/**
 * Sets the master normalization gain.
 * @param {number} value - Linear gain multiplier (e.g., 0.8 for -2dB)
 */
export function setNormalizationGain(value) {
  if (audioCtx && gainNode) {
    gainNode.gain.setTargetAtTime(value, audioCtx.currentTime, 0.05);
  }
}

/**
 * Resumes the AudioContext. Required due to browser autoplay policies.
 */
export async function resume() {
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}