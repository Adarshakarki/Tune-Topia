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
app.use(cors({
  origin: '*',
  exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges', 'Content-Type']
}))

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})

app.use(express.static(path.join(__dirname, '../')))

// SSRF PROTECTION
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

// safe DNS lookup wrapper
const safeLookup = (hostname, options, cb) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return cb(err)

    const list = Array.isArray(address) ? address : [{ address }]
    if (list.some(a => isPrivateIP(a.address))) {
      return cb(new Error('Blocked private IP'))
    }

    cb(null, address, family)
  })
}

const httpAgent = new http.Agent({ lookup: safeLookup })
const httpsAgent = new https.Agent({ lookup: safeLookup })

// HOST ALLOWLIST
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
  'cdn.jsdelivr.net'
]

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
  'tidal-api.binimum.org'
]

function isAllowedHost(hostname) {
  return (
    mediaHosts.some(h => hostname === h || hostname.endsWith('.' + h)) ||
    apiHosts.some(h => hostname === h || hostname.endsWith('.' + h))
  )
}

// PROXY ROUTE
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url

  if (!targetUrl || targetUrl === 'undefined') {
    return res.status(400).send('Missing url parameter')
  }

  try {
    const urlObj = new URL(targetUrl)
    const hostname = urlObj.hostname.toLowerCase()

    // basic validation
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return res.status(400).send('Invalid protocol')
    }

    if (urlObj.username || urlObj.password) {
      return res.status(400).send('Auth not allowed')
    }

    if (urlObj.pathname.includes('..')) {
      return res.status(400).send('Invalid path')
    }

    if (!isAllowedHost(hostname)) {
      return res.status(403).send('Host not allowed')
    }

    // DNS SSRF check
    const safe = await dns.promises.lookup(hostname, { all: true })
    if (safe.some(a => isPrivateIP(a.address))) {
      return res.status(403).send('Blocked unsafe IP')
    }

    // HEADERS
    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive',
      'Origin': 'https://listen.tidal.com',
      'Referer': 'https://listen.tidal.com/'
    }

    if (req.headers.range) {
      proxyHeaders.Range = req.headers.range
    }

    // FETCH STREAM 
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream',
      decompress: false,
      timeout: 20000,
      maxRedirects: 5,
      httpAgent,
      httpsAgent,
      validateStatus: () => true,
      headers: proxyHeaders
    })

    // RESPONSE HEADERS
    res.status(response.status)

    const headers = response.headers

    if (headers['content-type']) {
      res.setHeader('Content-Type', headers['content-type'].split(';')[0])
    }

    if (headers['content-length']) {
      res.setHeader('Content-Length', headers['content-length'])
    }

    if (headers['content-range']) {
      res.setHeader('Content-Range', headers['content-range'])
    }

    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // STREAM SAFETY
    response.data.on('error', (err) => {
      console.error('Stream error:', err.message)
      res.destroy()
    })

    req.on('close', () => {
      response.data.destroy()
    })

    response.data.pipe(res)

  } catch (err) {
    console.error('Proxy error:', err.message)
    res.status(500).json({
      success: false,
      error: 'Proxy failed',
      details: err.message
    })
  }
})

// START SERVER
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`)
})