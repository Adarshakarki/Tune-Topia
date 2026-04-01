import * as UI from '../app/ui.js';
import * as Router from '../app/router.js';

const $ = (id) => document.getElementById(id);

let _rendered = false;

export function init() {
  $('about-back-btn')?.addEventListener('click', close);
  
  // Wire up the About button in the Profile Popup
  $('About')?.addEventListener('click', () => {
    Router.showPage('about');
    // The profile popup sheet usually closes automatically on navigation in this app's architecture
  });
}

export function render() {
  if (!_rendered) {
    _render();
    _rendered = true;
  }
  if ($('page-about')) $('page-about').scrollTop = 0;
}

export function open() {
  const page = $('page-about');
  if (!page) return;

  if (!_rendered) {
    _render();
    _rendered = true;
  }

  page.scrollTop = 0;
  page.classList.add('open');
  document.body.style.overflow = 'hidden';
  UI.updatePlayerPosition();
}

export function close() {
  $('page-about')?.classList.remove('open');
  document.body.style.overflow = '';
  UI.updatePlayerPosition();
}

function _render() {
  const container = $('about-content');
  if (!container) return;

  container.innerHTML = `
    <div class="about-hero">
      <div class="about-logo">
        <i class="bi bi-music-note-beamed"></i>
      </div>
      <h1>TuneTopia</h1>
      <p class="about-tagline">Music without the noise.</p>
    </div>

    <div class="about-section">
      <h2>Our Philosophy</h2>
      <p>
        TuneTopia was built on the belief that music streaming should be clean, modular, and private. 
        We provide a premium experience without subscriptions, advertisements, or invasive tracking.
      </p>
    </div>

    <div class="about-grid">
      <div class="about-card">
        <i class="bi bi-disc"></i>
        <h3>High-Fidelity</h3>
        <p>Streaming in Lossless FLAC and Hi-Res formats via Tidal's open proxy network.</p>
      </div>
      <div class="about-card">
        <i class="bi bi-youtube"></i>
        <h3>Smart Fallback</h3>
        <p>Seamlessly switches to YouTube (Invidious) when Tidal tracks are unavailable.</p>
      </div>
      <div class="about-card">
        <i class="bi bi-shield-check"></i>
        <h3>Privacy First</h3>
        <p>No account required. Your library and Sound Capsule stats stay on your device.</p>
      </div>
      <div class="about-card">
        <i class="bi bi-lightning-charge"></i>
        <h3>Gapless Power</h3>
        <p>Dual audio buffering with 10-band equalization and custom crossfade support.</p>
      </div>
    </div>

    <div class="about-section stats-preview">
      <h2>Sound Capsule</h2>
      <p>
        More than just a player—TuneTopia tracks your listening habits locally to generate 
        detailed heatmaps, peak hour analysis, and artist discovery stats.
      </p>
    </div>

    <div class="about-footer">
      <div class="about-meta">
        <span>Version 1.0.0</span>
        <span>•</span>
        <span>Warm Espresso Palette</span>
      </div>
      <p>Built for audiophiles and privacy advocates everywhere.</p>
      <div class="about-links">
        <a href="https://github.com/Adarshakarki/Tune-Topia" target="_blank">
          <i class="bi bi-github"></i> GitHub
        </a>
        <a href="#" id="about-shortcuts-trigger">
          <i class="bi bi-keyboard"></i> Shortcuts
        </a>
      </div>
    </div>
  `;

  $('about-shortcuts-trigger')?.addEventListener('click', (e) => {
    e.preventDefault();
    UI.toast(
      '⌨️ Space: Play/Pause | Arrows: Seek | Shift+Arrows: Skip | M: Mute | S: Shuffle | R: Repeat',
      5000
    );
  });
}