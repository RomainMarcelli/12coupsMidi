import { createClient } from "@/lib/supabase/server";
import { shuffleCePool, prepareCeQuestion } from "@/lib/game-logic/coup-d-envoi";
import { buildDuelThemes } from "@/lib/game-logic/duel";
import { resolveUserPseudo } from "@/lib/user-display";
import { CoupDEnvoiClient } from "./coup-d-envoi-client";
import { NoCeQuestions } from "./no-questions";

export const metadata = { title: "Le Coup d'Envoi" };

// Tirage aléatoire à chaque chargement.
export const dynamic = "force-dynamic";

export default async function Jeu1Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: pool }, { data: quizz4Pool }, { data: categories }, { data: profile }] =
    await Promise.all([
      supabase
        .from("questions")
        .select(
          "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at, format",
        )
        .eq("type", "quizz_2")
        .limit(300),
      supabase
        .from("questions")
        .select(
          "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at, format",
        )
        .eq("type", "quizz_4")
        .limit(300),
      supabase.from("categories").select("id, nom, slug, couleur"),
      supabase.from("profiles").select("pseudo").maybeSingle(),
    ]);

  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, c] as const),
  );

  const shuffled = shuffleCePool(pool ?? []);
  const questions = shuffled.map((q) => prepareCeQuestion(q, categoriesById));

  if (questions.length < 10) {
    return <NoCeQuestions count={questions.length} />;
  }

  const duelThemes = buildDuelThemes(quizz4Pool ?? [], categories ?? []);

  return (
    <CoupDEnvoiClient
      initialQuestions={questions}
      duelThemes={duelThemes}
      userPseudo={resolveUserPseudo(profile?.pseudo)}
    />
  );
}
