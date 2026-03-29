// modules/metadata.js - ID3v2.4 for mp3, iTunes atoms for m4a

const enc = str => new TextEncoder().encode(str)

export function concat(...arrs) {
  const total = arrs.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrs) { out.set(a, off); off += a.length }
  return out
}

// - ID3v2.4 (mp3) -

function be4(n) {
  return new Uint8Array([(n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff])
}
function syncsafe4(n) {
  return new Uint8Array([(n>>>21)&0x7f, (n>>>14)&0x7f, (n>>>7)&0x7f, n&0x7f])
}
function id3Frame(id, data) {
  return concat(enc(id), be4(data.length), new Uint8Array(2), data)
}
function id3TextFrame(id, text) {
  return id3Frame(id, concat(new Uint8Array([3]), enc(text)))
}
function id3ApicFrame(mime, imgBytes) {
  return id3Frame('APIC', concat(
    new Uint8Array([0]), enc(mime), new Uint8Array([0]),
    new Uint8Array([3]), new Uint8Array([0]), imgBytes
  ))
}

export function buildID3(track, coverBytes, coverMime = 'image/jpeg') {
  const parts = []
  if (track.title)        parts.push(id3TextFrame('TIT2', track.title))
  if (track.artist)       parts.push(id3TextFrame('TPE1', track.artist))
  if (track.album)        parts.push(id3TextFrame('TALB', track.album))
  if (coverBytes?.length) parts.push(id3ApicFrame(coverMime, coverBytes))
  const payload = concat(...parts)
  return concat(enc('ID3'), new Uint8Array([4,0,0]), syncsafe4(payload.length), payload)
}

// - iTunes/MP4 atoms (m4a) -

function u32BE(n) {
  return new Uint8Array([(n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff])
}
function readU32(buf, off) {
  return ((buf[off]<<24)|(buf[off+1]<<16)|(buf[off+2]<<8)|buf[off+3]) >>> 0
}
function str4(buf, off) {
  return String.fromCharCode(buf[off], buf[off+1], buf[off+2], buf[off+3])
}
// atom types use raw char codes — handles © (0xa9)
function encType(s) {
  return new Uint8Array([s.charCodeAt(0)&0xff, s.charCodeAt(1)&0xff, s.charCodeAt(2)&0xff, s.charCodeAt(3)&0xff])
}
function mp4Atom(type, body) {
  return concat(u32BE(body.length + 8), encType(type), body)
}
// iTunes data atom: type 1=UTF-8, 13=JPEG
function itunesData(typeFlag, bytes) {
  return mp4Atom('data', concat(
    new Uint8Array([0,0,0,typeFlag]),
    new Uint8Array([0,0,0,0]),
    bytes
  ))
}
function itunesText(name, value) {
  return mp4Atom(name, itunesData(1, enc(value)))
}
function itunesCover(imgBytes) {
  return mp4Atom('covr', itunesData(13, imgBytes))
}
function buildIlst(track, coverBytes) {
  const parts = []
  if (track.title)        parts.push(itunesText('\u00a9nam', track.title))
  if (track.artist)       parts.push(itunesText('\u00a9ART', track.artist))
  if (track.album)        parts.push(itunesText('\u00a9alb', track.album))
  if (coverBytes?.length) parts.push(itunesCover(new Uint8Array(coverBytes)))
  if (!parts.length) return new Uint8Array(0)
  return mp4Atom('ilst', concat(...parts))
}
function buildHdlr() {
  return mp4Atom('hdlr', concat(
    new Uint8Array([0,0,0,0]),  // version+flags
    new Uint8Array([0,0,0,0]),  // pre_defined
    encType('mdir'),             // handler_type
    encType('appl'),             // manufacturer
    new Uint8Array(8),           // reserved
    new Uint8Array([0])          // empty name
  ))
}
// strip a child atom by type from container content bytes
function stripChild(content, targetType) {
  const parts = []
  let off = 0
  while (off + 8 <= content.length) {
    const size = readU32(content, off)
    if (size < 8 || off + size > content.length) break
    if (str4(content, off + 4) !== targetType) parts.push(content.slice(off, off + size))
    off += size
  }
  return parts.length ? concat(...parts) : content
}

export function injectM4aMeta(fileBytes, track, coverBytes) {
  // find moov atom at top level
  let off = 0, moovOff = -1, moovSize = 0
  while (off + 8 <= fileBytes.length) {
    const size = readU32(fileBytes, off)
    if (size < 8) break
    if (str4(fileBytes, off + 4) === 'moov') { moovOff = off; moovSize = size; break }
    off += size
  }
  if (moovOff < 0) return fileBytes

  const moovContent = fileBytes.slice(moovOff + 8, moovOff + moovSize)

  const ilst = buildIlst(track, coverBytes)
  if (!ilst.length) return fileBytes

  const meta = mp4Atom('meta', concat(new Uint8Array([0,0,0,0]), buildHdlr(), ilst))
  const udta = mp4Atom('udta', meta)

  // strip any existing udta, append fresh one
  const cleanMoov = stripChild(moovContent, 'udta')
  const newMoov = mp4Atom('moov', concat(cleanMoov, udta))

  return concat(
    fileBytes.slice(0, moovOff),
    newMoov,
    fileBytes.slice(moovOff + moovSize)
  )
}

// - shared cover fetch (wsrv.nl proxy first to bypass CORS) -

export async function fetchCover(url) {
  if (!url) return null
  const proxied = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&output=jpg&q=90`
  try {
    const r = await fetch(proxied)
    if (r.ok) return new Uint8Array(await r.arrayBuffer())
  } catch {}
  try {
    const r = await fetch(url)
    if (r.ok) return new Uint8Array(await r.arrayBuffer())
  } catch {}
  return null
}