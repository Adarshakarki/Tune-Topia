const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const app = express();

// --- CONFIGURATION ---
const ALLOWED_DOMAINS = [
  'i.scdn.co', 'api.tidal.com', 'resources.tidal.com',
  'monochrome.tf', 'samidy.com', 'squid.wtf',
  'qqdl.site', 'kinoplus.online', 'p1nkhamster.xyz',
  'lossless.wtf', 'binimum.org',
  'pipedapi.kavin.rocks', 'piped-api.garudalinux.org',
  'api-piped.mha.fi', 'piped-api.lunar.icu',
  'yt.artemislena.eu', 'pipedapi.at.as641.net',
  'i.ytimg.com', 'googlevideo.com', 'nhac.com.vn',
  'workers.dev'
];

app.get('/proxy', async (req, res) => {
  const { url: targetUrl } = req.query;
  if (!targetUrl) return res.status(400).send("Missing url.");

  try {
    const parsedUrl = new URL(targetUrl);
    
    // 1. Protocol Guard
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(403).send("Invalid protocol.");
    }

    // 2. Domain Allow-list (Includes subdomain check)
    const isWhitelisted = ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );

    if (!isWhitelisted) {
      return res.status(403).send(`Forbidden host: ${parsedUrl.hostname}`);
    }

    // 3. The Secure Request
    // Re-serializing with .href ensures no hidden characters bypass the parser.
    // Disabling redirects prevents attackers from 'bouncing' off a safe domain.
    const response = await axios.get(parsedUrl.href, { 
      responseType: 'arraybuffer',
      timeout: 8000,
      maxRedirects: 0, 
      validateStatus: (status) => status >= 200 && status < 300
    });

    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);

  } catch (e) {
    res.status(500).json({ success: false, error: "Fetch failed." });
  }
});