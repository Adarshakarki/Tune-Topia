// YouTube Client
import { fetchJSON } from '../utils.js';

export const IV_BASE = 'https://iv.melmac.space';

// Search
export const searchRaw = q => fetchJSON(`${IV_BASE}/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`);

// Metadata
export const getVideoData = id => fetchJSON(`${IV_BASE}/api/v1/videos/${id}?local=true`);

// Thumbnail
export const ivThumb = (id, q = 'mqdefault') => `${IV_BASE}/vi/${id}/${q}.jpg`;
