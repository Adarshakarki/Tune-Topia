import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const ytmusic = new YTMusic();

// Initialize YTM API (public searches only)
await ytmusic.initialize();

// ===== Search Endpoint =====
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query parameter "q" required' });

    try {
        const results = await ytmusic.search(query);
        const songs = results
            .filter(item => item.type === 'SONG')
            .map(item => ({
                name: item.name,
                artist: item.artist ? item.artist.name : 'Unknown',
                videoId: item.videoId,
                duration: item.duration,
                thumbnails: item.thumbnails
            }));
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Song Details Endpoint =====
app.get('/song/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    try {
        const song = await ytmusic.getSong(videoId);
        res.json(song);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Start Server =====
app.listen(PORT, () => {
    console.log(`YTM Backend running at https://localhost:${PORT}`);
});
