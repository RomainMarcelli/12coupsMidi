import type { Json, QuestionType } from "@/types/database";

/**
 * M6.1 — Helper pur (sans dépendance Supabase) qui transforme une
 * ligne `questions` BDD en un objet directement réimportable via
 * `/admin/questions/import` (compatible avec `questionsBulkSchema`).
 *
 * Pourquoi extrait dans son propre fichier : permet de tester
 * unitairement le round-trip export → import sans avoir à mocker
 * Supabase. Le test critique vit dans `format-export.test.ts`.
 */

/** Forme minimale d'une ligne `questions` après SELECT. */
export interface RawQuestionRow {
  id: string;
  type: QuestionType;
  category_id: number | null;
  subcategory_id: number | null;
  difficulte: number;
  enonce: string;
  reponses: Json;
  bonne_reponse: string | null;
  alias: Json | null;
  indices: Json | null;
  image_url: string | null;
  explication: string | null;
  format: string | null;
}

/** Forme retournée par l'export, compatible avec `questionsBulkSchema`. */
export interface ImportableQuestion {
  type: QuestionType;
  category_slug: string;
  subcategory_slug?: string;
  difficulte: number;
  enonce: string;
  reponses?: { text: string; correct: boolean }[];
  bonne_reponse?: string;
  alias?: string[];
  indices?: string[];
  image_url?: string;
  explication?: string;
  format?: "vrai_faux" | "ou" | "plus_moins";
}

/**
 * Convertit une ligne BDD en objet importable. On omet les champs
 * `null` / vides pour produire un JSON propre et minimal.
 */
export function formatQuestionForExport(
  row: RawQuestionRow,
  categorySlugById: Map<number, string>,
  subcategorySlugById: Map<number, string>,
): ImportableQuestion | null {
  if (row.category_id == null) return null; // sécurité : skip si orphelin
  const category_slug = categorySlugById.get(row.category_id);
  if (!category_slug) return null;

  const out: ImportableQuestion = {
    type: row.type,
    category_slug,
    difficulte: row.difficulte,
    enonce: row.enonce,
  };

  if (row.subcategory_id != null) {
    const sub = subcategorySlugById.get(row.subcategory_id);
    if (sub) out.subcategory_slug = sub;
  }

  // reponses : seulement si non-vide
  if (Array.isArray(row.reponses) && row.reponses.length > 0) {
    out.reponses = row.reponses as { text: string; correct: boolean }[];
  }

  if (row.bonne_reponse) out.bonne_reponse = row.bonne_reponse;

  if (Array.isArray(row.alias) && row.alias.length > 0) {
    out.alias = row.alias as string[];
  }

  if (Array.isArray(row.indices) && row.indices.length > 0) {
    out.indices = row.indices as string[];
  }

  if (row.image_url) out.image_url = row.image_url;
  if (row.explication) out.explication = row.explication;
  if (row.format) {
    out.format = row.format as "vrai_faux" | "ou" | "plus_moins";
  }

  return out;
}

export function formatQuestionsForExport(
  rows: RawQuestionRow[],
  categorySlugById: Map<number, string>,
  subcategorySlugById: Map<number, string>,
): ImportableQuestion[] {
  return rows
    .map((r) => formatQuestionForExport(r, categorySlugById, subcategorySlugById))
    .filter((q): q is ImportableQuestion => q != null);
}
