import type { Database } from "@/types/database";

/**
 * Règles du Jeu 2 (Étoile Mystérieuse) :
 *  - 1 personnalité à deviner.
 *  - 5 indices révélés progressivement (1 toutes les 20 s OU sur action).
 *  - Durée max : 2 minutes.
 *  - Image pixellisée qui se dépixellise au fur et à mesure.
 *
 *  Barème XP (trouvé alors que `revealed` indices sont visibles) :
 *    1 → 500 · 2 → 400 · 3 → 300 · 4 → 200 · 5 → 100 · non trouvé → 0
 */

export const JEU2_DURATION_SECONDS = 120;
export const JEU2_AUTO_REVEAL_INTERVAL_SECONDS = 20;
export const JEU2_MAX_INDICES = 5;

type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

export interface Jeu2Question {
  id: string;
  bonne_reponse: string;
  alias: string[];
  indices: string[];
  image_url: string | null;
  category?: { nom: string; couleur: string | null };
  explication: string | null;
  difficulte: number;
}

/**
 * Tire 1 question de type 'etoile' au hasard parmi un pool (déjà filtré).
 * On accepte aussi les questions sans indices (fallback sur "questionmark…"),
 * mais on préfère celles qui en ont au moins 3.
 */
export function pickOneEtoile(
  pool: QuestionRow[],
  categoriesById: Map<number, CategoryRow>,
): Jeu2Question | null {
  if (pool.length === 0) return null;

  const withEnoughIndices = pool.filter((q) => {
    const arr = q.indices;
    return Array.isArray(arr) && arr.length >= 3;
  });
  const source = withEnoughIndices.length > 0 ? withEnoughIndices : pool;

  const idx = Math.floor(Math.random() * source.length);
  const q = source[idx];
  if (!q) return null;

  const indicesRaw = Array.isArray(q.indices) ? (q.indices as unknown[]) : [];
  const indices = indicesRaw
    .filter((i): i is string => typeof i === "string")
    .slice(0, JEU2_MAX_INDICES);

  const aliasRaw = Array.isArray(q.alias) ? (q.alias as unknown[]) : [];
  const alias = aliasRaw.filter((a): a is string => typeof a === "string");

  const cat = q.category_id ? categoriesById.get(q.category_id) : null;

  return {
    id: q.id,
    bonne_reponse: q.bonne_reponse ?? "",
    alias,
    indices,
    image_url: q.image_url,
    category: cat ? { nom: cat.nom, couleur: cat.couleur } : undefined,
    explication: q.explication,
    difficulte: q.difficulte,
  };
}

/**
 * Niveau de flou en pixels selon le nombre d'indices déjà révélés (0..5).
 * 0 indice = très flou, 5 indices = image nette.
 */
export function computeBlurPx(revealed: number): number {
  const levels = [48, 36, 24, 14, 6, 0];
  const clamped = Math.max(0, Math.min(JEU2_MAX_INDICES, revealed));
  return levels[clamped] ?? 0;
}

/**
 * XP en fonction du nombre d'indices révélés au moment où le joueur trouve.
 * Conformément au cahier des charges.
 */
export function computeJeu2Xp(revealedAtFound: number): number {
  if (revealedAtFound <= 0) return 0;
  if (revealedAtFound >= JEU2_MAX_INDICES) return 100;
  // 1 → 500, 2 → 400, 3 → 300, 4 → 200
  return 600 - revealedAtFound * 100;
}

/**
 * URL d'avatar placeholder basé sur le nom (DiceBear).
 * Utilisé si la question n'a pas d'image en base.
 */
export function placeholderAvatarUrl(seed: string): string {
  const encoded = encodeURIComponent(seed || "Inconnu");
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encoded}&backgroundColor=ffe8a8,d6ebfb,fff8ec&radius=50`;
}
