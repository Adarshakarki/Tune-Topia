const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { URL } = require('url');
const app = express();

app.use(cors());

// --- CONFIGURATION ---
const ALLOWED_DOMAINS = [
  // Music Services (Tidal/Spotify)
  'i.scdn.co', 'api.tidal.com', 'resources.tidal.com',
  'monochrome.tf', 'samidy.com', 'squid.wtf',
  'qqdl.site', 'kinoplus.online', 'p1nkhamster.xyz',
  'lossless.wtf', 'binimum.org',
  
  // YouTube/Piped Instances
  'pipedapi.kavin.rocks', 'piped-api.garudalinux.org',
  'api-piped.mha.fi', 'piped-api.lunar.icu',
  'yt.artemislena.eu', 'pipedapi.at.as641.net',
  
  // YouTube Assets
  'i.ytimg.com', 'googlevideo.com', 'nhac.com.vn',
  
  // Infrastructure
  'workers.dev'
];

// --- PROXY LOGIC ---
app.get('/proxy', async (req, res) => {
  const { url: targetUrl } = req.query;

  if (!targetUrl) return res.status(400).send("Missing url parameter.");

  try {
    const parsedUrl = new URL(targetUrl);
    
    // Validate domain against whitelist (includes subdomains)
    const isWhitelisted = ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );

    if (!isWhitelisted) {
      return res.status(403).send(`Access denied for: ${parsedUrl.hostname}`);
    }

    // Fetch target resource as binary data
    const response = await axios.get(targetUrl, { 
      responseType: 'arraybuffer',
      timeout: 8000 // Increased slightly for high-res audio streams
    });

    // Forward original content-type and data
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);

  } catch (e) {
    // Log detailed error internally for Render Dashboard debugging
    console.error(`[${new Date().toISOString()}] Proxy Error:`, e.message);

    // Return sanitized error to client to prevent XSS/Information Leakage
    res.status(500).json({ success: false, error: "Resource fetch failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tune-Topia Proxy Active on Port ${PORT}`));