// Bulk Downloader
import * as UI from '../app/ui.js';
import { getStream } from '../api/index.js';
import { fetchCover, buildID3, injectM4aMeta, injectOggMeta, concat } from './metadata.js';
import { injectFlacMeta } from './metadata-flac.js';
import { fetchDash } from './dash.js';

/**
 * Batch download a list of tracks.
 * @param {Array} tracks - List of track objects to download.
 * @param {string} collectionName - Name of the album or playlist for context.
 */
export async function downloadTracks(tracks, collectionName = 'Collection') {
  if (!tracks || !tracks.length) {
    UI.toast('No tracks available to download.');
    return;
  }

  if (!window.JSZip) {
    UI.toast('Loading ZIP engine...');
    await new Promise(r => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = r; document.head.appendChild(s);
    });
  }

  const zip = new JSZip();
  UI.toast(`Bundling ${tracks.length} tracks into ZIP...`);

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    try {
      UI.toast(`Fetching (${i+1}/${tracks.length}): ${track.title}`);
      const stream = await getStream(track.id);
      let audioBytes;
      
      if (stream.type === 'dash') {
        audioBytes = await fetchDash(stream);
      } else {
        const resp = await fetch(stream.url);
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        audioBytes = new Uint8Array(await resp.arrayBuffer());
      }

      // Determine extension and metadata strategy to prevent corruption
      const isMp3 = stream.mimeType?.includes('mpeg') || stream.url?.includes('.mp3');
      const isFlac = stream.mimeType?.includes('flac') || stream.url?.includes('.flac');
      const isOgg = stream.mimeType?.includes('ogg') || stream.url?.includes('.ogg') || stream.mimeType?.includes('opus');
      const ext = isMp3 ? 'mp3' : (isFlac ? 'flac' : (isOgg ? 'ogg' : 'm4a'));
      
      let finalData = audioBytes;
      try {
        const coverBytes = await fetchCover(track.coverSmall || track.cover);
        if (isMp3) {
          finalData = concat(buildID3(track, coverBytes), audioBytes);
        } else if (ext === 'm4a') {
          finalData = injectM4aMeta(audioBytes, track, coverBytes);
        } else if (ext === 'flac') {
          finalData = injectFlacMeta(audioBytes, track, coverBytes);
        } else if (ext === 'ogg') {
          finalData = injectOggMeta(audioBytes, track, coverBytes);
        }
      } catch { }

      const fileName = `${track.artist} - ${track.title}.${ext}`.replace(/[/\\?%*:|"<>]/g, '-');
      zip.file(fileName, finalData);
    } catch (err) {
      console.error(`Failed to download: ${track.title}`, err);
    }
  }

  UI.toast('Generating ZIP file...');
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${collectionName.replace(/\s+/g, '_')}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  UI.toast('Download complete!');
}