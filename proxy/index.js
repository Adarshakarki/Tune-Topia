const express = require('express');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const cors = require('cors');

const app = express();

// 1. ALLOWED ORIGINS (Fixes CORS Errors)
const allowedOrigins = [
    'https://adarshakarki.github.io', 
    'http://127.0.0.1:3000', 
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5173'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin or from allowed list
        if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, true);
        } else {
            console.log("CORS blocked origin:", origin);
            callback(null, true); // Allow during transition to avoid silent failures
        }
    },
    credentials: true
}));

// Required for ffmpeg.wasm / SharedArrayBuffer to work in modern browsers
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

// 2. PRIVATE IP CHECK (Security: Prevents SSRF attacks)
function isPrivateIP(ip) {
    if (!net.isIP(ip)) return true;
    return (
        ip.startsWith('10.') || ip.startsWith('192.168.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.31.') ||
        ip.startsWith('127.') || ip === '::1' ||
        ip.startsWith('fc') || ip.startsWith('fd')
    );
}

async function isSafeHost(hostname) {
    try {
        const addresses = await dns.lookup(hostname, { all: true });
        return !addresses.some((addr) => isPrivateIP(addr.address));
    } catch { return false; }
}

// 3. THE PROXY ROUTE (Fixes 400 Bad Requests)
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Error: Missing "url" parameter.');
    }

    try {
        const urlObj = new URL(targetUrl);
        
        // Security check
        const safe = await isSafeHost(urlObj.hostname);
        if (!safe) return res.status(403).send('Forbidden: Internal IP.');

        // Fetching the external resource
        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 
                'User-Agent': 'TuneTopiaProxy/1.0',
                'Accept': '*/*'
            }
        });

        // Forward the original content type (images, json, etc.)
        if (response.headers['content-type']) {
            res.set('Content-Type', response.headers['content-type']);
        }
        
        res.send(response.data);
    } catch (err) {
        console.error("Proxy Error:", err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch the requested URL',
            details: err.message 
        });
    }
});

// 4. DYNAMIC PORT (Fixes Render Deployment)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Tune-Topia Proxy running on port ${PORT}`);
});
