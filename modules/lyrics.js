import { fetchJSON } from '../api/utils.js';

const LRCLIB_BASE = 'https://lrclib.net/api';

/**
 * Robustly extracts the primary artist name for better API matching.
 */
function _primaryArtist(artist) {
  if (Array.isArray(artist)) {
    const first = artist[0];
    return (typeof first === 'object' ? first?.name : first) || '';
  }
  if (typeof artist === 'object' && artist !== null) return artist?.name ?? '';
  if (typeof artist === 'string') {
    // Split by common delimiters and remove "feat" or "ft"
    return artist.split(/[,&/]| - | feat\.? | ft\.? /i)[0].trim();
  }
  return '';
}

/**
 * Fetches lyrics with improved fallback and duration normalization.
 */
export async function fetchLyrics(title, artist, album = '', duration = 0) {
  const primaryArtist = _primaryArtist(artist);
  
  // Logic Fix: Ensure duration is strictly handled (LRCLIB expects seconds)
  // If duration is > 5000, we assume it's ms; otherwise, it's already seconds.
  const durationSec = duration > 5000 ? Math.round(duration / 1000) : Math.round(duration);

  const queryParams = new URLSearchParams({
    track_name: title,
    artist_name: primaryArtist,
    ...(album && { album_name: album }),
    ...(durationSec > 0 && { duration: durationSec }),
  });

  try {
    // Attempt high-accuracy "get" first
    let data = await fetchJSON(`${LRCLIB_BASE}/get?${queryParams}`);
    
    // Fallback to "search" if get returns nothing (returns an array)
    if (!data || Object.keys(data).length === 0) {
      const searchData = await fetchJSON(`${LRCLIB_BASE}/search?${queryParams}`);
      data = searchData?.[0];
    }

    if (!data) return { plain: null, synced: [] };

    return {
      plain: data.plainLyrics || null,
      synced: parseSynced(data.syncedLyrics),
    };
  } catch (err) {
    console.error('Lyrics fetch error:', err);
    return { plain: null, synced: [] };
  }
}

/**
 * Parses LRC strings, supporting both line-sync and word-sync (Karaoke).
 */
export function parseSynced(raw) {
  if (!raw) return [];

  // Helper: Safely parse [mm:ss.xx] or <mm:ss.xx>
  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  };

  return raw.split('\n')
    .map(line => {
      // Regex Fix: Better capture for the timestamp and the remaining text
      const lineMatch = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
      if (!lineMatch) return null;

      const startTime = parseTime(lineMatch[1]);
      const content = lineMatch[2].trim();

      // Extract word-level sync if present: <00:00.00> word
      const words = [];
      const wordRegex = /<(\d+:\d+\.\d+)>\s*([^\s<]+)/g;
      let match;

      while ((match = wordRegex.exec(content)) !== null) {
        words.push({ 
          time: parseTime(match[1]), 
          text: match[2] 
        });
      }

      return {
        time: startTime,
        // Remove word tags from the main text for clean display
        text: content.replace(/<\d+:\d+\.\d+>/g, '').trim(),
        words: words.length > 0 ? words : null,
      };
    })
    .filter(l => l && (l.text || l.words));
}

export function getActiveLine(syncedLyrics, currentTime) {
  if (!syncedLyrics?.length) return -1;
  // findLastIndex is great here; it ensures we get the *current* line even if 
  // multiple lines share a start time.
  return syncedLyrics.findLastIndex(line => currentTime >= line.time);
}

export function getActiveWord(line, currentTime) {
  if (!line?.words) return -1;
  return line.words.findLastIndex(word => currentTime >= word.time);
}