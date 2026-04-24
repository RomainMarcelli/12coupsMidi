import { createClient } from "@/lib/supabase/server";
import {
  prepareCeQuestion,
  shuffleCePool,
} from "@/lib/game-logic/coup-d-envoi";
import { pickCoupParCoupRounds } from "@/lib/game-logic/coup-par-coup";
import { buildDuelThemes } from "@/lib/game-logic/duel";
import {
  pickFaceAFaceQuestions,
} from "@/lib/game-logic/faceAFace";
import { DouzeCoupsClient } from "./douze-coups-client";
import { NoQuestionsScreen } from "./no-questions";

export const metadata = { title: "Les 12 Coups de Midi" };
export const dynamic = "force-dynamic";

export default async function DouzeCoupsPage() {
  const supabase = await createClient();

  const [
    { data: quizz2Pool },
    { data: cpcPool },
    { data: quizz4Pool },
    { data: fafPool },
    { data: categories },
    { data: profile },
  ] = await Promise.all([
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
      .eq("type", "coup_par_coup")
      .limit(300),
    supabase
      .from("questions")
      .select(
        "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at, format",
      )
      .eq("type", "quizz_4")
      .limit(300),
    supabase
      .from("questions")
      .select(
        "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at, format",
      )
      .eq("type", "face_a_face")
      .limit(200),
    supabase.from("categories").select("id, nom, slug, couleur"),
    supabase.from("profiles").select("pseudo").maybeSingle(),
  ]);

  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, c] as const),
  );

  // Prépare les questions Jeu 1 (Coup d'Envoi)
  const ceQuestions = shuffleCePool(quizz2Pool ?? []).map((q) =>
    prepareCeQuestion(q, categoriesById),
  );

  // Prépare les rounds du Jeu 2 (Coup par Coup) — on prépare large (10) pour
  // avoir de la marge, la manche continuera jusqu'à un éliminé.
  const cpcRounds = pickCoupParCoupRounds(
    cpcPool ?? [],
    categoriesById,
    10,
  );

  // Duel themes = categories + comptage quizz_4 par catégorie
  const duelThemes = buildDuelThemes(quizz4Pool ?? [], categories ?? []);
  const quizz4CountByCategory = new Map(
    duelThemes.map((t) => [t.categoryId, t.questions.length] as const),
  );

  // Face-à-face final pool
  const fafQuestions = pickFaceAFaceQuestions(
    fafPool ?? [],
    categoriesById,
    50,
  );

  // Garde-fou minimums
  const hasEnoughData =
    ceQuestions.length >= 10 &&
    cpcRounds.length >= 3 &&
    duelThemes.length >= 2 &&
    fafQuestions.length >= 5;

  if (!hasEnoughData) {
    return (
      <NoQuestionsScreen
        counts={{
          quizz2: ceQuestions.length,
          cpc: cpcRounds.length,
          themes: duelThemes.length,
          faf: fafQuestions.length,
        }}
      />
    );
  }

  return (
    <DouzeCoupsClient
      ceQuestions={ceQuestions}
      cpcRounds={cpcRounds}
      duelThemes={duelThemes}
      quizz4CountByCategory={quizz4CountByCategory}
      fafQuestions={fafQuestions}
      categories={categories ?? []}
      userPseudo={profile?.pseudo ?? "Toi"}
    />
  );
}
