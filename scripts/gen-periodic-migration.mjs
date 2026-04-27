/**
 * G2.1 — Génère la migration SQL `0010_periodic_elements_fix_families.sql`
 * à partir du JSON officiel Wikipedia/IUPAC sur les 119 éléments.
 *
 * Sortie : un seul `INSERT ... ON CONFLICT (numero_atomique) DO UPDATE SET`
 * idempotent qui :
 *   - corrige les familles vers les 10 slugs FR (sans accents pour SQL/URL)
 *   - met à jour `nom` (français), `periode`, `groupe`, `grid_row`, `grid_col`
 *   - ajoute `wgrid_row`, `wgrid_col` (grille longue, stockés sans affichage)
 *   - ajoute `summary_fr` (laissé en anglais ; traduction manuelle plus tard)
 *
 * Lance avec : `node scripts/gen-periodic-migration.mjs`
 * Écrit dans : `supabase/migrations/0010_periodic_elements_fix_families.sql`
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const JSON_PATH = join(ROOT, "src/data/periodic-table-lookup_1.json");
const OUT_PATH = join(
  ROOT,
  "supabase/migrations/0010_periodic_elements_fix_families.sql",
);

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

/**
 * Catégories anglaises Wikipedia → slugs FR sans accents.
 * Les valeurs `unknown, …` retombent sur `proprietes-inconnues`.
 */
const CATEGORY_FR = {
  "alkali metal": "metaux-alcalins",
  "alkaline earth metal": "metaux-alcalino-terreux",
  "transition metal": "metaux-transition",
  "post-transition metal": "metaux-post-transition",
  metalloid: "metalloides",
  "diatomic nonmetal": "non-metaux-reactifs",
  "polyatomic nonmetal": "non-metaux-reactifs",
  "noble gas": "gaz-nobles",
  lanthanide: "lanthanides",
  actinide: "actinides",
};

function toFamilleFr(cat) {
  if (!cat) return "proprietes-inconnues";
  if (cat.startsWith("unknown")) return "proprietes-inconnues";
  return CATEGORY_FR[cat] ?? "proprietes-inconnues";
}

/**
 * Traduction noms EN → FR pour les 119 éléments.
 * Source : Wikipédia FR (noms officiels nomenclature IUPAC FR).
 */
const NOMS_FR = {
  hydrogen: "Hydrogène",
  helium: "Hélium",
  lithium: "Lithium",
  beryllium: "Béryllium",
  boron: "Bore",
  carbon: "Carbone",
  nitrogen: "Azote",
  oxygen: "Oxygène",
  fluorine: "Fluor",
  neon: "Néon",
  sodium: "Sodium",
  magnesium: "Magnésium",
  aluminium: "Aluminium",
  silicon: "Silicium",
  phosphorus: "Phosphore",
  sulfur: "Soufre",
  chlorine: "Chlore",
  argon: "Argon",
  potassium: "Potassium",
  calcium: "Calcium",
  scandium: "Scandium",
  titanium: "Titane",
  vanadium: "Vanadium",
  chromium: "Chrome",
  manganese: "Manganèse",
  iron: "Fer",
  cobalt: "Cobalt",
  nickel: "Nickel",
  copper: "Cuivre",
  zinc: "Zinc",
  gallium: "Gallium",
  germanium: "Germanium",
  arsenic: "Arsenic",
  selenium: "Sélénium",
  bromine: "Brome",
  krypton: "Krypton",
  rubidium: "Rubidium",
  strontium: "Strontium",
  yttrium: "Yttrium",
  zirconium: "Zirconium",
  niobium: "Niobium",
  molybdenum: "Molybdène",
  technetium: "Technétium",
  ruthenium: "Ruthénium",
  rhodium: "Rhodium",
  palladium: "Palladium",
  silver: "Argent",
  cadmium: "Cadmium",
  indium: "Indium",
  tin: "Étain",
  antimony: "Antimoine",
  tellurium: "Tellure",
  iodine: "Iode",
  xenon: "Xénon",
  cesium: "Césium",
  barium: "Baryum",
  lanthanum: "Lanthane",
  cerium: "Cérium",
  praseodymium: "Praséodyme",
  neodymium: "Néodyme",
  promethium: "Prométhium",
  samarium: "Samarium",
  europium: "Europium",
  gadolinium: "Gadolinium",
  terbium: "Terbium",
  dysprosium: "Dysprosium",
  holmium: "Holmium",
  erbium: "Erbium",
  thulium: "Thulium",
  ytterbium: "Ytterbium",
  lutetium: "Lutécium",
  hafnium: "Hafnium",
  tantalum: "Tantale",
  tungsten: "Tungstène",
  rhenium: "Rhénium",
  osmium: "Osmium",
  iridium: "Iridium",
  platinum: "Platine",
  gold: "Or",
  mercury: "Mercure",
  thallium: "Thallium",
  lead: "Plomb",
  bismuth: "Bismuth",
  polonium: "Polonium",
  astatine: "Astate",
  radon: "Radon",
  francium: "Francium",
  radium: "Radium",
  actinium: "Actinium",
  thorium: "Thorium",
  protactinium: "Protactinium",
  uranium: "Uranium",
  neptunium: "Neptunium",
  plutonium: "Plutonium",
  americium: "Américium",
  curium: "Curium",
  berkelium: "Berkélium",
  californium: "Californium",
  einsteinium: "Einsteinium",
  fermium: "Fermium",
  mendelevium: "Mendélévium",
  nobelium: "Nobélium",
  lawrencium: "Lawrencium",
  rutherfordium: "Rutherfordium",
  dubnium: "Dubnium",
  seaborgium: "Seaborgium",
  bohrium: "Bohrium",
  hassium: "Hassium",
  meitnerium: "Meitnerium",
  darmstadtium: "Darmstadtium",
  roentgenium: "Roentgenium",
  copernicium: "Copernicium",
  nihonium: "Nihonium",
  flerovium: "Flérovium",
  moscovium: "Moscovium",
  livermorium: "Livermorium",
  tennessine: "Tennesse",
  oganesson: "Oganesson",
  ununennium: "Ununennium",
};

