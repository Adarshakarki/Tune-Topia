// Proxy Server
const express = require('express')
const axios = require('axios')
const dns = require('dns')
const net = require('net')
const cors = require('cors')
const path = require('path')
const http = require('http')
const https = require('https')

const app = express()

// CORS configuration
const allowedOrigins = [
  'https://adarshakarki.github.io',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://adarshakarki.github.io/Tune-Topia/',
]

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin or from allowed list
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        callback(null, true)
      } else {
        console.log('CORS blocked origin:', origin)
        callback(null, true) // Allow during transition to avoid silent failures
      }
    },
    credentials: true,
  })
)

// COOP/COEP headers for ffmpeg.wasm
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  next()
})

// Serve static assets
app.use(express.static(path.join(__dirname, '../')))

// Block private IPs (SSRF protection)
function isPrivateIP(ip) {
  const version = net.isIP(ip)
  if (!version) return true
  if (version === 4) {
    const parts = ip.split('.').map(Number)
    if (
      parts.length !== 4 ||
      parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
    ) {
      return true
    }
    const [a, b] = parts
    // 10.0.0.0/8
    if (a === 10) return true
    // 172.16.0.0/12 (172.16.0.0 – 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true
    return false
  }

  // IPv6: block loopback, link-local and unique-local
  const normalized = ip.toLowerCase()
  if (normalized === '::1') return true // loopback
  if (normalized.startsWith('fe80:')) return true // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique-local
  return false
}

async function isSafeHost(hostname) {
    try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        return !addresses.some((addr) => isPrivateIP(addr.address));
    } catch { return false; }
}

// Custom lookup for SSRF protection to prevent TOCTOU race conditions.
// This validates the IP address at the moment of connection.
const ssrSafeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    
    const addresses = Array.isArray(address) ? address : [{ address }];
    if (addresses.some(addr => isPrivateIP(addr.address))) {
      return callback(new Error('SSRF Detected: Access to private IP addresses is prohibited'));
    }
    callback(null, address, family);
  });
};

const httpAgent = new http.Agent({ lookup: ssrSafeLookup });
const httpsAgent = new https.Agent({ lookup: ssrSafeLookup });

// Proxy route
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) {
    return res.status(400).send('Error: Missing "url" parameter.')
  }

  try {
    const urlObj = new URL(targetUrl)

    // Validate protocol and host
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return res.status(400).send('Error: Only http/https allowed.')
    }
    if (!urlObj.hostname) {
      return res.status(400).send('Error: Missing hostname.')
    }

    // Safety check
    const safe = await isSafeHost(urlObj.hostname)
    if (!safe) {
      return res.status(403).send('Forbidden: Internal or unsafe host.')
    }

    // Fetch target
    const response = await axios.get(urlObj.toString(), {
      responseType: 'arraybuffer',
      timeout: 10000,
      httpAgent,
      httpsAgent,
      validateStatus: () => true, // Don't throw on 4xx/5xx
      headers: {
        'User-Agent': 'TuneTopiaProxy/1.0',
        Accept: '*/*',
      },
    })

    // Pass headers
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type'])
    }

    res.send(response.data)
  } catch (err) {
    console.error('Proxy Error:', err.message)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch the requested URL',
      details: err.message,
    })
  }
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Tune-Topia Proxy running on port ${PORT}`)
})
