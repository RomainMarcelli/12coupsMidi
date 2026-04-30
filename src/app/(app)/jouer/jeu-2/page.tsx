import { createClient } from "@/lib/supabase/server";
import {
  CPC_ROUNDS_PER_GAME,
  pickCoupParCoupRounds,
} from "@/lib/game-logic/coup-par-coup";
import { buildDuelThemes } from "@/lib/game-logic/duel";
import { resolveUserPseudo } from "@/lib/user-display";
import { CoupParCoupClient } from "./coup-par-coup-client";
import { NoRoundsPlaceholder } from "./no-rounds";

export const metadata = { title: "Le Coup par Coup" };
export const dynamic = "force-dynamic";

export default async function Jeu2Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: pool },
    { data: quizz4Pool },
    { data: categories },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at, format",
      )
      .eq("type", "coup_par_coup")
      .limit(200),
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
  const rounds = pickCoupParCoupRounds(
    pool ?? [],
    categoriesById,
    CPC_ROUNDS_PER_GAME,
  );

  if (rounds.length === 0) {
    return <NoRoundsPlaceholder />;
  }

  const duelThemes = buildDuelThemes(quizz4Pool ?? [], categories ?? []);

  return (
    <CoupParCoupClient
      rounds={rounds}
      duelThemes={duelThemes}
      userPseudo={resolveUserPseudo(profile?.pseudo)}
    />
  );
}