// ---------------------------------------------------------------------------
// Génération SQL
// ---------------------------------------------------------------------------

function sqlString(s) {
  if (s === null || s === undefined) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function sqlNumber(n) {
  if (n === null || n === undefined) return "NULL";
  return String(n);
}

const data = JSON.parse(readFileSync(JSON_PATH, "utf-8"));

const rows = [];
const missingTranslations = [];
for (const key of data.order) {
  const e = data[key];
  if (!e) continue;
  const nomFr = NOMS_FR[key];
  if (!nomFr) missingTranslations.push(key);
  const famille = toFamilleFr(e.category);
  // ypos directement comme grid_row (1-10).
  // xpos directement comme grid_col (1-18).
  const gridRow = e.ypos;
  const gridCol = e.xpos;
  // grille longue : wxpos (col 1-32), wypos (row 1-7).
  const wgridRow = e.wypos ?? null;
  const wgridCol = e.wxpos ?? null;
  // État FR depuis JSON anglais.
  const phaseFr =
    e.phase === "Gas"
      ? "gaz"
      : e.phase === "Liquid"
        ? "liquide"
        : e.phase === "Solid"
          ? "solide"
          : null;
  rows.push({
    n: e.number,
    sym: e.symbol,
    nom: nomFr ?? key,
    periode: e.period,
    groupe: e.group ?? null,
    famille,
    masse: e.atomic_mass ?? null,
    etat: phaseFr,
    gridRow,
    gridCol,
    wgridRow,
    wgridCol,
    summary: e.summary ?? null,
  });
}

if (missingTranslations.length > 0) {
  console.warn(
    "Traductions FR manquantes :",
    missingTranslations.join(", "),
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const header = `-- =============================================================================
-- 0010 — Tableau périodique : vraies familles + 119 éléments (G2.1)
-- =============================================================================
-- Corrige le mapping des familles vers les 10 slugs FR officiels
-- (sans accents pour SQL/URL) :
--   metaux-alcalins / metaux-alcalino-terreux / metaux-transition
--   metaux-post-transition / metalloides / non-metaux-reactifs
--   gaz-nobles / lanthanides / actinides / proprietes-inconnues
--
-- Source : src/data/periodic-table-lookup_1.json (Wikipedia/IUPAC, 119 él.)
-- Mapping diatomic + polyatomic nonmetal → non-metaux-reactifs (1 famille
-- visuelle pour faciliter le quizz, le détail diatomique reste accessible
-- via summary).
--
-- Ajoute 2 colonnes (idempotent) :
--   - wgrid_row / wgrid_col : grille longue 32 colonnes (usage futur,
--     pas affiché dans la version compacte 18×10).
--   - summary_fr : résumé FR (laissé en anglais pour l'instant ; la
--     colonne existe pour permettre une traduction manuelle ultérieure).
--
-- Idempotent : INSERT ... ON CONFLICT (numero_atomique) DO UPDATE SET …
-- Peut être rejouée sans risque.
-- =============================================================================

ALTER TABLE public.periodic_elements
  ADD COLUMN IF NOT EXISTS wgrid_row smallint,
  ADD COLUMN IF NOT EXISTS wgrid_col smallint,
  ADD COLUMN IF NOT EXISTS summary_fr text;

-- =============================================================================
-- UPSERT — 119 éléments avec familles FR officielles
-- =============================================================================

INSERT INTO public.periodic_elements (
  numero_atomique, symbole, nom, periode, groupe, famille,
  masse_atomique, etat_standard, grid_row, grid_col,
  wgrid_row, wgrid_col, summary_fr
) VALUES
`;

const valuesSql = rows
  .map((r) => {
    return `  (${sqlNumber(r.n)}, ${sqlString(r.sym)}, ${sqlString(r.nom)}, ${sqlNumber(r.periode)}, ${sqlNumber(r.groupe)}, ${sqlString(r.famille)}, ${sqlNumber(r.masse)}, ${sqlString(r.etat)}, ${sqlNumber(r.gridRow)}, ${sqlNumber(r.gridCol)}, ${sqlNumber(r.wgridRow)}, ${sqlNumber(r.wgridCol)}, ${sqlString(r.summary)})`;
  })
  .join(",\n");

const footer = `
ON CONFLICT (numero_atomique) DO UPDATE SET
  symbole        = EXCLUDED.symbole,
  nom            = EXCLUDED.nom,
  periode        = EXCLUDED.periode,
  groupe         = EXCLUDED.groupe,
  famille        = EXCLUDED.famille,
  masse_atomique = EXCLUDED.masse_atomique,
  etat_standard  = EXCLUDED.etat_standard,
  grid_row       = EXCLUDED.grid_row,
  grid_col       = EXCLUDED.grid_col,
  wgrid_row      = EXCLUDED.wgrid_row,
  wgrid_col      = EXCLUDED.wgrid_col,
  summary_fr     = EXCLUDED.summary_fr;

-- Index sur famille (déjà créé en 0009 mais idempotent).
CREATE INDEX IF NOT EXISTS periodic_elements_famille_idx
  ON public.periodic_elements (famille);
`;

writeFileSync(OUT_PATH, header + valuesSql + footer + "\n", "utf-8");
console.log(`Migration générée : ${OUT_PATH}`);
console.log(`Total éléments : ${rows.length}`);
