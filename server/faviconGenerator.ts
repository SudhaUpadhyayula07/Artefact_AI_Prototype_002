import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Generates a flat PNG buffer for Artefact.AI icon:
 * - Flat #5E60CE background (R:94, G:96, B:206)
 * - White (#FFFFFF) geometric 'A' mark in the center
 * - Flat #E0AAFF (R:224, G:170, B:255) square accent in top-right
 */
export function generateIconPng(size: number): Buffer {
  const rawData = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter type 0 (None)

    // Normalised coordinates 0..64
    const ny = (y / size) * 64;

    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 64;
      const px = rowStart + 1 + x * 4;

      // Default background: #5E60CE
      let r = 94;
      let g = 96;
      let b = 206;
      const a = 255;

      // Top-right accent square: x in [42, 50], y in [14, 22] -> #E0AAFF
      if (nx >= 42 && nx <= 50 && ny >= 14 && ny <= 22) {
        r = 224;
        g = 170;
        b = 255;
      } else if (ny >= 14 && ny <= 48) {
        // Geometric 'A' in white (#FFFFFF)
        // Apex at (32, 14), base from x=16 to x=48 at y=48
        const progress = (ny - 14) / (48 - 14); // 0 at top, 1 at bottom
        const halfOuter = progress * 16; // 0 at top, 16 at bottom
        const halfInner = Math.max(0, (ny - 24) / (48 - 24)) * 9;

        const distFromCenter = Math.abs(nx - 32);
        const inOuterTriangle = distFromCenter <= halfOuter + 2.2;
        const inInnerCutout = ny > 25 && distFromCenter < halfInner;
        const inCrossbar = ny >= 33 && ny <= 38.5 && distFromCenter <= halfOuter;

        if (inOuterTriangle && (!inInnerCutout || inCrossbar)) {
          r = 255;
          g = 255;
          b = 255;
        }
      }

      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

export function generateFaviconIco(): Buffer {
  const png32 = generateIconPng(32);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // 1 image

  const dir = Buffer.alloc(16);
  dir[0] = 32; // width
  dir[1] = 32; // height
  dir[2] = 0; // palette
  dir[3] = 0; // reserved
  dir.writeUInt16LE(1, 4); // color planes
  dir.writeUInt16LE(32, 6); // bits per pixel
  dir.writeUInt32LE(png32.length, 8); // size
  dir.writeUInt32LE(22, 12); // offset (6 + 16)

  return Buffer.concat([header, dir, png32]);
}

export function ensurePublicFavicons(publicDir: string): void {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const files: Array<{ name: string; gen: () => Buffer }> = [
    { name: 'favicon.ico', gen: () => generateFaviconIco() },
    { name: 'apple-touch-icon.png', gen: () => generateIconPng(180) },
    { name: 'icon-192.png', gen: () => generateIconPng(192) },
    { name: 'icon-512.png', gen: () => generateIconPng(512) },
  ];

  for (const file of files) {
    const target = path.join(publicDir, file.name);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, file.gen());
    }
  }
}
