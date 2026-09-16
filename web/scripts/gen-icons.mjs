// Generates simple placeholder PWA icons (solid background + a white card-suit glyph
// approximated by a diamond shape) without any external image dependency.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const bg = [0x14, 0x4d, 0x3a]; // matches manifest theme_color
  const fg = [0xff, 0xff, 0xff];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.28;

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type
    for (let x = 0; x < size; x++) {
      // Diamond (whist suit nod) via Manhattan distance from center.
      const inside = Math.abs(x - cx) / r + Math.abs(y - cy) / r <= 1;
      const [r8, g8, b8] = inside ? fg : bg;
      const px = rowStart + 1 + x * 4;
      raw[px] = r8;
      raw[px + 1] = g8;
      raw[px + 2] = b8;
      raw[px + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync(new URL('../public/pwa-192.png', import.meta.url), makePng(192));
writeFileSync(new URL('../public/pwa-512.png', import.meta.url), makePng(512));
console.log('Icons generated.');
