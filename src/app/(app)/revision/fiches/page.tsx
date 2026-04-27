import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FichesCategoriesClient } from "./fiches-categories-client";

export const metadata = { title: "Fiches de révision" };
export const dynamic = "force-dynamic";

/**
 * Page de sélection de catégorie pour les Fiches de révision (E2.4).
 * Affiche une grille de cards colorées (une par catégorie) avec compteur
 * de fiches. Le clic redirige vers /revision/fiches/[slug].
 */
export default async function FichesCategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Toutes les catégories
  const { data: categories } = await supabase
    .from("categories")
    .select("id, nom, slug, couleur")
    .order("nom");

  // 2. Comptage des questions par catégorie. On charge juste les ids
  // groupés (limit haut suffisant). Plus simple qu'un GROUP BY pour
  // PostgREST.
  const { data: questionRows } = await supabase
    .from("questions")
    .select("id, category_id")
    .limit(5000);

  const countsByCat = new Map<number, number>();
  for (const q of questionRows ?? []) {
    if (q.category_id == null) continue;
    countsByCat.set(q.category_id, (countsByCat.get(q.category_id) ?? 0) + 1);
  }

  const categoriesWithCount = (categories ?? []).map((c) => ({
    id: c.id,
    nom: c.nom,
    slug: c.slug,
    couleur: c.couleur,
    count: countsByCat.get(c.id) ?? 0,
  }));

  const totalQuestions = categoriesWithCount.reduce(
    (sum, c) => sum + c.count,
    0,
  );

  return (
    <FichesCategoriesClient
      categories={categoriesWithCount}
      totalQuestions={totalQuestions}
    />
  );
}
