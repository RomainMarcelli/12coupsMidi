import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json, QuestionType } from "@/types/database";
import type { RevQuestion } from "@/lib/revision/types";
import { RevisionClient, type CategoryRow } from "./revision-client";

export const metadata = { title: "Mode Révision" };
export const dynamic = "force-dynamic";

interface RawQ {
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

export default async function RevisionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: wrongs },
    { data: categories },
    { count: totalQuestionsCount },
    { data: favorites },
  ] = await Promise.all([
    supabase
      .from("wrong_answers")
      .select("id, fail_count, success_streak, question_id")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false }),
    supabase.from("categories").select("id, nom, couleur, slug"),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    // I1.5 — IDs des questions favorites pour afficher l'étoile remplie
    // partout où elle apparaît (Marathon, Retravailler, Catégories…).
    supabase
      .from("user_favorites")
      .select("question_id")
      .eq("user_id", user.id),
  ]);

  // Fetch les questions ratées (jointe en deux étapes pour éviter le typage Postgres)
  const wrongList = (wrongs ?? []).filter(
    (w): w is { id: number; fail_count: number; success_streak: number; question_id: string } =>
      !!w.question_id,
  );
  let wrongQuestions: RevQuestion[] = [];
  if (wrongList.length > 0) {
    const { data: qs } = await supabase
      .from("questions")
      .select(
        "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
      )
      .in(
        "id",
        wrongList.map((w) => w.question_id),
      );
    const catsById = new Map(
      (categories ?? []).map((c) => [c.id, c] as const),
    );
    const qById = new Map((qs ?? []).map((q) => [q.id, q as RawQ] as const));
    wrongQuestions = wrongList
      .map((w) => qById.get(w.question_id))
      .filter((q): q is RawQ => !!q)
      .map((q) => normalize(q, catsById));
  }

  const favoriteIds = (favorites ?? []).map((f) => f.question_id);

  return (
    <RevisionClient
      categories={(categories ?? []) as CategoryRow[]}
      wrongQuestions={wrongQuestions}
      totalQuestionsAvailable={totalQuestionsCount ?? 0}
      favoriteIds={favoriteIds}
    />
  );
}

function normalize(
  q: RawQ,
  catsById: Map<number, { id: number; nom: string; couleur: string | null; slug: string }>,
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
    category: cat ? { id: cat.id, nom: cat.nom, couleur: cat.couleur } : null,
    difficulte: q.difficulte,
  };
}
