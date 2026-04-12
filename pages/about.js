// About
const $ = (id) => document.getElementById(id)
let _rendered = false

// Build-time version fallback (inject via Vite/Webpack: define: { APP_VERSION: '"1.2.3"' })
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

async function fetchSWVersion(timeoutMs = 3000) {
  const versionEl = $('app-version')
  if (!versionEl) return

  const setLoading = (text, loaded = false) => {
    versionEl.textContent = text
    versionEl.classList.toggle('loaded', loaded)
  }

  try {
    if (!navigator.serviceWorker) {
      throw new Error('Service Worker not supported')
    }

    // Wait for registration to be ready
    const registration = await navigator.serviceWorker.ready
    
    // Get the best available worker: controlling → waiting → active
    const worker = navigator.serviceWorker.controller 
      || registration.waiting 
      || registration.active

    if (!worker) {
      throw new Error('No active Service Worker found')
    }

    const channel = new MessageChannel()
    
    // Promise that resolves on valid response or rejects on timeout/error
    const versionPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Version request timed out'))
      }, timeoutMs)

      const cleanup = () => {
        clearTimeout(timeoutId)
        channel.port1.onmessage = null
        channel.port1.onerror = null
      }

      channel.port1.onmessage = (event) => {
        cleanup()
        if (event.data?.version) {
          resolve(event.data.version)
        } else {
          reject(new Error('Invalid version payload'))
        }
      }
      
      channel.port1.onerror = (err) => {
        cleanup()
        reject(err)
      }
    })

    // Send message with port transfer
    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2])

    const version = await versionPromise
    setLoading(version, true)
    
  } catch (error) {
    console.warn('⚠️ SW version fetch failed:', error.message)
    // Graceful fallback to build-time version or placeholder
    setLoading(FALLBACK_VERSION || 'v?', !!FALLBACK_VERSION)
  }
}

function _listenForSWUpdates() {
  if (!navigator.serviceWorker) return
  
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // When a new SW takes control, refresh the displayed version
    fetchSWVersion()
  })
}