import { fetchJSON } from '../utils.js';

export const IV_BASE = 'https://iv.melmac.space';

// Raw search results from Invidious
export async function searchRaw(query) {
  return fetchJSON(
    `${IV_BASE}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=1`,
  );
}

// Raw video data including adaptive formats
export async function getVideoData(videoId) {
  return fetchJSON(`${IV_BASE}/api/v1/videos/${videoId}?local=true`);
}

// Invidious thumbnail URL
export function ivThumb(videoId, q = 'mqdefault') {
  return `${IV_BASE}/vi/${videoId}/${q}.jpg`;
}
