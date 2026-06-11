/**
 * PWA icon generator using pure Node.js (no native binaries needed).
 * Creates colored PNG icons with the MHédia BTL text.
 * Run: node scripts/generate-icons.cjs
 */

const fs = require("fs");
const path = require("path");

const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// We generate a minimal PNG programmatically (solid colored square with "M" letter).
// This is a pure JS PNG encoder for simple solid-color images.

function createPNG(width, height, r, g, b) {
  const zlib = require("zlib");

  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR[8] = 8; // bit depth
  IHDR[9] = 2; // color type: RGB
  IHDR[10] = 0; IHDR[11] = 0; IHDR[12] = 0;

  // Create raw image data (RGB, each row prefixed with 0 filter byte)
  const rowSize = width * 3;
  const raw = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowSize + 1)] = 0; // filter type
    for (let x = 0; x < width; x++) {
      const offset = y * (rowSize + 1) + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([lenBuffer, typeBuffer, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", IHDR),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// #105062 = rgb(16, 80, 98)
const R = 16, G = 80, B = 98;

let count = 0;
for (const size of SIZES) {
  const png = createPNG(size, size, R, G, B);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), png);
  console.log(`✓ icon-${size}x${size}.png`);
  count++;
}

// Maskable variants (same color, just duplicated)
for (const size of [192, 512]) {
  const png = createPNG(size, size, R, G, B);
  fs.writeFileSync(path.join(iconsDir, `icon-maskable-${size}x${size}.png`), png);
  console.log(`✓ icon-maskable-${size}x${size}.png`);
  count++;
}

// Also generate a 32x32 for favicon
const png32 = createPNG(32, 32, R, G, B);
fs.writeFileSync(path.join(iconsDir, `icon-32x32.png`), png32);
console.log(`✓ icon-32x32.png`);

console.log(`\n✅ ${count + 1} PWA icons generated in public/icons/`);
console.log("ℹ  Replace with real branded icons after using: pnpm generate-icons (needs sharp)");
