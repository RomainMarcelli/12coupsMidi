import { createClient } from "@/lib/supabase/server";
import {
  FAF_POOL_SIZE,
  pickFaceAFaceQuestions,
} from "@/lib/game-logic/faceAFace";
import { resolveUserPseudo } from "@/lib/user-display";
import { FaceAFaceClient } from "./face-a-face-client";
import { NoFafQuestions } from "./no-questions";

export const metadata = { title: "Le Coup Fatal" };

// Tirage aléatoire à chaque chargement.
export const dynamic = "force-dynamic";

export default async function FaceAFacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: pool }, { data: categories }, { data: profile }] =
    await Promise.all([
      supabase
        .from("questions")
        .select(
          "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at, format",
        )
        .eq("type", "face_a_face")
        .limit(200),
      supabase.from("categories").select("id, nom, couleur"),
      supabase.from("profiles").select("pseudo").maybeSingle(),
    ]);

  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, c] as const),
  );

  const questions = pickFaceAFaceQuestions(
    pool ?? [],
    categoriesById,
    FAF_POOL_SIZE,
  );

  if (questions.length < 5) {
    return <NoFafQuestions />;
  }

  return (
    <FaceAFaceClient
      initialQuestions={questions}
      userPseudo={resolveUserPseudo(profile?.pseudo)}
    />
  );
}
