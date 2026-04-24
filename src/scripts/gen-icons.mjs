/**
 * Génère les icônes PWA à partir de public/logo.svg.
 * Usage : npm run gen-icons
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const publicDir = resolve(projectRoot, "public");
const outDir = resolve(publicDir, "icons");
await mkdir(outDir, { recursive: true });

const logoSvg = await readFile(resolve(publicDir, "logo.svg"));

// Maskable : rayons réduits pour laisser une safe zone de 10% autour.
// On encadre le logo sur un fond bleu nuit pour garantir le contraste.
const maskableSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0B1F4D"/>
  <g transform="translate(76 76) scale(1.80)">${logoSvg
    .toString()
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")}</g>
</svg>
`);

// 192 et 512 : logo plein avec fond transparent
await sharp(logoSvg)
  .resize(192, 192)
  .png()
  .toFile(resolve(outDir, "icon-192.png"));

await sharp(logoSvg)
  .resize(512, 512)
  .png()
  .toFile(resolve(outDir, "icon-512.png"));

// Maskable (safe zone + fond bleu)
await sharp(maskableSvg)
  .resize(512, 512)
  .png()
  .toFile(resolve(outDir, "icon-maskable-512.png"));

// Favicon PNG 32x32 (on laisse Next.js gérer le .ico via metadata.icons)
await sharp(logoSvg)
  .resize(32, 32)
  .png()
  .toFile(resolve(publicDir, "favicon-32.png"));

// Apple touch icon 180
await sharp(logoSvg)
  .resize(180, 180)
  .flatten({ background: "#0B1F4D" })
  .png()
  .toFile(resolve(publicDir, "apple-touch-icon.png"));

console.log("Icônes générées dans public/icons/ et public/");
