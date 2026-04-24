import { createClient } from "@/lib/supabase/server";
import {
  JEU1_TOTAL_QUESTIONS,
  pickJeu1Questions,
} from "@/lib/game-logic/jeu1";
import { Jeu1Client } from "./jeu1-client";

export const metadata = { title: "Quizz 1 / 2" };

// Cette page est rafraîchie à chaque navigation (pas de cache) — on veut un
// tirage aléatoire neuf à chaque nouvelle partie.
export const dynamic = "force-dynamic";

export default async function Jeu1Page() {
  const supabase = await createClient();

  // On tire un pool plus large (300 lignes max) pour randomiser proprement
  // côté client. À petite échelle c'est largement suffisant ; on optimisera
  // avec une RPC aléatoire quand la base contiendra des milliers de questions.
  const [{ data: pool }, { data: categories }] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at",
      )
      .eq("type", "quizz_2")
      .limit(300),
    supabase.from("categories").select("id, nom, couleur"),
  ]);

  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, c] as const),
  );
  const questions = pickJeu1Questions(
    pool ?? [],
    categoriesById,
    JEU1_TOTAL_QUESTIONS,
  );

  return <Jeu1Client initialQuestions={questions} />;
}
