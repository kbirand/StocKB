// Generates simple solid-color PNG placeholder icons for the plugin.
// Run once: `node gen-icons.mjs`
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(CRC(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Solid RGBA PNG of given size and color.
function png(size, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 4;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const base = "com.koraybirand.stockb.sdPlugin/imgs";
const dark = [16, 20, 24];
const accent = [46, 204, 113];

const files = [
  ["plugin/marketplace", 256, dark],
  ["plugin/category-icon", 28, accent],
  ["actions/ticker/icon", 20, accent],
  ["actions/ticker/key", 72, dark]
];

mkdirSync(`${base}/plugin`, { recursive: true });
mkdirSync(`${base}/actions/ticker`, { recursive: true });

for (const [name, size, color] of files) {
  writeFileSync(`${base}/${name}.png`, png(size, color));
  writeFileSync(`${base}/${name}@2x.png`, png(size * 2, color));
}
console.log("Icons generated.");
