const express = require('express')
const axios = require('axios')
const dns = require('dns').promises
const net = require('net')

const app = express()

// Strict service → domain mapping (no user-controlled hostnames)
const SERVICES = {
  spotify: 'i.scdn.co',
  tidal: 'api.tidal.com',
  tidal_res: 'resources.tidal.com',
  piped1: 'pipedapi.kavin.rocks',
  piped2: 'piped-api.garudalinux.org',
  piped3: 'api-piped.mha.fi',
  piped4: 'piped-api.lunar.icu',
  ytimg: 'i.ytimg.com',
  nhac: 'nhac.com.vn',
}

function isPrivateIP(ip) {
  if (!net.isIP(ip)) return true

  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('127.') ||
    ip === '::1' ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  )
}

async function isSafeHost(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    return !addresses.some((addr) => isPrivateIP(addr.address))
  } catch {
    return false
  }
}

app.get('/proxy', async (req, res) => {
  const serviceRaw = req.query.service
  const pathRaw = req.query.path ?? '/'
  const queryRaw = req.query.query ?? ''

  if (
    typeof serviceRaw !== 'string' ||
    typeof pathRaw !== 'string' ||
    typeof queryRaw !== 'string'
  ) {
    return res.status(400).send('Invalid parameters.')
  }

  const service = serviceRaw
  const path = pathRaw
  const query = queryRaw

  const hostname = SERVICES[service]
  if (!hostname) {
    return res.status(403).send('Invalid service.')
  }

  if (path.includes('..')) {
    return res.status(403).send('Invalid path.')
  }

  const safe = await isSafeHost(hostname)
  if (!safe) {
    return res.status(403).send('Blocked internal IP.')
  }

  try {
    const safeUrl = new URL(
      `https://${hostname}${path}${query ? '?' + query : ''}`
    )

    const response = await axios.get(safeUrl.toString(), {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxRedirects: 0,
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: (s) => s >= 200 && s < 300,
      headers: {
        'User-Agent': 'SecureProxy/1.0',
      },
    })

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type'])
    }

    res.send(response.data)
  } catch (err) {
    console.error('Proxy error:', err.message)
    res.status(500).json({ success: false, error: 'Fetch failed.' })
  }
})

app.listen(3000, () => {
  console.log('Secure proxy running on http://localhost:3000')
})
