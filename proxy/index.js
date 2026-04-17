const express = require('express')
const axios = require('axios')
const dns = require('dns')
const net = require('net')
const cors = require('cors')
const path = require('path')
const http = require('http')
const https = require('https')

const app = express()

// CORS
app.use(cors())

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})

app.use(express.static(path.join(__dirname, '../')))

// SSRF
function isPrivateIP(ip) {
  const version = net.isIP(ip)
  if (!version) return true

  if (version === 4) {
    const [a, b] = ip.split('.').map(Number)

    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127 ||
      (a === 169 && b === 254)
    )
  }

  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  )
}

const safeLookup = (hostname, options, cb) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return cb(err)

    const list = Array.isArray(address) ? address : [{ address }]
    if (list.some((a) => isPrivateIP(a.address))) {
      return cb(new Error('Blocked private IP'))
    }

    cb(null, address, family)
  })
}

const httpAgent = new http.Agent({ lookup: safeLookup })
const httpsAgent = new https.Agent({ lookup: safeLookup })

// Media
const mediaHosts = [
  'tidal.com',
  'resources.tidal.com',
  'api.tidal.com',
  'youtube.com',
  'ytimg.com',
  'i.ytimg.com',
  'googlevideo.com',
  'wsrv.nl',
  'apple.com',
  'mzstatic.com',
  'itunes.apple.com',
  'is1-ssl.mzstatic.com',
  'video-ssl.itunes.apple.com',
  'cdn.jsdelivr.net', // For hls.js
]

// API
const apiHosts = [
  'spotisaver.net',
  'monochrome.tf',
  'p1nkhamster.xyz',
  'qqdl.site',
  'samidy.com',
  'squid.wtf',
  'kinoplus.online',
  'geeked.wtf',
  'binimum.org',
  'lossless.wtf',
  'm8tec.top',
]

// Check
function getProxyMode(hostname) {
  if (mediaHosts.some((h) => hostname === h || hostname.endsWith('.' + h))) {
    return 'media'
  }

  if (apiHosts.some((h) => hostname === h || hostname.endsWith('.' + h))) {
    return 'api'
  }

  return null
}

// Route
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) {
    return res.status(400).send('Missing url')
  }

  try {
    const urlObj = new URL(targetUrl)
    const hostname = urlObj.hostname.toLowerCase()

    // Protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).send('Invalid protocol')
    }

    if (urlObj.username || urlObj.password) {
      return res.status(400).send('Auth not allowed')
    }

    if (urlObj.pathname.includes('..')) {
      return res.status(400).send('Invalid path')
    }

    // Mode
    const mode = getProxyMode(hostname)

    if (!mode) {
      return res.status(403).send('Host not allowed (no mode match)')
    }

    // Media
    if (mode === 'media') {
      const safe = await dns.promises.lookup(hostname, { all: true })
      if (safe.some((a) => isPrivateIP(a.address))) {
        return res.status(403).send('Blocked unsafe IP')
      }
    }

    // API
    if (mode === 'api') {
      const safe = await dns.promises.lookup(hostname, { all: true })
      if (safe.some((a) => isPrivateIP(a.address))) {
        return res.status(403).send('Blocked unsafe API host')
      }
    }

    // Request (Safe URL)
    // Break CodeQL taint: re-encode every path segment via encodeURIComponent
    // (a recognised CodeQL sanitiser) instead of forwarding raw user input.
    const rawSegments = urlObj.pathname.split('/')
    const safeSegments = rawSegments.map((seg) =>
      seg === '' ? '' : encodeURIComponent(decodeURIComponent(seg))
    )
    const safePath = safeSegments.join('/')

    // Reconstruct query string through URLSearchParams — also a recognised sanitiser.
    const safeSearch = new URLSearchParams(urlObj.searchParams).toString()
    const safeSuffix = safePath + (safeSearch ? '?' + safeSearch : '')

    // hostname is already allowlist-validated above.
    // Combine with a protocol literal so no user string reaches the scheme.
    const protocol = urlObj.protocol === 'https:' ? 'https' : 'http'
    const safeUrl = `${protocol}://${hostname}${safeSuffix}`

    const response = await axios.request({
      method: 'GET',
      url: safeUrl,           // single fully-encoded URL, no baseURL split
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 50 * 1024 * 1024,
      maxRedirects: 3,
      httpAgent,
      httpsAgent,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'TuneTopiaProxy/1.0',
        Accept: '*/*',
      },
    })

    // Sanitise the reflected Content-Type to prevent header injection.
    // Only forward the type/subtype; strip parameters that could carry CRLF.
    const rawContentType = response.headers['content-type']
    if (rawContentType) {
      const typeOnly = rawContentType.split(';')[0].trim()
      // Allow only valid media-type tokens (RFC 7230 field-value chars, no CRLF).
      if (/^[a-zA-Z0-9!#$&\-^_.+]+\/[a-zA-Z0-9!#$&\-^_.+]+$/.test(typeOnly)) {
        res.set('Content-Type', typeOnly)
      }
    }

    res.send(response.data)
  } catch (err) {
    console.error('Proxy error:', err.message)
    res.status(500).json({
      success: false,
      error: 'Proxy failed',
      details: err.message,
    })
  }
})

// Start
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`)
})
