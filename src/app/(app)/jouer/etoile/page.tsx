import { createClient } from "@/lib/supabase/server";
import { pickOneEtoile } from "@/lib/game-logic/jeu2";
import { EtoileClient } from "./etoile-client";
import { NoQuestionPlaceholder } from "./no-question";

export const metadata = { title: "Étoile Mystérieuse" };
export const dynamic = "force-dynamic";

export default async function EtoilePage() {
  const supabase = await createClient();

  const [{ data: pool }, { data: categories }] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication, author_id, created_at",
      )
      .eq("type", "etoile")
      .limit(200),
    supabase.from("categories").select("id, nom, couleur"),
  ]);

  const categoriesById = new Map(
    (categories ?? []).map((c) => [c.id, c] as const),
  );
  const question = pickOneEtoile(pool ?? [], categoriesById);

  if (!question) return <NoQuestionPlaceholder />;

  return <EtoileClient question={question} />;
}
