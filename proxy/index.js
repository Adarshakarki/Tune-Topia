const express = require('express');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const app = express();

const ALLOWED_DOMAINS = [
  'i.scdn.co', 'api.tidal.com', 'resources.tidal.com',
  'monochrome.tf', 'samidy.com', 'squid.wtf',
  'qqdl.site', 'kinoplus.online', 'p1nkhamster.xyz',
  'lossless.wtf', 'binimum.org',
  'pipedapi.kavin.rocks', 'piped-api.garudalinux.org',
  'api-piped.mha.fi', 'piped-api.lunar.icu',
  'yt.artemislena.eu', 'pipedapi.at.as641.net',
  'i.ytimg.com', 'nhac.com.vn'
];

function isPrivateIP(ip) {
  if (!net.isIP(ip)) return true;

  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') || ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') || ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') || ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') || ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') || ip.startsWith('172.31.') ||
    ip.startsWith('127.') ||
    ip === '::1' ||
    ip.startsWith('fc') || ip.startsWith('fd')
  );
}

async function isSafeHost(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    return !addresses.some(addr => isPrivateIP(addr.address));
  } catch {
    return false;
  }
}

app.get('/proxy', async (req, res) => {
  const { url: targetUrl } = req.query;
  if (!targetUrl) return res.status(400).send("Missing url.");

  try {
    const parsedUrl = new URL(targetUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(403).send("Invalid protocol.");
    }

    if (parsedUrl.port && !['80', '443', ''].includes(parsedUrl.port)) {
      return res.status(403).send("Invalid port.");
    }

    const isWhitelisted = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isWhitelisted) {
      return res.status(403).send(`Forbidden host: ${hostname}`);
    }

    const safe = await isSafeHost(hostname);
    if (!safe) {
      return res.status(403).send("Blocked internal IP.");
    }

    const response = await axios.get(parsedUrl.href, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxRedirects: 0,
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        'User-Agent': 'SecureProxy/1.0'
      }
    });

    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }

    res.send(response.data);

  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ success: false, error: "Fetch failed." });
  }
});

app.listen(3000, () => {
  console.log('Secure proxy running on http://localhost:3000');
});