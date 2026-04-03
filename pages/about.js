const $ = (id) => document.getElementById(id);

let _rendered = false;

export function render() {
  if (!_rendered) {
    _render();
    _rendered = true;
  }
  if ($('page-about')) $('page-about').scrollTop = 0;
}

function _render() {
  const container = $('about-content');
  if (!container) return;

  container.innerHTML = `
    <div class="about-container">
      <div class="about-header">
        <img src="assets/circularlogo.png" alt="Tune Topia Logo" class="about-app-logo">
        <h1 class="about-app-title">Tune Topia</h1>
        <p class="about-app-desc">
          A high-fidelity, privacy-focused music streaming experience. 
          Built for pure sound without the tracking or advertisements.
        </p>
      </div>

      <div class="about-features-list">
        <div class="about-feature">
          <i class="bi bi-patch-check-fill"></i>
          <span>Audiophile Grade (FLAC/Hi-Res)</span>
        </div>
        <div class="about-feature">
          <i class="bi bi-incognito"></i>
          <span>Privacy First & Local Storage</span>
        </div>
        <div class="about-feature">
          <i class="bi bi-lightning-charge-fill"></i>
          <span>Gapless Playback</span>
        </div>
        <div class="about-feature">
          <i class="bi bi-save-fill"></i>
          <span>PWA support</span>
        </div>
      </div>
      <div class="developer-card">
        <div class="dev-card-inner">
          <div class="dev-card-front">
            <img src="https://github.com/Adarshakarki.png" alt="Adarsha Karki" class="dev-avatar">
            <div class="dev-info">
              <div class="dev-label">DEVELOPER</div>
              <div class="dev-name">Adarsha Karki</div>
              <div class="dev-role">Pendejo</div>
              <div class="dev-email">contact@tunetopia.app</div>
            </div>
          </div>
        </div>
      </div>

      <div class="about-social">
        <a href="https://github.com/Adarshakarki/Tune-Topia" target="_blank" class="github-link-btn">
          <i class="bi bi-github"></i>
          <span>GitHub Repository</span>
        </a>
      </div>
    </div>
  `;
}