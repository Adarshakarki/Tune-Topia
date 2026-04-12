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
    const validatedBaseURL = (urlObj.protocol === 'https:' ? 'https://' : 'http://') + hostname;

    const response = await axios.request({
      method: 'GET',
      baseURL: validatedBaseURL,
      url: urlObj.pathname + urlObj.search,
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

// Start
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`)
})
