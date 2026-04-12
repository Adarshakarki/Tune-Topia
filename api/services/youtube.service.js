/*
import {
  searchRaw,
  getVideoData,
  ivThumb,
  IV_BASE,
} from '../client/youtube.client.js'
import { fmtDur } from '../utils.js'
*/

// Map Invidious video to app track
export const normalizeVideo = v => ({
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
});

export const searchVideos = async q => []; // (await searchRaw(q) || []).slice(0, 40).map(normalizeVideo);

// Get best audio stream
export async function getAudioStream(id) {
  /*
  const d = await getVideoData(id);
  const af = (d.adaptiveFormats || []).filter(f => f.type?.startsWith('audio/'))
    .sort((a, b) => (b.type.includes('opus') - a.type.includes('opus')) || (b.bitrate - a.bitrate));
  const u = af[0]?.url || d.formatStreams?.at(-1)?.url || `${IV_BASE}/videoplayback?id=${id}&itag=140&local=true`;
  return { type: 'direct', url: u, mimeType: af[0]?.type?.split(';')[0] || 'audio/webm' };
  */
  throw new Error('YouTube disabled');
}

// Get best combined video stream
export async function getVideoStream(id) {
  /*
  const d = await getVideoData(id);
  const cs = (d.formatStreams || []).sort((a, b) => (parseInt(b.resolution) || 0) - (parseInt(a.resolution) || 0));
  if (!cs.length) throw new Error('No combined stream');
  return { type: 'direct', url: cs[0].url, mimeType: cs[0].type?.split(';')[0] || 'video/mp4' };
  */
  throw new Error('YouTube disabled');
}
