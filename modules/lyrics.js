import { fetchJSON } from '../api/utils.js';

const LRCLIB_BASE = 'https://lrclib.net/api';

// Clean artist name for API matching
const _primaryArtist = a => {
  if (Array.isArray(a)) a = a[0];
  const name = (typeof a === 'object' ? a?.name : a) || '';
  return typeof name === 'string' ? name.split(/[,&/]| - | feat\.? | ft\.? /i)[0].trim() : '';
};

export async function fetchLyrics(title, artist, album = '', duration = 0) {
  const artistName = _primaryArtist(artist);
  const durationSec = duration > 5000 ? Math.round(duration / 1000) : Math.round(duration);

  const queryParams = new URLSearchParams({
    track_name: title, artist_name: artistName,
    ...(album && { album_name: album }),
    ...(durationSec > 0 && { duration: durationSec }),
  });

  try {
    let data;
    try {
      // Attempt exact match first
      data = await fetchJSON(`${LRCLIB_BASE}/get?${queryParams}`);
    } catch {
      // Fallback to search if exact match fails (e.g. 404)
      const results = await fetchJSON(`${LRCLIB_BASE}/search?${queryParams}`);
      data = results?.[0];
    }

    if (!data) return { plain: null, synced: [] };
    return { plain: data.plainLyrics || null, synced: parseSynced(data.syncedLyrics), raw: data.syncedLyrics || null };
  } catch (err) { 
    console.warn('Lyrics fetch failed:', err.message); 
    return { plain: null, synced: [] }; 
  }
}

/**
 * Parses LRC strings. Supports both line-sync and Karaoke (word-sync).
 */
export function parseSynced(raw) {
  if (!raw) return [];

  const parseTime = t => {
    const p = t?.split(':');
    return p?.length === 2 ? parseInt(p[0]) * 60 + parseFloat(p[1]) : 0;
  };

  const lines = raw.split('\n')
    .map(line => {
      // Extract timestamp [mm:ss.xx] and content
      const match = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
      if (!match) return null;

      const startTime = parseTime(match[1]), content = (match[2] || '').trim();
      const ws = [], wr = /<(\d+:\d+\.\d+)>\s*([^\s<]+)/g;
      let m;
      while ((m = wr.exec(content)) !== null) ws.push({ time: parseTime(m[1]), text: m[2] });

      return {
        time: startTime,
        text: content.replace(/<[^>]+>/g, '').trim(), // Strip word-sync tags for plain text
        words: ws.length > 0 ? ws : null,
      };
    })
    .filter(l => l && (l.text || l.words))
    .sort((a, b) => a.time - b.time);

  // Generate synthetic word sync for lines that only have line-level timestamps
  return lines.map((line, i) => {
    if (line.words) return line;

    const next = lines[i + 1];
    const duration = next ? next.time - line.time : 5; // Assume 5s for the last line
    const parts = line.text.split(/\s+/).filter(Boolean);
    
    if (parts.length > 0) {
      const wordDur = duration / parts.length;
      line.words = parts.map((text, j) => ({
        time: line.time + (j * wordDur),
        text: text
      }));
    }
    return line;
  });
}

export function getActiveLine(syncedLyrics, currentTime) {
  if (!syncedLyrics?.length) return -1;
  return syncedLyrics.findLastIndex(line => currentTime >= line.time);
}

export function getActiveWord(line, currentTime) {
  if (!line?.words) return -1;
  return line.words.findLastIndex(word => currentTime >= word.time);
}