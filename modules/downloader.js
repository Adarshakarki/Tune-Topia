import { buildID3, injectM4aMeta, fetchCover, concat } from './metadata.js'

const MIME = {
  mp3: 'audio/mpeg', flac: 'audio/flac',
  ogg: 'audio/ogg',  opus: 'audio/ogg', m4a: 'audio/mp4',
}

function _ext(mime, url) {
  if (mime?.includes('flac') || url?.includes('.flac')) return 'flac'
  if (mime?.includes('mp3')  || url?.includes('.mp3'))  return 'mp3'
  if (mime?.includes('ogg')  || url?.includes('.ogg'))  return 'ogg'
  if (mime?.includes('opus'))                            return 'opus'
  return 'm4a'
}

function _safeName(track) {
  return `${track.artist || 'Unknown'} - ${track.title || 'Unknown'}`
    .replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120)
}

function _trigger(blobUrl, filename) {
  const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
}

export async function downloadTrack(track, stream) {
  if (!stream?.url) throw new Error('No direct URL — DASH streams cannot be downloaded yet')

  const ext = _ext(stream.mimeType, stream.url)
  const filename = `${_safeName(track)}.${ext}`

  let audioBytes
  try {
    const res = await fetch(stream.url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    audioBytes = new Uint8Array(await res.arrayBuffer())
  } catch {
    window.open(stream.url, '_blank')
    throw new Error('Direct download blocked by CORS — opened in new tab')
  }

  const coverBytes = await fetchCover(track.coverSmall || track.cover)

  let finalBytes
  if (ext === 'mp3') {
    const id3 = buildID3(track, coverBytes, 'image/jpeg')
    finalBytes = concat(id3, audioBytes)
  } else if (ext === 'm4a') {
    finalBytes = injectM4aMeta(audioBytes, track, coverBytes)
  } else {
    finalBytes = audioBytes
  }

  _trigger(URL.createObjectURL(new Blob([finalBytes], { type: MIME[ext] || 'audio/mp4' })), filename)
}