const enc = s => new TextEncoder().encode(s);

export function concat(...arrs) {
  const out = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0));
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

const syncsafe4 = n => new Uint8Array([(n>>>21)&0x7f, (n>>>14)&0x7f, (n>>>7)&0x7f, n&0x7f]);
const u32BE = n => new Uint8Array([(n>>>24)&0xff, (n>>>16)&0xff, (n>>>8)&0xff, n&0xff]);
const readU32 = (b, o) => ((b[off]<<24)|(b[off+1]<<16)|(b[off+2]<<8)|b[off+3]) >>> 0;

// ID3 (MP3)
function id3Frame(id, data) {
  return concat(enc(id), syncsafe4(data.length), new Uint8Array(2), data);
}

export function buildID3(t, img, mime = 'image/jpeg') {
  const frames = [];
  const txt = (id, v) => id3Frame(id, concat(new Uint8Array([3]), enc(v)));
  if (t.title) frames.push(txt('TIT2', t.title));
  if (t.artist) frames.push(txt('TPE1', t.artist));
  if (t.album) frames.push(txt('TALB', t.album));
  if (img?.length) frames.push(id3Frame('APIC', concat(new Uint8Array([0]), enc(mime), new Uint8Array([0,3,0]), img)));
  const pay = concat(...frames);
  return concat(enc('ID3'), new Uint8Array([4,0,0]), syncsafe4(pay.length), pay);
}

// MP4/iTunes (M4A)
const atom = (t, b) => concat(u32BE(b.length + 8), enc(t).slice(0, 4), b);
const itData = (f, b) => atom('data', concat(new Uint8Array([0,0,0,f,0,0,0,0]), b));

function buildIlst(t, img) {
  const p = [];
  if (t.title) p.push(atom('\u00a9nam', itData(1, enc(t.title))));
  if (t.artist) p.push(atom('\u00a9ART', itData(1, enc(t.artist))));
  if (t.album) p.push(atom('\u00a9alb', itData(1, enc(t.album))));
  if (img?.length) p.push(atom('covr', itData(13, img)));
  return p.length ? atom('ilst', concat(...p)) : null;
}

function stripAtom(bin, type) {
  const p = []; let o = 0;
  while (o + 8 <= bin.length) {
    const s = (bin[o]<<24|bin[o+1]<<16|bin[o+2]<<8|bin[o+3])>>>0;
    if (s < 8 || o + s > bin.length) break;
    if (String.fromCharCode(...bin.slice(o+4, o+8)) !== type) p.push(bin.slice(o, o+s));
    o += s;
  }
  return p.length ? concat(...p) : bin;
}

export function injectM4aMeta(bin, t, img) {
  let o = 0, mOff = -1, mSize = 0;
  while (o + 8 <= bin.length) {
    const s = (bin[o]<<24|bin[o+1]<<16|bin[o+2]<<8|bin[o+3])>>>0;
    if (s < 8) break;
    if (String.fromCharCode(...bin.slice(o+4, o+8)) === 'moov') { mOff = o; mSize = s; break; }
    o += s;
  }
  if (mOff < 0) return bin;
  const ilst = buildIlst(t, img);
  if (!ilst) return bin;
  const hdlr = atom('hdlr', concat(new Uint8Array(8), enc('mdirappl'), new Uint8Array(9)));
  const udta = atom('udta', atom('meta', concat(new Uint8Array(4), hdlr, ilst)));
  const newMoov = atom('moov', concat(stripAtom(bin.slice(mOff + 8, mOff + mSize), 'udta'), udta));
  return concat(bin.slice(0, mOff), newMoov, bin.slice(mOff + mSize));
}

export async function fetchCover(url) {
  if (!url) return null;
  const p = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&output=jpg&q=90`;
  for (const u of [p, url]) {
    try { const r = await fetch(u); if (r.ok) return new Uint8Array(await r.arrayBuffer()); } catch {}
  } return null;
}