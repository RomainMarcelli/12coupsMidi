/**
 * Types et helpers du tableau périodique (F2.1 + G2.1).
 */

export interface PeriodicElement {
  numero_atomique: number;
  symbole: string;
  nom: string;
  periode: number;
  groupe: number | null;
  famille: PeriodicFamily;
  masse_atomique: number | null;
  etat_standard: "solide" | "liquide" | "gaz" | "inconnu" | null;
  grid_row: number;
  grid_col: number;
  /**
   * Position dans la grille longue 32 colonnes (G2.1). Stocké en BDD
   * pour usage futur, non affiché dans la version compacte 18×10.
   */
  wgrid_row?: number | null;
  wgrid_col?: number | null;
  /** Résumé en français (G2.1). Peut être anglais en fallback. */
  summary_fr?: string | null;
}

/**
 * I2.1 — 10 familles officielles standards FR.
 * Slugs sans accents (compatibles SQL/URL).
 *
 * Diff vs H2.1 (revert) :
 *   • metaux-pauvres → metaux-post-transition (terminologie officielle FR)
 *   • Suppression de la distinction non-metaux / non-metaux-reactifs :
 *     une seule famille `non-metaux-reactifs` pour TOUS les non-métaux
 *     (validé par utilisateur, mapping ÉLÉMENT → FAMILLE refait à zéro
 *     dans la migration 0014).
 *   • Astate (85) classé dans les métaux de post-transition.
 *   • Hydrogène (1) classé dans les non-métaux réactifs.
 */
export type PeriodicFamily =
  | "metaux-alcalins"
  | "metaux-alcalino-terreux"
  | "metaux-transition"
  | "metaux-post-transition"
  | "metalloides"
  | "non-metaux-reactifs"
  | "gaz-nobles"
  | "lanthanides"
  | "actinides"
  | "proprietes-inconnues";

/**
 * Palette pastel par famille. `bg` = fond de la cellule (toujours clair
 * pour rester lisible avec `text-on-color` qui force le texte navy).
 * Libellés au pluriel (cohérents avec la légende et la barre de progrès).
 */
export const FAMILY_STYLES: Record<
  PeriodicFamily,
  { bg: string; label: string }
> = {
  "metaux-alcalins":         { bg: "#fce4ec", label: "Métaux alcalins" },
  "metaux-alcalino-terreux": { bg: "#ffcdd2", label: "Métaux alcalino-terreux" },
  "metaux-transition":       { bg: "#e1bee7", label: "Métaux de transition" },
  "metaux-post-transition":  { bg: "#b3e5fc", label: "Métaux de post-transition" },
  metalloides:               { bg: "#c8e6c9", label: "Métalloïdes" },
  "non-metaux-reactifs":     { bg: "#fff9c4", label: "Non-métaux réactifs" },
  "gaz-nobles":              { bg: "#f8bbd0", label: "Gaz nobles" },
  lanthanides:               { bg: "#bbdefb", label: "Lanthanides" },
  actinides:                 { bg: "#ffccbc", label: "Actinides" },
  "proprietes-inconnues":    { bg: "#e0e0e0", label: "Propriétés inconnues" },
};

/**
 * Fallback utilisé quand `element.famille` n'est pas reconnu (par ex.
 * données BDD legacy avec d'anciennes valeurs en français). Évite un
 * crash `undefined.bg` côté rendu.
 */
const UNKNOWN_FAMILY_STYLE = { bg: "#9ca3af", label: "Inconnu" } as const;

export function getFamilyStyle(famille: string): { bg: string; label: string } {
  return (
    FAMILY_STYLES[famille as PeriodicFamily] ?? UNKNOWN_FAMILY_STYLE
  );
}

export const ALL_FAMILIES: PeriodicFamily[] = [
  "metaux-alcalins",
  "metaux-alcalino-terreux",
  "metaux-transition",
  "metaux-post-transition",
  "metalloides",
  "non-metaux-reactifs",
  "gaz-nobles",
  "lanthanides",
  "actinides",
  "proprietes-inconnues",
];

/**
 * Normalise une chaîne pour matching tolérant : minuscule, sans accents,
 * sans ponctuation, espaces collapsés.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Distance de Levenshtein simple pour tolérance de 1 typo sur les noms
 * d'éléments (< 4-5 caractères de différence pas autorisé).
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j - 1]!, dp[j]!);
      }
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

/**
 * G3.2 — Match sur le NOM FRANÇAIS uniquement (pas de symbole).
 *
 * Utilisé par le mode Quizz qui veut faire mémoriser les noms, pas
 * juste les symboles trop devinables.
 *
 * - Match exact normalisé (case + accents)
 * - Tolérance Levenshtein ≤ 1 si l'input fait au moins 5 caractères
 *   (≥ 5 car en dessous une distance de 1 = trop de faux positifs sur
 *   des noms courts comme "Or" / "Fer").
 */
export function matchElementByName(
  input: string,
  elements: ReadonlyArray<PeriodicElement>,
): PeriodicElement | null {
  const normInput = normalizeForMatch(input);
  if (!normInput) return null;
  // Match exact sur le nom normalisé.
  const exact = elements.find((e) => normalizeForMatch(e.nom) === normInput);
  if (exact) return exact;
  // Tolérance Levenshtein ≤ 1 pour les noms longs (≥ 5 chars).
  if (normInput.length >= 5) {
    let best: PeriodicElement | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const e of elements) {
      const d = levenshtein(normalizeForMatch(e.nom), normInput);
      if (d < bestDist && d <= 1) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }
  return null;
}

/**
 * Cherche un élément qui matche `input` (par symbole exact OU par nom
 * français avec tolérance Levenshtein ≤ 1).
 *
 * Retourne `null` si aucun match.
 */
export function matchElement(
  input: string,
  elements: ReadonlyArray<PeriodicElement>,
): PeriodicElement | null {
  const normInput = normalizeForMatch(input);
  if (!normInput) return null;

  // 1. Match exact sur le symbole (case insensitive). Le symbole doit
  //    être strictement égal pour éviter de matcher "C" sur "Ca/Cl/...".
  const symbolMatch = elements.find(
    (e) => e.symbole.toLowerCase() === input.trim().toLowerCase(),
  );
  if (symbolMatch) return symbolMatch;

  // 2. Match exact sur le nom normalisé.
  const exactName = elements.find(
    (e) => normalizeForMatch(e.nom) === normInput,
  );
  if (exactName) return exactName;

  // 3. Tolérance Levenshtein ≤ 1 sur le nom (mais seulement si l'input
  //    fait au moins 4 caractères, pour éviter "fer" → "fe" via 1 distance).
  if (normInput.length >= 4) {
    let best: PeriodicElement | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const e of elements) {
      const d = levenshtein(normalizeForMatch(e.nom), normInput);
      if (d < bestDist && d <= 1) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  return null;
}
