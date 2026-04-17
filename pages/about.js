// About
const $ = (id) => document.getElementById(id)
let _rendered = false

const FALLBACK_VERSION = typeof APP_VERSION !== 'undefined' ? APP_VERSION : null

export function render() {
  if (!_rendered) {
    _render()
    _rendered = true
    // Listen for SW updates while page is open
    _listenForSWUpdates()
  }
  
  // Reset scroll position if page exists
  const aboutPage = $('page-about')
  if (aboutPage) aboutPage.scrollTop = 0
}

function _render() {
  const container = $('about-content')
  if (!container) return

  container.innerHTML = `
    <div class="about-container">
      <div class="about-header">
        <img src="assets/circularlogo.png" alt="Logo" class="about-app-logo">
        <h1 class="about-app-title">Tune Topia</h1>
        <p class="about-app-desc">A high-fidelity, privacy-focused music streaming experience. 
        Built for pure sound without the tracking or advertisements.</p>
      </div>

      <div class="about-features-list">
        <div class="about-feature"><i class="bi bi-patch-check-fill"></i> <span>Hi-Res FLAC</span></div>
        <div class="about-feature"><i class="bi bi-incognito"></i> <span>Privacy First</span></div>
        <div class="about-feature"><i class="bi bi-save-fill"></i> <span>PWA Support</span></div>
      </div>

      <div class="developer-card">
        <div class="dev-card-inner">
          <div class="dev-card-front">
            <img src="https://github.com/Adarshakarki.png" alt="Adarsha Karki" class="dev-avatar">
            <div class="dev-info">
              <div class="dev-name">Adarsha Karki</div>
              <div class="dev-role">Pendejo</div>
              <div class="dev-contact">Send hand written letter and no other ways to contact</div>
            </div>
          </div>
        </div>
      </div>

      <div class="about-social">
        <a href="https://github.com/Adarshakarki/Tune-Topia" target="_blank" class="github-link-btn">
          <i class="bi bi-github"></i> <span>Source Code</span>
        </a>
      </div>

      <div class="about-footer-minimal">
        <span id="app-version" class="version-placeholder">Checking version...</span>
      </div>
    </div>
  `

  // Fetch and display SW version after DOM is ready
  fetchSWVersion()
}

async function fetchSWVersion() {
  const versionEl = $('app-version')
  if (!versionEl) return

  const _setVersion = (v, ok = false) => {
    versionEl.textContent = v
    versionEl.classList.toggle('loaded', ok)
  }

  if (!navigator.serviceWorker) {
    return _setVersion(FALLBACK_VERSION || 'v?', !!FALLBACK_VERSION)
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const worker = navigator.serviceWorker.controller 
      || registration.waiting 
      || registration.active

    if (!worker) throw new Error()

    const channel = new MessageChannel()
    const versionPromise = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(), 1000)
      channel.port1.onmessage = (event) => {
        clearTimeout(t)
        if (event.data?.version) resolve(event.data.version)
        else reject()
      }
    })

    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2])

    const version = await versionPromise
    _setVersion(version, true)
  } catch (error) {
    _setVersion(FALLBACK_VERSION || 'v?', !!FALLBACK_VERSION)
  }
}

function _listenForSWUpdates() {
  if (!navigator.serviceWorker) return
  
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // When a new SW takes control, refresh the displayed version
    fetchSWVersion()
  })
}