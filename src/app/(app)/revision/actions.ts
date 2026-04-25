"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json, QuestionType } from "@/types/database";
import type { RevQuestion } from "@/lib/revision/types";

const REVISION_MASTERY_THRESHOLD = 3;

// ===========================================================================
// Anciens : marquer un résultat sur une question déjà dans wrong_answers
// ===========================================================================

/**
 * Enregistre le résultat d'une question en révision.
 *  - Correcte : incrémente success_streak. À THRESHOLD, supprime la ligne.
 *  - Fausse : reset success_streak à 0, +1 fail_count, last_seen_at refresh.
 *
 * Si la question n'est PAS dans wrong_answers et que le résultat est faux,
 * on l'ajoute (ce qui permet aux modes "Apprendre / Flashcards / Marathon" de
 * remonter une question dans À retravailler dès qu'on la rate).
 */
export async function markRevisionResult(
  questionId: string,
  isCorrect: boolean,
): Promise<
  | { status: "mastered" | "kept" | "added" }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing, error: selErr } = await supabase
    .from("wrong_answers")
    .select("id, fail_count, success_streak")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();

  if (selErr) {
    return { status: "error", message: selErr.message };
  }

  if (!existing) {
    if (isCorrect) {
      // Pas de ligne → on n'a rien à faire pour une bonne réponse.
      return { status: "mastered" };
    }
    // Première erreur trackée pour cette question : on l'ajoute.
    const { error } = await supabase.from("wrong_answers").insert({
      user_id: user.id,
      question_id: questionId,
      fail_count: 1,
      success_streak: 0,
    });
    if (error) return { status: "error", message: error.message };
    return { status: "added" };
  }

  if (isCorrect) {
    const newStreak = existing.success_streak + 1;
    if (newStreak >= REVISION_MASTERY_THRESHOLD) {
      const { error } = await supabase
        .from("wrong_answers")
        .delete()
        .eq("id", existing.id);
      if (error) return { status: "error", message: error.message };
      return { status: "mastered" };
    }
    const { error } = await supabase
      .from("wrong_answers")
      .update({
        success_streak: newStreak,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { status: "error", message: error.message };
    return { status: "kept" };
  }

  const { error } = await supabase
    .from("wrong_answers")
    .update({
      fail_count: existing.fail_count + 1,
      success_streak: 0,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (error) return { status: "error", message: error.message };
  return { status: "kept" };
}

// ===========================================================================
// Tirage de questions selon filtres (pour Apprendre / Marathon)
// ===========================================================================

interface FetchInput {
  categoryIds: number[];
  difficulties: number[];
  types: QuestionType[];
  count: number;
}

export async function fetchQuestionsForRevision(
  input: FetchInput,
): Promise<{ status: "ok"; questions: RevQuestion[] } | { status: "error"; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("questions")
    .select(
      "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
    );
  if (input.categoryIds.length > 0)
    query = query.in("category_id", input.categoryIds);
  if (input.difficulties.length > 0)
    query = query.in("difficulte", input.difficulties);
  if (input.types.length > 0) query = query.in("type", input.types);

  // On limite côté SQL à un sur-échantillon pour pouvoir mélanger après.
  const oversample = Math.max(input.count * 4, 50);
  query = query.limit(oversample);

  const [{ data: qs, error }, { data: cats }] = await Promise.all([
    query,
    supabase.from("categories").select("id, nom, couleur"),
  ]);
  if (error) return { status: "error", message: error.message };

  const catsById = new Map((cats ?? []).map((c) => [c.id, c] as const));

  const all = (qs ?? []).map((q) => normalizeQuestion(q, catsById));
  const shuffled = shuffleArray(all).slice(0, Math.max(1, input.count));
  return { status: "ok", questions: shuffled };
}

// ===========================================================================
// Défi du jour : 5 questions déterministes par date
// ===========================================================================

export async function fetchDailyChallenge(): Promise<
  | { status: "ok"; questions: RevQuestion[]; date: string }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [{ data: qs, error }, { data: cats }] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
      )
      .in("type", ["quizz_2", "quizz_4"])
      .limit(500),
    supabase.from("categories").select("id, nom, couleur"),
  ]);
  if (error) return { status: "error", message: error.message };

  const catsById = new Map((cats ?? []).map((c) => [c.id, c] as const));
  const all = (qs ?? []).map((q) => normalizeQuestion(q, catsById));

  // Seed déterministe par date pour que tous voient les mêmes questions.
  const seed = hashSeed(date);
  const shuffled = shuffleArray(all, seed).slice(0, 5);
  return { status: "ok", questions: shuffled, date };
}

// ===========================================================================
// Mode Fiche : liste questions par catégorie (pas de quiz, lecture)
// ===========================================================================

export async function fetchFiche(
  categoryId: number,
  limit = 30,
): Promise<
  | { status: "ok"; questions: RevQuestion[] }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: qs, error }, { data: cats }] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
      )
      .eq("category_id", categoryId)
      .limit(limit),
    supabase.from("categories").select("id, nom, couleur"),
  ]);
  if (error) return { status: "error", message: error.message };

  const catsById = new Map((cats ?? []).map((c) => [c.id, c] as const));
  const all = (qs ?? []).map((q) => normalizeQuestion(q, catsById));
  return { status: "ok", questions: all };
}

// ===========================================================================
// Helpers
// ===========================================================================

interface RawQuestion {
  id: string;
  type: QuestionType;
  category_id: number | null;
  difficulte: number;
  enonce: string;
  reponses: Json;
  bonne_reponse: string | null;
  alias: Json | null;
  explication: string | null;
}

function normalizeQuestion(
  q: RawQuestion,
  catsById: Map<number, { id: number; nom: string; couleur: string | null }>,
): RevQuestion {
  const cat = q.category_id != null ? catsById.get(q.category_id) ?? null : null;
  return {
    questionId: q.id,
    type: q.type,
    enonce: q.enonce,
    reponses: Array.isArray(q.reponses)
      ? (q.reponses as { text: string; correct: boolean }[])
      : [],
    bonneReponse: q.bonne_reponse ?? "",
    alias: Array.isArray(q.alias) ? (q.alias as string[]) : [],
    explication: q.explication,
    category: cat,
    difficulte: q.difficulte,
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const out = [...arr];
  let s = seed ?? Math.floor(Math.random() * 1e9);
  function rand() {
    // Mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
