// modules/downloader.js — download audio with embedded ID3v2 metadata

const _enc = str => new TextEncoder().encode(str)

function _concat(...arrs) {
  const all = arrs.flat()
  const total = all.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of all) { out.set(a, off); off += a.length }
  return out
}

function _be4(n) {
  return new Uint8Array([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])
}

function _syncsafe4(n) {
  return new Uint8Array([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f])
}

function _frame(id, data) {
  return _concat(_enc(id), _be4(data.length), new Uint8Array(2), data)
}

function _textFrame(id, text) {
  return _frame(id, _concat(new Uint8Array([3]), _enc(text)))
}

function _apicFrame(mime, imgBytes) {
  const data = _concat(
    new Uint8Array([0]),
    _enc(mime), new Uint8Array([0]),
    new Uint8Array([3]),
    new Uint8Array([0]),
    new Uint8Array(imgBytes)
  )
  return _frame('APIC', data)
}

function _buildID3(track, coverBytes, coverMime) {
  const parts = []
  if (track.title)  parts.push(_textFrame('TIT2', track.title))
  if (track.artist) parts.push(_textFrame('TPE1', track.artist))
  if (track.album)  parts.push(_textFrame('TALB', track.album))
  if (coverBytes?.length) parts.push(_apicFrame(coverMime || 'image/jpeg', coverBytes))

  const payload = _concat(...parts)
  const header = _concat(_enc('ID3'), new Uint8Array([4, 0, 0]), _syncsafe4(payload.length))
  return _concat(header, payload)
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
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function _save(url, filename) {
  const a = Object.assign(document.createElement('a'), { href: url, download: filename, target: '_blank' })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function _fetchCover(url) {
  if (!url) return null
  // try direct, then wsrv proxy
  for (const src of [url, `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&output=jpg`]) {
    try {
      const r = await fetch(src)
      if (r.ok) return new Uint8Array(await r.arrayBuffer())
    } catch {}
  }
  return null
}

export async function downloadTrack(track, stream) {
  if (!stream?.url) throw new Error('No direct URL — DASH streams cannot be downloaded yet')

  const ext = _ext(stream.mimeType, stream.url)
  const filename = `${_safeName(track)}.${ext}`

  // non-MP3: just open direct link (metadata injection not supported for FLAC/AAC yet)
  if (ext !== 'mp3') {
    _save(stream.url, filename)
    return
  }

  try {
    const [audioRes] = await Promise.all([fetch(stream.url)])
    if (!audioRes.ok) { _save(stream.url, filename); return }

    const [audioBytes, coverBytes] = await Promise.all([
      audioRes.arrayBuffer().then(b => new Uint8Array(b)),
      _fetchCover(track.coverSmall || track.cover)
    ])

    const id3 = _buildID3(track, coverBytes, 'image/jpeg')
    const blob = new Blob([id3, audioBytes], { type: 'audio/mpeg' })
    const blobUrl = URL.createObjectURL(blob)
    _save(blobUrl, filename)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
  } catch {
    _save(stream.url, filename)
  }
}