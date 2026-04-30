import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { ExportClient } from "./export-client";
import { QUESTION_TYPES } from "@/lib/schemas/question";

export const metadata = {
  title: "Admin — Export JSON",
};

/**
 * M6.1 — Page admin pour exporter les questions au format JSON
 * directement réimportable. 3 modes : tout, par catégorie, échantillon
 * aléatoire avec filtres.
 */
export default async function ExportQuestionsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: cats }, { count: total }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, nom, slug")
      .order("nom", { ascending: true }),
    supabase.from("questions").select("id", { count: "exact", head: true }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/questions"
        className="flex items-center gap-1 self-start text-sm text-foreground/70 transition-colors hover:text-gold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la liste
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Exporter des questions
        </h1>
        <p className="text-sm text-foreground/70">
          Télécharge un fichier JSON directement réimportable via{" "}
          <Link
            href="/admin/questions/import"
            className="font-semibold text-gold hover:underline"
          >
            l&apos;import
          </Link>
          . Utile pour faire un backup avant une opération risquée ou
          pour partager un sous-ensemble.
        </p>
      </header>

      <ExportClient
        categories={cats ?? []}
        totalCount={total ?? 0}
        questionTypes={[...QUESTION_TYPES]}
      />
    </main>
  );
}
