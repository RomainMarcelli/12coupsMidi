/**
 * Génère toutes les icônes PWA + favicon depuis `public/logo.png`.
 *
 * Sortie (toutes à la racine de `public/`) :
 *   - favicon.ico            (16 + 32 + 48, ICO multi-résolution PNG-inside)
 *   - apple-touch-icon.png   (180×180)
 *   - icon-192.png           (PWA, transparent)
 *   - icon-512.png           (PWA, transparent)
 *   - icon-maskable-192.png  (PWA, fond opaque, safe zone)
 *   - icon-maskable-512.png  (PWA, fond opaque, safe zone)
 *
 * Usage : npm run gen-icons
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const publicDir = resolve(projectRoot, "public");

// Fond pour les versions maskable / Apple : navy nuit (cohérent avec dark theme).
const MASKABLE_BG = "#0A0E27";

const sourcePng = await readFile(resolve(publicDir, "logo.png"));

// ---------------------------------------------------------------------------
// PNG transparents (favicons + PWA "any")
// ---------------------------------------------------------------------------

async function makePng(size, withBg = false) {
  let pipeline = sharp(sourcePng).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (withBg) {
    pipeline = pipeline.flatten({ background: MASKABLE_BG });
  }
  return pipeline.png().toBuffer();
}

const png16 = await makePng(16);
const png32 = await makePng(32);
const png48 = await makePng(48);
const png180 = await makePng(180, true); // Apple n'aime pas la transparence
const png192 = await makePng(192);
const png512 = await makePng(512);

// Maskable : on garde le logo dans une safe zone de ~80% (les launchers
// rognent jusqu'à 20% sur les bords), sur fond opaque.
async function makeMaskable(size) {
  const inner = Math.round(size * 0.8);
  const innerLogo = await sharp(sourcePng)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: MASKABLE_BG,
    },
  })
    .composite([{ input: innerLogo, gravity: "center" }])
    .png()
    .toBuffer();
}

const maskable192 = await makeMaskable(192);
const maskable512 = await makeMaskable(512);

await writeFile(resolve(publicDir, "icon-192.png"), png192);
await writeFile(resolve(publicDir, "icon-512.png"), png512);
await writeFile(resolve(publicDir, "icon-maskable-192.png"), maskable192);
await writeFile(resolve(publicDir, "icon-maskable-512.png"), maskable512);
await writeFile(resolve(publicDir, "apple-touch-icon.png"), png180);

// ---------------------------------------------------------------------------
// favicon.ico — encodeur PNG-inside-ICO multi-résolution (16/32/48)
// Format ICO : ICONDIR (6 octets) + N × ICONDIRENTRY (16 octets) + PNGs.
// On embed les PNG directement (champ bytesPerPixel=32, imageSize/offset).
// Cf. https://en.wikipedia.org/wiki/ICO_(file_format)
// ---------------------------------------------------------------------------

function buildIco(images) {
  const HEADER = 6;
  const ENTRY = 16;
  const dirSize = HEADER + ENTRY * images.length;
  let offset = dirSize;

  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = 1 (ICO)
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(ENTRY);
    e.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size === 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // color count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8); // image size
    e.writeUInt32LE(offset, 12); // offset
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const ico = buildIco([
  { size: 16, data: png16 },
  { size: 32, data: png32 },
  { size: 48, data: png48 },
]);
await writeFile(resolve(publicDir, "favicon.ico"), ico);

console.log("Icônes générées dans public/ :");
console.log("  favicon.ico (16+32+48), apple-touch-icon.png (180),");
console.log("  icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png");
