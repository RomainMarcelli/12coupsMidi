import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json, QuestionType } from "@/types/database";
import type { RevQuestion } from "@/lib/revision/types";
import { FichesStudyClient } from "./fiches-study-client";

export const metadata = { title: "Fiches de révision" };
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

/**
 * Page d'étude reveal-style pour les Fiches de révision (E3.1).
 *
 * Le slug "toutes" déclenche le mélange de toutes les catégories.
 * Sinon : lookup par slug, fetch des questions associées.
 */
export default async function FicheStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cas spécial "toutes" — mélange toutes les catégories
  const isAll = slug === "toutes";

  let categoryName: string | null = null;
  let categoryColor: string | null = null;

  let categoryId: number | null = null;
  if (!isAll) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id, nom, couleur")
      .eq("slug", slug)
      .maybeSingle();
    if (!cat) notFound();
    categoryId = cat.id;
    categoryName = cat.nom;
    categoryColor = cat.couleur;
  }

  // Fetch les questions
  let qsBuilder = supabase
    .from("questions")
    .select(
      "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
    )
    .limit(80);
  if (categoryId !== null) {
    qsBuilder = qsBuilder.eq("category_id", categoryId);
  }
  const { data: qsRaw } = await qsBuilder;

  const { data: cats } = await supabase
    .from("categories")
    .select("id, nom, couleur");
  const catsById = new Map((cats ?? []).map((c) => [c.id, c] as const));

  const questions: RevQuestion[] = (qsRaw ?? []).map((q) => {
    const r = q as RawQ;
    const cat = r.category_id != null ? catsById.get(r.category_id) ?? null : null;
    return {
      questionId: r.id,
      type: r.type,
      enonce: r.enonce,
      reponses: Array.isArray(r.reponses)
        ? (r.reponses as { text: string; correct: boolean }[])
        : [],
      bonneReponse: r.bonne_reponse ?? "",
      alias: Array.isArray(r.alias) ? (r.alias as string[]) : [],
      explication: r.explication,
      category: cat
        ? { id: cat.id, nom: cat.nom, couleur: cat.couleur }
        : null,
      difficulte: r.difficulte,
    };
  });

  // Mélange Fisher-Yates
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = questions[i]!;
    questions[i] = questions[j]!;
    questions[j] = tmp;
  }

  return (
    <FichesStudyClient
      questions={questions}
      categoryName={isAll ? "Toutes les catégories" : categoryName}
      categoryColor={isAll ? null : categoryColor}
    />
  );
}
