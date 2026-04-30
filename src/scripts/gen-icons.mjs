/**
 * Génère toutes les icônes PWA + favicons depuis les logos sources.
 *
 * O — Le script produit DEUX sets d'icônes en une commande :
 *   1. Set "generic" depuis `public/logos/generic/logo.png`
 *      → écrit à la racine de `public/`
 *   2. Set "mahylan" depuis `public/logos/mahylan/logo.png`
 *      → écrit dans `public/icons/mahylan/` + `public/favicon-mahylan.ico`
 *
 * Ces icônes sont servies selon `NEXT_PUBLIC_BRAND_MODE` au build :
 *   - mode "generic" → assets racine public/
 *   - mode "mahylan" → assets sous public/icons/mahylan/
 *
 * Voir docs/BRAND_MODE.md pour le système global.
 *
 * Usage : `npm run gen-icons` (régénère TOUT). Pour ne régénérer
 * qu'un seul brand après modif d'un PNG source, simplement
 * supprimer les icônes de l'autre brand puis relancer — sharp
 * ne fait que ~50ms/icône, le coût total est négligeable.
 *
 * Sortie par brand :
 *   - favicon[-mahylan].ico  (16 + 32 + 48, multi-résolution PNG-inside)
 *   - apple-touch-icon.png   (180×180, fond opaque navy)
 *   - icon-192.png           (PWA, transparent)
 *   - icon-512.png           (PWA, transparent)
 *   - icon-maskable-192.png  (PWA, fond opaque, safe zone 80%)
 *   - icon-maskable-512.png  (PWA, fond opaque, safe zone 80%)
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const publicDir = resolve(projectRoot, "public");

// Fond pour les versions maskable / Apple : navy nuit (cohérent avec dark theme).
const MASKABLE_BG = "#0A0E27";

/**
 * Configuration des 2 brands. Pour ajouter un brand "famille" plus
 * tard, ajouter une entrée ici et configurer
 * `NEXT_PUBLIC_BRAND_MODE=famille` dans le déploiement Vercel
 * correspondant + `MAHYLAN_BRAND` clone dans `src/lib/build-brand.ts`.
 */
const BRANDS = [
  {
    name: "generic",
    sourcePath: resolve(publicDir, "logos/generic/logo.png"),
    outputDir: publicDir,
    faviconName: "favicon.ico",
  },
  {
    name: "mahylan",
    sourcePath: resolve(publicDir, "logos/mahylan/logo.png"),
    outputDir: resolve(publicDir, "icons/mahylan"),
    faviconName: "../../favicon-mahylan.ico", // remonte à la racine public/
  },
];

// ---------------------------------------------------------------------------
// Helpers PNG : transparent (any) ou fond opaque (apple, maskable)
// ---------------------------------------------------------------------------

async function makePng(sourcePng, size, withBg = false) {
  // L+ — `ensureAlpha()` garantit que le canal alpha est conservé
  // jusqu'au final, même quand sharp optimiserait en stripping.
  // `palette: false` empêche l'encodage en mode palette (qui peut
  // perdre la transparence sur certains viewers).
  let pipeline = sharp(sourcePng)
    .ensureAlpha()
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  if (withBg) {
    pipeline = pipeline.flatten({ background: MASKABLE_BG });
  }
  return pipeline.png({ palette: false, compressionLevel: 9 }).toBuffer();
}

// Maskable : logo dans une safe zone de ~80% (les launchers Android
// rognent jusqu'à 20% sur les bords), sur fond opaque.
async function makeMaskable(sourcePng, size) {
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

// ---------------------------------------------------------------------------
// favicon.ico — encodeur PNG-inside-ICO multi-résolution (16/32/48)
// ---------------------------------------------------------------------------

function buildIco(images) {
  const HEADER = 6;
  const ENTRY = 16;
  const dirSize = HEADER + ENTRY * images.length;
  let offset = dirSize;

  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(ENTRY);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// ---------------------------------------------------------------------------
// Génération d'un brand
// ---------------------------------------------------------------------------

async function generateBrand(brand) {
  console.log(`\n→ Brand "${brand.name}" depuis ${brand.sourcePath}`);
  const sourcePng = await readFile(brand.sourcePath);
  await mkdir(brand.outputDir, { recursive: true });

  const [png16, png32, png48, png180, png192, png512, mask192, mask512] =
    await Promise.all([
      makePng(sourcePng, 16),
      makePng(sourcePng, 32),
      makePng(sourcePng, 48),
      makePng(sourcePng, 180, true), // Apple n'aime pas la transparence
      makePng(sourcePng, 192),
      makePng(sourcePng, 512),
      makeMaskable(sourcePng, 192),
      makeMaskable(sourcePng, 512),
    ]);

  await Promise.all([
    writeFile(resolve(brand.outputDir, "icon-192.png"), png192),
    writeFile(resolve(brand.outputDir, "icon-512.png"), png512),
    writeFile(resolve(brand.outputDir, "icon-maskable-192.png"), mask192),
    writeFile(resolve(brand.outputDir, "icon-maskable-512.png"), mask512),
    writeFile(resolve(brand.outputDir, "apple-touch-icon.png"), png180),
    writeFile(
      resolve(brand.outputDir, brand.faviconName),
      buildIco([
        { size: 16, data: png16 },
        { size: 32, data: png32 },
        { size: 48, data: png48 },
      ]),
    ),
  ]);

  console.log(`  ✓ favicon → ${brand.faviconName}`);
  console.log(
    `  ✓ icon-192/512 + maskable + apple-touch-icon → ${brand.outputDir}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

for (const brand of BRANDS) {
  await generateBrand(brand);
}

console.log("\nIcônes générées :");
console.log("  Generic : public/{favicon.ico, icon-*.png, apple-touch-icon.png}");
console.log("  Mahylan : public/{favicon-mahylan.ico, icons/mahylan/icon-*.png, ...}");
