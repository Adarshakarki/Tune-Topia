// Lyrics fetching and parsing (LRCLIB Integration)

import { fetchJSON } from '../api/utils.js';

const LRCLIB_BASE = 'https://lrclib.net/api';

const _primaryArtist = a => {
  if (Array.isArray(a)) a = a[0];
  const name = (typeof a === 'object' ? a?.name : a) || '';
  return typeof name === 'string' ? name.split(/[,&/]| - | feat\.? | ft\.? /i)[0].trim() : '';
};

export async function fetchLyrics(title, artist, album = '', duration = 0) {
  const artistName = _primaryArtist(artist);
  const durationSec = duration > 5000 ? Math.round(duration / 1000) : Math.round(duration);

  const queryParams = new URLSearchParams({
    track_name: title,
    artist_name: artistName,
    ...(album && { album_name: album }),
    ...(durationSec > 0 && { duration: durationSec }),
  });

  try {
    let data;
    try {
      data = await fetchJSON(`${LRCLIB_BASE}/get?${queryParams}`);
    } catch {
      const results = await fetchJSON(`${LRCLIB_BASE}/search?${queryParams}`);
      data = results?.[0];
    }

    if (!data) return { plain: null, synced: [] };
    
    return { 
      plain: data.plainLyrics || null, 
      synced: parseSynced(data.syncedLyrics), 
      raw: data.syncedLyrics || null 
    };
  } catch (err) { 
    console.warn('Lyrics fetch failed:', err.message); 
    return { plain: null, synced: [] }; 
  }
}

export function parseSynced(raw) {
  if (!raw) return [];

  const parseTime = t => {
    const p = t?.split(':');
    return p?.length === 2 ? parseInt(p[0]) * 60 + parseFloat(p[1]) : 0;
  };

  const lines = raw.split('\n')
    .map(line => {
      const match = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
      if (!match) return null;

      const startTime = parseTime(match[1]);
      const rawContent = (match[2] || '').trim();
      
      // Extract word-level timestamps before stripping tags
      const ws = [];
      const wr = /<(\d+:\d+\.\d+)>\s*([^\s<]+)/g;
      let m;
      while ((m = wr.exec(rawContent)) !== null) {
        ws.push({ time: parseTime(m[1]), text: m[2] });
      }

      // Securely extract text content to avoid injection vulnerabilities
      const cleanText = (html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
      };

      return {
        time: startTime,
        text: cleanText(rawContent).trim(),
        words: ws.length > 0 ? ws : null,
      };
    })
    .filter(l => l && (l.text || l.words))
    .sort((a, b) => a.time - b.time);

  // Interpolate word-level timing for lines that only have line-level sync
  return lines.map((line, i) => {
    if (line.words) return line;

    const next = lines[i + 1];
    const duration = next ? next.time - line.time : 5;
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