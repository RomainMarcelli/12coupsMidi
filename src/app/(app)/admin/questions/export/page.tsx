import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { ExportClient } from "./export-client";
import { QUESTION_TYPES } from "@/lib/schemas/question";

export const metadata = {
  title: "Admin — Export JSON",
};

/**
 * M6.1 + N3.1 — Page admin pour exporter les questions au format JSON
 * directement réimportable. 3 modes : tout, par catégorie, échantillon
 * aléatoire avec filtres.
 *
 * N3.1 — Header avec bouton retour propre, count par catégorie chargé
 * en parallèle pour afficher "Histoire (89)" plutôt que choisir à
 * l'aveugle.
 */
export default async function ExportQuestionsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: cats }, { count: total }, { data: questionRows }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, nom, slug")
        .order("nom", { ascending: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      // N3.1 — On charge juste category_id pour calculer le count par
      // catégorie côté Node. Sur ~760 questions c'est < 50ms ; si la
      // table dépasse 10k, passer à un GROUP BY SQL via RPC.
      supabase.from("questions").select("category_id"),
    ]);

  const countByCategoryId = new Map<number, number>();
  for (const row of questionRows ?? []) {
    if (row.category_id == null) continue;
    countByCategoryId.set(
      row.category_id,
      (countByCategoryId.get(row.category_id) ?? 0) + 1,
    );
  }
  const categoriesWithCount = (cats ?? []).map((c) => ({
    ...c,
    questionCount: countByCategoryId.get(c.id) ?? 0,
  }));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      {/* N3.1 — Header avec bouton retour propre + titre + sous-titre */}
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/questions"
          className="inline-flex items-center gap-2 self-start text-sm font-semibold text-foreground/70 transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour aux questions
        </Link>

        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
            Exporter les questions
          </h1>
          <p className="text-sm text-foreground/70">
            <strong className="font-semibold text-foreground">
              {total ?? 0}
            </strong>{" "}
            question{(total ?? 0) > 1 ? "s" : ""} dans la base. Télécharge
            un fichier JSON directement réimportable via{" "}
            <Link
              href="/admin/questions/import"
              className="font-semibold text-gold hover:underline"
            >
              l&apos;import
            </Link>
            .
          </p>
        </header>
      </div>

      <ExportClient
        categories={categoriesWithCount}
        totalCount={total ?? 0}
        questionTypes={[...QUESTION_TYPES]}
      />
    </main>
  );
}
