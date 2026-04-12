// proxy/index.js
const express = require('express')
const axios = require('axios')
const dns = require('dns')
const net = require('net')
const cors = require('cors')
const path = require('path')
const http = require('http')
const https = require('https')

const app = express()

// -------------------- CORS --------------------
const allowedOrigins = [
  'https://adarshakarki.github.io',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        callback(null, true)
      } else {
        console.log('CORS blocked:', origin)
        callback(null, false)
      }
    },
    credentials: true,
  })
)

// -------------------- COOP/COEP --------------------
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})

// -------------------- STATIC --------------------
app.use(express.static(path.join(__dirname, '../')))

// -------------------- SSRF HELPERS --------------------
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

async function isSafeHost(hostname) {
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true })
    return !addresses.some((a) => isPrivateIP(a.address))
  } catch {
    return false
  }
}

// Prevent DNS rebinding (TOCTOU safe)
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

// -------------------- ALLOWLIST --------------------
const allowedHosts = [
  'tidal.com',
  'resources.tidal.com',
  'api.tidal.com',
  'youtube.com',
  'ytimg.com',
  'i.ytimg.com',
  'googlevideo.com',
  'wsrv.nl',
]

// -------------------- PROXY ROUTE --------------------
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) {
    return res.status(400).send('Missing url param')
  }

  try {
    const urlObj = new URL(targetUrl)

    // ---- BASIC VALIDATION ----
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).send('Invalid protocol')
    }

    if (!urlObj.hostname) {
      return res.status(400).send('Missing hostname')
    }

    if (urlObj.username || urlObj.password) {
      return res.status(400).send('Auth in URL not allowed')
    }

    if (urlObj.pathname.includes('..')) {
      return res.status(400).send('Invalid path')
    }

    // ---- HOST ALLOWLIST ----
    const hostname = urlObj.hostname.toLowerCase()
    const allowed = allowedHosts.some(
      (h) => hostname === h || hostname.endsWith('.' + h)
    )

    if (!allowed) {
      return res.status(403).send('Host not allowed')
    }

    // ---- DNS SAFETY ----
    const safe = await isSafeHost(hostname)
    if (!safe) {
      return res.status(403).send('Unsafe host')
    }

    // ---- BUILD SAFE URL (CodeQL-safe) ----
    const outboundUrl = new URL(urlObj.origin)
    outboundUrl.pathname = urlObj.pathname
    outboundUrl.search = urlObj.search

    // ---- REQUEST ----
    const response = await axios.request({
      method: 'GET',
      url: finalUrl.toString(),
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

    // ---- RESPONSE ----
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type'])
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

// -------------------- START --------------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`)
})
