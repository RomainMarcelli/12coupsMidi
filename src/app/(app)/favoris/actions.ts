"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RevQuestion } from "@/lib/revision/types";
import type { Json, QuestionType } from "@/types/database";

export type ToggleResult =
  | { status: "added" }
  | { status: "removed" }
  | { status: "error"; message: string };

/** Bascule l'état favori d'une question pour l'utilisateur connecté. */
export async function toggleFavorite(
  questionId: string,
): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("user_favorites")
    .select("question_id")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("question_id", questionId);
    if (error) return { status: "error", message: error.message };
    return { status: "removed" };
  }

  const { error } = await supabase
    .from("user_favorites")
    .insert({ user_id: user.id, question_id: questionId });
  if (error) return { status: "error", message: error.message };
  return { status: "added" };
}

/** Renvoie la liste des questions favorites de l'utilisateur. */
export async function fetchFavorites(): Promise<
  | { status: "ok"; questions: RevQuestion[] }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: favs, error: favErr } = await supabase
    .from("user_favorites")
    .select("question_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (favErr) return { status: "error", message: favErr.message };

  const ids = (favs ?? []).map((f) => f.question_id);
  if (ids.length === 0) return { status: "ok", questions: [] };

  const [{ data: qs, error }, { data: cats }] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
      )
      .in("id", ids),
    supabase.from("categories").select("id, nom, couleur"),
  ]);
  if (error) return { status: "error", message: error.message };

  const catsById = new Map((cats ?? []).map((c) => [c.id, c] as const));
  const questions: RevQuestion[] = (qs ?? []).map((q) => {
    const raw = q as {
      id: string;
      type: QuestionType;
      category_id: number | null;
      difficulte: number;
      enonce: string;
      reponses: Json;
      bonne_reponse: string | null;
      alias: Json | null;
      explication: string | null;
    };
    const cat =
      raw.category_id != null ? catsById.get(raw.category_id) ?? null : null;
    return {
      questionId: raw.id,
      type: raw.type,
      enonce: raw.enonce,
      reponses: Array.isArray(raw.reponses)
        ? (raw.reponses as { text: string; correct: boolean }[])
        : [],
      bonneReponse: raw.bonne_reponse ?? "",
      alias: Array.isArray(raw.alias) ? (raw.alias as string[]) : [],
      explication: raw.explication,
      category: cat ? { id: cat.id, nom: cat.nom, couleur: cat.couleur } : null,
      difficulte: raw.difficulte,
    };
  });
  return { status: "ok", questions };
}

export async function fetchFavoriteIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_favorites")
    .select("question_id")
    .eq("user_id", user.id);
  return (data ?? []).map((d) => d.question_id);
}
