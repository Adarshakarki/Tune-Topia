import { fetchJSON } from '../utils.js';

export const IV_BASE = 'https://iv.melmac.space';

// Search Invidious
export const searchRaw = q => fetchJSON(`${IV_BASE}/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`);

// Get video data
export const getVideoData = id => fetchJSON(`${IV_BASE}/api/v1/videos/${id}?local=true`);

// Video thumbnail
export const ivThumb = (id, q = 'mqdefault') => `${IV_BASE}/vi/${id}/${q}.jpg`;
