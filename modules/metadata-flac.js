// Metadata (FLAC)
import { enc, concat, u32LE, u24BE, u32BE } from './metadata.js';

export function injectFlacMeta(bin, t, img) {
  if (bin.length < 4 || String.fromCharCode(...bin.slice(0, 4)) !== 'fLaC') return bin;

  let pos = 4;
  const blocks = [];
  while (pos < bin.length) {
    const header = bin[pos];
    const type = header & 0x7f;
    const len = (bin[pos + 1] << 16) | (bin[pos + 2] << 8) | bin[pos + 3];
    // Skip existing Vorbis Comment (4) and Picture (6) to replace them
    if (type !== 4 && type !== 6) {
      blocks.push({ header: type, data: bin.slice(pos + 4, pos + 4 + len) });
    }
    pos += 4 + len;
    if (header & 0x80) break;
  }

  // Build Vorbis Comment block
  const tags = [];
  if (t.title) tags.push(`TITLE=${t.title}`);
  if (t.artist) tags.push(`ARTIST=${t.artist}`);
  if (t.album) tags.push(`ALBUM=${t.album}`);
  
  const vendor = enc('TuneTopia');
  const commentData = concat(u32LE(vendor.length), vendor, u32LE(tags.length), ...tags.map(tag => {
    const b = enc(tag);
    return concat(u32LE(b.length), b);
  }));
  blocks.splice(1, 0, { header: 4, data: commentData });

  // Build Picture block
  if (img) {
    const mime = enc('image/jpeg');
    const desc = enc('Front Cover');
    const picData = concat(u32BE(3), u32BE(mime.length), mime, u32BE(desc.length), desc, u32BE(0), u32BE(0), u32BE(0), u32BE(0), u32BE(img.length), img);
    blocks.splice(2, 0, { header: 6, data: picData });
  }

  // Rebuild FLAC with updated blocks
  const parts = [enc('fLaC')];
  blocks.forEach((b, i) => {
    const isLast = i === blocks.length - 1;
    parts.push(new Uint8Array([isLast ? b.header | 0x80 : b.header]), u24BE(b.data.length), b.data);
  });
  
  return concat(...parts, bin.slice(pos));
}