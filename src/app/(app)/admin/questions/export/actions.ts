"use server";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import {
  formatQuestionsForExport,
  type ImportableQuestion,
  type RawQuestionRow,
} from "./format-export";
import type { QuestionType } from "@/lib/schemas/question";

/**
 * M6.1 — Server actions pour exporter les questions au format
 * importable. Chaque action commence par `requireAdmin()` côté
 * serveur — pas juste côté UI — pour garantir qu'on ne peut pas
 * exfiltrer la base via un appel direct à l'action.
 */

export type ExportParams =
  | { mode: "all" }
  | { mode: "by-category"; categoryIds: number[] }
  | {
      mode: "sample";
      count: number;
      filters?: {
        categoryId?: number;
        type?: QuestionType;
        difficulte?: number;
      };
    };

export type ExportResult =
  | { success: true; data: ImportableQuestion[]; count: number }
  | { success: false; message: string };

const QUESTION_COLUMNS =
  "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, format";

export async function exportQuestions(
  params: ExportParams,
): Promise<ExportResult> {
  await requireAdmin();
  const supabase = await createClient();

  // Charge les maps de slugs (toujours nécessaires).
  const [{ data: cats }, { data: subcats }] = await Promise.all([
    supabase.from("categories").select("id, slug"),
    supabase.from("subcategories").select("id, slug"),
  ]);
  const categorySlugById = new Map(
    (cats ?? []).map((c) => [c.id, c.slug] as const),
  );
  const subcategorySlugById = new Map(
    (subcats ?? []).map((s) => [s.id, s.slug] as const),
  );

  // Construit la query selon le mode.
  let rows: RawQuestionRow[] = [];

  if (params.mode === "all") {
    const { data, error } = await supabase
      .from("questions")
      .select(QUESTION_COLUMNS);
    if (error) return { success: false, message: error.message };
    rows = (data ?? []) as RawQuestionRow[];
  } else if (params.mode === "by-category") {
    if (params.categoryIds.length === 0) {
      return { success: false, message: "Aucune catégorie sélectionnée." };
    }
    const { data, error } = await supabase
      .from("questions")
      .select(QUESTION_COLUMNS)
      .in("category_id", params.categoryIds);
    if (error) return { success: false, message: error.message };
    rows = (data ?? []) as RawQuestionRow[];
  } else {
    // sample : on récupère TOUS les candidats matchant les filtres, puis
    // on tire `count` au hasard côté serveur. C'est OK pour la taille
    // actuelle de la table (<10k). Si elle gonfle, passer à un
    // RANDOM() côté SQL.
    let query = supabase.from("questions").select(QUESTION_COLUMNS);
    if (params.filters?.categoryId != null) {
      query = query.eq("category_id", params.filters.categoryId);
    }
    if (params.filters?.type != null) {
      query = query.eq("type", params.filters.type);
    }
    if (params.filters?.difficulte != null) {
      query = query.eq("difficulte", params.filters.difficulte);
    }
    const { data, error } = await query;
    if (error) return { success: false, message: error.message };
    const all = (data ?? []) as RawQuestionRow[];
    rows = pickRandom(all, params.count);
  }

  const data = formatQuestionsForExport(
    rows,
    categorySlugById,
    subcategorySlugById,
  );

  return { success: true, data, count: data.length };
}

function pickRandom<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return arr;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}
