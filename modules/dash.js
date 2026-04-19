// DASH
import { concat } from './metadata.js';

export async function fetchDash(stream, onProgress) {
  const mpd = new DOMParser().parseFromString(stream.manifest, 'text/xml');
  const template = mpd.querySelector('SegmentTemplate');
  const durationAttr = mpd.querySelector('MPD').getAttribute('mediaPresentationDuration');
  
  // Parse ISO 8601 duration (PT#M#S)
  const match = durationAttr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  const totalSeconds = (parseFloat(match[1] || 0) * 3600) + (parseFloat(match[2] || 0) * 60) + parseFloat(match[3] || 0);
  
  const timescale = parseInt(template.getAttribute('timescale'));
  const segmentDuration = parseInt(template.getAttribute('duration'));
  const totalSegments = Math.ceil((totalSeconds * timescale) / segmentDuration);
  const baseUrl = stream.url.substring(0, stream.url.lastIndexOf('/') + 1);

  const segments = [];
  const initUrl = baseUrl + template.getAttribute('initialization').replace('$RepresentationID$', '1');
  const initRes = await fetch(`/proxy?url=${encodeURIComponent(initUrl)}`);
  segments.push(new Uint8Array(await initRes.arrayBuffer()));

  for (let i = 1; i <= totalSegments; i++) {
    onProgress?.({ progress: (i / totalSegments) * 100, message: `Downloading: ${i}/${totalSegments}` });
    const segUrl = baseUrl + template.getAttribute('media').replace('$RepresentationID$', '1').replace('$Number$', i);
    const res = await fetch(`/proxy?url=${encodeURIComponent(segUrl)}`);
    if (res.ok) segments.push(new Uint8Array(await res.arrayBuffer()));
  }
  return concat(...segments);
}