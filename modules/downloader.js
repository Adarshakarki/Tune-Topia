// Downloader
import { buildID3, injectM4aMeta, injectOggMeta, fetchCover, concat } from './metadata.js'
import { injectFlacMeta } from './metadata-flac.js'
import * as UI from '../app/ui.js'
import { ffmpeg, FfmpegError } from './ffmpeg.js'
import { fetchDash } from './dash.js'

const MIME = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
}

const QUALITY_MAP = {
  hires: { ext: 'flac', mime: 'audio/flac', codec: 'flac' },
  lossless: { ext: 'flac', mime: 'audio/flac', codec: 'flac' },
  mp3_320: {
    ext: 'mp3',
    mime: 'audio/mpeg',
    codec: 'libmp3lame',
    bitrate: '320k',
  },
  mp3_256: {
    ext: 'mp3',
    mime: 'audio/mpeg',
    codec: 'libmp3lame',
    bitrate: '256k',
  },
  mp3_96: {
    ext: 'mp3',
    mime: 'audio/mpeg',
    codec: 'libmp3lame',
    bitrate: '96k',
  },
  aac_320: { ext: 'm4a', mime: 'audio/mp4', codec: 'aac', bitrate: '320k' },
  aac_256: { ext: 'm4a', mime: 'audio/mp4', codec: 'aac', bitrate: '256k' },
  aac_96: { ext: 'm4a', mime: 'audio/mp4', codec: 'aac', bitrate: '96k' },
  ogg_320: { ext: 'ogg', mime: 'audio/ogg', codec: 'libvorbis', bitrate: '192k' },
  ogg_256: { ext: 'ogg', mime: 'audio/ogg', codec: 'libvorbis', bitrate: '160k' },
  ogg_96: { ext: 'ogg', mime: 'audio/ogg', codec: 'libvorbis', bitrate: '96k' },
}

const _safeName = (t) =>
  `${t.artist || 'Unknown'} - ${t.title || 'Unknown'}`
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

const _trigger = (blobUrl, filename) => {
  const a = Object.assign(document.createElement('a'), {
    href: blobUrl,
    download: filename,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
}

export async function downloadTrack(track, stream) {
  // Determine source extension more accurately
  let originalExt = 'flac'
  if (stream.type === 'dash' || track.source === 'youtube') {
    // Detect codec from manifest to provide correct extension to FFmpeg
    const manifest = stream.manifest || ''
    if (
      manifest.includes('codecs="opus"') ||
      manifest.includes('mimeType="audio/webm"')
    ) {
      originalExt = 'webm'
    } else {
      originalExt = 'm4a'
    }
  } else if (stream.mimeType) {
    if (
      stream.mimeType.includes('audio/ogg') ||
      stream.mimeType.includes('audio/opus')
    ) {
      originalExt = 'ogg'
    } else if (
      stream.mimeType.includes('audio/webm') ||
      stream.mimeType.includes('video/webm')
    ) {
      originalExt = 'webm'
    } else if (
      stream.mimeType.includes('audio/mp4') ||
      stream.mimeType.includes('video/mp4')
    ) {
      originalExt = 'm4a'
    }
  } else if (stream.url) {
    const urlLower = stream.url.toLowerCase()
    if (urlLower.includes('.ogg') || urlLower.includes('.opus')) {
      originalExt = 'ogg'
    } else if (urlLower.includes('.webm')) {
      originalExt = 'webm'
    } else if (urlLower.includes('.m4a') || urlLower.includes('.mp4')) {
      originalExt = 'm4a'
    }
  }

  const targetKey = localStorage.getItem('tt_download_quality') || 'mp3_320'
  const target = QUALITY_MAP[targetKey] || QUALITY_MAP.mp3_320
  const safeBaseName = _safeName(track)

  // 1. Fetch Assets
  const coverBytes = await fetchCover(track.coverSmall || track.cover)
  let audioBytes

  UI.toast('Fetching audio data...')
  if (stream.type === 'dash') {
    audioBytes = await fetchDash(stream, (p) => UI.toast(p.message))
  } else {
    const res = await fetch(stream.url)
    audioBytes = new Uint8Array(await res.arrayBuffer())
  }

  // 2. The Smart Switch Logic
  // Bypass FFmpeg if we aren't changing format (Fast Path)
  const needsTranscode = originalExt !== target.ext || stream.type === 'dash'
  let processedBlob

  if (needsTranscode) {
    UI.toast(`Transcoding to ${target.ext.toUpperCase()}...`)
    try {
      let args = [
        '-vn',
        '-sn',
        '-dn',
        '-map', '0:a:0',
        '-map_metadata', '-1',
      ]

      if (target.ext === 'mp3') args.push('-id3v2_version', '3');

      if (target.ext === 'ogg') {
        args.push(
          '-c:a', 'libvorbis',
          '-b:a', target.bitrate || '128k',
          '-vbr', 'on',
          '-compression_level', '3' // Level 3 is safer for RAM than level 10
        );
      } else {
        args.push('-c:a', target.codec || 'copy');
        if (target.bitrate) args.push('-b:a', target.bitrate);
      }

      processedBlob = await ffmpeg(audioBytes, {
        inputName: `input.${originalExt}`,
        args,
        outputName: `output.${target.ext}`,
        outputMime: target.mime,
        onProgress: (p) =>
          UI.toast(`Converting: ${Math.round((p.progress || 0) * 100)}%`),
      })
    } catch (err) {
      if (err instanceof FfmpegError) {
        UI.toast('Download cancelled.')
        return
      }
      processedBlob = new Blob([audioBytes], { type: MIME[originalExt] })
    }
  } else {
    processedBlob = new Blob([audioBytes], { type: MIME[originalExt] })
  }

  // 3. Metadata Injection (Using lightweight JS)
  const finalExt = target.ext
  let finalBytes = new Uint8Array(await (processedBlob instanceof Blob ? processedBlob.arrayBuffer() : processedBlob.buffer))

  try {
    if (finalExt === 'mp3') {
      finalBytes = concat(buildID3(track, coverBytes, 'image/jpeg'), finalBytes)
    } else if (finalExt === 'm4a') {
      finalBytes = injectM4aMeta(finalBytes, track, coverBytes)
    } else if (finalExt === 'flac') {
      finalBytes = injectFlacMeta(finalBytes, track, coverBytes)
    } else if (finalExt === 'ogg') {
      finalBytes = injectOggMeta(finalBytes, track, coverBytes)
    }
  } catch { }

  _trigger(
    URL.createObjectURL(new Blob([finalBytes], { type: target.mime })),
    `${safeBaseName}.${finalExt}`
  )
  UI.toast('Download complete!')
}
