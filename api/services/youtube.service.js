// api/services/youtube.service.js — business logic, normalization

import {
  searchRaw,
  getVideoData,
  ivThumb,
  IV_BASE,
} from '../client/youtube.client.js';
import { fmtDur } from '../utils.js';

// Normalize raw Invidious video into app track shape
export function normalizeVideo(v) {
  return {
    id: v.videoId,
    title: v.title || 'Unknown',
    artist: v.author || '',
    album: '',
    cover: ivThumb(v.videoId, 'maxresdefault'),
    coverSmall: ivThumb(v.videoId, 'mqdefault'),
    duration: v.lengthSeconds || 0,
    dur: fmtDur(v.lengthSeconds),
    quality: 'YT',
    tags: [],
    explicit: false,
    source: 'youtube',
  };
}

export async function searchVideos(query) {
  const data = await searchRaw(query);
  return (data || []).slice(0, 40).map(normalizeVideo);
}

// Returns best audio stream URL for background playback
export async function getAudioStream(videoId) {
  const data = await getVideoData(videoId);
  const audio = (data.adaptiveFormats || [])
    .filter((f) => f.type?.startsWith('audio/'))
    .sort((a, b) => {
      const aOp = a.type.includes('opus') ? 1 : 0;
      const bOp = b.type.includes('opus') ? 1 : 0;
      if (aOp !== bOp) return bOp - aOp;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  const url =
    audio[0]?.url ||
    data.formatStreams?.[data.formatStreams.length - 1]?.url ||
    `${IV_BASE}/videoplayback?id=${videoId}&itag=140&local=true`;

  return {
    type: 'direct',
    url,
    mimeType: audio[0]?.type?.split(';')[0] || 'audio/webm',
  };
}

// Returns best video+audio stream URL for video player
export async function getVideoStream(videoId) {
  const data = await getVideoData(videoId);

  // Prefer a combined format stream for simplicity
  const combined = (data.formatStreams || []).sort(
    (a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0),
  );

  if (combined.length) {
    return {
      type: 'direct',
      url: combined[0].url,
      mimeType: combined[0].type?.split(';')[0] || 'video/mp4',
    };
  }

  // Fallback to adaptive video + audio (will need MediaSource — future work)
  throw new Error('No combined video stream available');
}
