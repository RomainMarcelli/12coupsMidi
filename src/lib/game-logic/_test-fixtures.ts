import type { Database, Json } from "@/types/database";

/**
 * Fixtures partagées pour les tests des modules game-logic.
 * Permet de fabriquer rapidement des `QuestionRow` minimalistes sans
 * passer par la BDD.
 */

type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

export function makeQuestion(overrides: Partial<QuestionRow>): QuestionRow {
  return {
    id: overrides.id ?? "q-" + Math.random().toString(36).slice(2),
    type: overrides.type ?? "quizz_2",
    category_id: overrides.category_id ?? null,
    subcategory_id: overrides.subcategory_id ?? null,
    difficulte: overrides.difficulte ?? 2,
    enonce: overrides.enonce ?? "Question ?",
    reponses: (overrides.reponses ?? []) as Json,
    bonne_reponse: overrides.bonne_reponse ?? null,
    alias: (overrides.alias ?? null) as Json | null,
    indices: (overrides.indices ?? null) as Json | null,
    image_url: overrides.image_url ?? null,
    explication: overrides.explication ?? null,
    author_id: overrides.author_id ?? null,
    created_at: overrides.created_at ?? new Date("2026-01-01").toISOString(),
  };
}

export function makeCategory(
  id: number,
  nom: string,
  couleur: string | null = "#F5B700",
): CategoryRow {
  return { id, nom, couleur };
}

export const SAMPLE_CATEGORIES = new Map<number, CategoryRow>([
  [1, makeCategory(1, "Histoire", "#8B5CF6")],
  [2, makeCategory(2, "Géographie", "#10B981")],
  [3, makeCategory(3, "Sport", "#F59E0B")],
  [4, makeCategory(4, "Art", "#EC4899")],
]);

/**
 * Générateur pseudo-aléatoire déterministe (LCG), pour tests reproductibles.
 * Usage : const rng = makeSeededRng(42); ... rng();
 */
export function makeSeededRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
