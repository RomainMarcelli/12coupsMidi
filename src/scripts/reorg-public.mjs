/**
 * K5 — Réorganisation + compression des assets statiques de `public/`.
 *
 * Lit la liste de mappings ci-dessous, compresse chaque image source
 * via sharp (quality 85, resize cap 512 ou 1024) et la place à sa
 * nouvelle destination dans la structure cible. Les originaux ne
 * sont PAS supprimés — l'utilisateur peut les nettoyer manuellement
 * après validation visuelle.
 *
 * Note : le logo générique (`public/logos/generic/logo.png`) est
 * désormais un PNG fourni manuellement (anciennement généré depuis
 * `public/logo.svg`, supprimé). Pour le mettre à jour, déposer le
 * nouveau PNG à cet emplacement et relancer `npm run gen-icons`.
 *
 * Usage : npm run reorg-public
 */
import sharp from "sharp";
import {
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");
const publicDir = resolve(projectRoot, "public");

// ---------------------------------------------------------------------------
// Mapping ancien → nouveau (cf. docs/CORRECTIONS_VAGUE_K.md)
// ---------------------------------------------------------------------------

/** @typedef {{ src: string; dest: string; maxSize: number; quality: number }} Mapping */

/** @type {Mapping[]} */
const MAPPINGS = [
  // Avatars présets
  { src: "AvatarFemme.png", dest: "avatars/presets/humain-femme.png", maxSize: 512, quality: 85 },
  { src: "AvatarHomme.png", dest: "avatars/presets/humain-homme.png", maxSize: 512, quality: 85 },
  { src: "ChatRoi.png", dest: "avatars/presets/chat-roi.png", maxSize: 512, quality: 85 },
  { src: "RenardRoi.png", dest: "avatars/presets/renard-roi.png", maxSize: 512, quality: 85 },
  { src: "hiboux.png", dest: "avatars/presets/hibou-sage.png", maxSize: 512, quality: 85 },
  { src: "lion.png", dest: "avatars/presets/lion-royal.png", maxSize: 512, quality: 85 },

  // Logos modes
  { src: "Duel.png", dest: "logos/modes/coup-fatal.png", maxSize: 512, quality: 85 },
  { src: "FlecheEtoike.png", dest: "logos/modes/etoile-mysterieuse.png", maxSize: 512, quality: 85 },
  { src: "ModeTv.png", dest: "logos/modes/mode-tv.png", maxSize: 512, quality: 85 },
  { src: "carte.png", dest: "logos/modes/carte.png", maxSize: 512, quality: 85 },
  { src: "défis du jour.png", dest: "logos/modes/defi-du-jour.png", maxSize: 512, quality: 85 },
  { src: "livre.png", dest: "logos/modes/fiches-revision.png", maxSize: 512, quality: 85 },

  // Logos catégories
  { src: "géographie.png", dest: "logos/categories/geographie.png", maxSize: 512, quality: 85 },
  { src: "science.png", dest: "logos/categories/science.png", maxSize: 512, quality: 85 },

  // Icônes UI génériques
  { src: "Trésor.png", dest: "icons/ui/coffre.png", maxSize: 512, quality: 85 },
  { src: "champions.png", dest: "icons/ui/champions.png", maxSize: 512, quality: 85 },
  { src: "cible.png", dest: "icons/ui/cible.png", maxSize: 512, quality: 85 },
  { src: "couronneFeu.png", dest: "icons/ui/couronne-feu.png", maxSize: 512, quality: 85 },
  { src: "etoile.png", dest: "icons/ui/etoile.png", maxSize: 512, quality: 85 },
  { src: "montre.png", dest: "icons/ui/timer.png", maxSize: 512, quality: 85 },
  { src: "récompense.png", dest: "icons/ui/recompense.png", maxSize: 512, quality: 85 },
  { src: "trophé.png", dest: "icons/ui/trophee.png", maxSize: 512, quality: 85 },
  { src: "tuile.png", dest: "icons/ui/tuile.png", maxSize: 512, quality: 85 },

  // Logo Mahylan (qualité supérieure car logo principal)
  { src: "logoMahylan.png", dest: "logos/mahylan/logo.png", maxSize: 1024, quality: 90 },

  // Doublon ou variante : on déplace tel quel dans _unsorted/
  { src: "modeTv2.png", dest: "_unsorted/mode-tv-2.png", maxSize: 1024, quality: 90 },
];

// ---------------------------------------------------------------------------

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

async function getFileSize(p) {
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return 0;
  }
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressOne(srcAbs, destAbs, maxSize, quality) {
  await ensureDir(destAbs);
  const buffer = await readFile(srcAbs);
  // PNG → PNG : compression via libpng + adaptiveFiltering. Quality
  // sur PNG = palette compression (0-100). Pour les photos type
  // avatars on garde PNG car les JPEGs perdent la transparence.
  const out = await sharp(buffer)
    .resize(maxSize, maxSize, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ quality, compressionLevel: 9, palette: quality < 90 })
    .toBuffer();
  await writeFile(destAbs, out);
}

