import { buildID3, injectM4aMeta, fetchCover, concat } from './metadata.js'

const MIME = { mp3: 'audio/mpeg', flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4' };

const _ext = (mime, url) => {
  if (mime?.includes('flac') || url?.includes('.flac')) return 'flac';
  if (mime?.includes('mp3') || url?.includes('.mp3')) return 'mp3';
  if (mime?.includes('ogg') || url?.includes('.ogg')) return 'ogg';
  if (mime?.includes('opus')) return 'opus';
  return 'm4a';
};

const _safeName = t => `${t.artist || 'Unknown'} - ${t.title || 'Unknown'}`.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);

const _trigger = (blobUrl, filename) => {
  const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
};

export async function downloadTrack(track, stream) {
  if (!stream?.url) throw new Error('No direct URL — DASH streams cannot be downloaded yet');
  const ext = _ext(stream.mimeType, stream.url), filename = `${_safeName(track)}.${ext}`;
  let audioBytes;
  try { const res = await fetch(stream.url); if (!res.ok) throw new Error(`HTTP ${res.status}`); audioBytes = new Uint8Array(await res.arrayBuffer()); }
  catch { window.open(stream.url, '_blank'); throw new Error('Direct download blocked by CORS — opened in new tab'); }
  const coverBytes = await fetchCover(track.coverSmall || track.cover);
  let finalBytes = ext === 'mp3' ? concat(buildID3(track, coverBytes, 'image/jpeg'), audioBytes) : (ext === 'm4a' ? injectM4aMeta(audioBytes, track, coverBytes) : audioBytes);
  _trigger(URL.createObjectURL(new Blob([finalBytes], { type: MIME[ext] || 'audio/mp4' })), filename);
}