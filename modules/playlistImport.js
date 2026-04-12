// Playlist Import
import { searchTracks } from '../api/index.js';

/**
 * Parses JSON or CSV content into a unified list of {title, artist}
 */
export async function parseImportFile(file) {
  const content = await file.text();
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === 'json') {
    return _parseJSON(content);
  } else if (extension === 'csv') {
    return _parseCSV(content);
  }
  throw new Error('Unsupported file format. Please use .json or .csv');
}

function _parseJSON(content) {
  try {
    const data = JSON.parse(content);
    // Handle various JSON formats (Spotify playlist items, or flat arrays)
    const items = data.items || (Array.isArray(data) ? data : []);
    return items.map(item => {
      const t = item.track || item;
      return {
        title: t.name || t.trackName || t.title,
        artist: t.artists ? t.artists.map(a => a.name).join(', ') : (t.artistName || t.artist || '')
      };
    }).filter(t => t.title);
  } catch {
    throw new Error('Failed to parse JSON file.');
  }
}

function _parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV file is empty');

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/["']/g, ''));
  const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('name'));
  const artistIdx = headers.findIndex(h => h.includes('artist'));

  if (titleIdx === -1) throw new Error('Could not find a "Title" or "Name" column in CSV');

  return lines.slice(1).map(line => {
    const parts = line.split(',').map(p => p.trim().replace(/["']/g, ''));
    return {
      title: parts[titleIdx],
      artist: artistIdx !== -1 ? parts[artistIdx] : ''
    };
  }).filter(t => t.title);
}

/**
 * Takes a list of {title, artist} and finds actual track objects
 */
export async function resolveTracks(trackList, onProgress) {
  const resolved = [];
  const failed = [];
  for (let i = 0; i < trackList.length; i++) {
    const item = trackList[i];
    const query = `${item.title} ${item.artist}`.trim();
    try {
      const results = await searchTracks(query);
      if (results && results.length > 0) resolved.push(results[0]);
      else failed.push(item);
    } catch { failed.push(item); }
    if (onProgress) onProgress(i + 1, trackList.length);
  }
  return { resolved, failed };
}