async function copyOne(srcAbs, destAbs) {
  await ensureDir(destAbs);
  await copyFile(srcAbs, destAbs);
}

// ---------------------------------------------------------------------------

const stats = { processed: 0, skipped: 0, totalIn: 0, totalOut: 0, errors: [] };

console.log("\n=== K5 — Réorganisation + compression public/ ===\n");

for (const m of MAPPINGS) {
  const srcAbs = resolve(publicDir, m.src);
  const destAbs = resolve(publicDir, m.dest);

  if (!existsSync(srcAbs)) {
    console.log(`  [SKIP] ${m.src} — introuvable`);
    stats.skipped++;
    continue;
  }
  try {
    const sizeIn = await getFileSize(srcAbs);
    if (m.dest.startsWith("_unsorted/")) {
      await copyOne(srcAbs, destAbs);
      const sizeOut = await getFileSize(destAbs);
      console.log(`  [MOVE] ${m.src} → ${m.dest} (${fmtBytes(sizeIn)})`);
      stats.totalIn += sizeIn;
      stats.totalOut += sizeOut;
    } else {
      await compressOne(srcAbs, destAbs, m.maxSize, m.quality);
      const sizeOut = await getFileSize(destAbs);
      const ratio = sizeIn > 0 ? Math.round((1 - sizeOut / sizeIn) * 100) : 0;
      console.log(
        `  [DONE] ${m.src.padEnd(28)} → ${m.dest.padEnd(40)} ${fmtBytes(sizeIn).padStart(8)} → ${fmtBytes(sizeOut).padStart(8)}  (-${ratio}%)`,
      );
      stats.totalIn += sizeIn;
      stats.totalOut += sizeOut;
    }
    stats.processed++;
  } catch (e) {
    console.error(`  [FAIL] ${m.src} : ${e.message}`);
    stats.errors.push({ src: m.src, error: e.message });
  }
}

// ---------------------------------------------------------------------------
// Note : la génération du logo générique depuis `logo.svg` a été
// retirée — le SVG a été supprimé après que l'utilisateur a fourni
// son propre PNG dans `public/logos/generic/logo.png`. Le compresseur
// gen-icons.mjs lit directement ce PNG.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Récap
// ---------------------------------------------------------------------------

console.log(
  `\n=== Résumé : ${stats.processed} fichiers traités, ${stats.skipped} skippés ===`,
);
console.log(
  `Taille totale : ${fmtBytes(stats.totalIn)} → ${fmtBytes(stats.totalOut)} (-${
    stats.totalIn > 0
      ? Math.round((1 - stats.totalOut / stats.totalIn) * 100)
      : 0
  }%)`,
);
if (stats.errors.length > 0) {
  console.error(`\n${stats.errors.length} erreur(s) :`);
  for (const e of stats.errors) console.error(`  - ${e.src}: ${e.error}`);
  process.exit(1);
}
console.log("\nSources originales conservées dans public/ — supprime-les");
console.log("manuellement après validation visuelle.\n");
