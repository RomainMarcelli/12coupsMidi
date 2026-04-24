import Link from "next/link";
import { Download, FileUp, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { QUESTION_TYPES, type QuestionType } from "@/lib/schemas/question";
import { QuestionsTable } from "./questions-table";
import { Filters } from "./filters";
import { Pagination } from "./pagination";

export const metadata = {
  title: "Admin — Questions",
};

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  q?: string;
  type?: string;
  category?: string;
  difficulte?: string;
  page?: string;
}>;

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Catégories (pour les filtres + affichage du nom)
  const { data: categories } = await supabase
    .from("categories")
    .select("id, nom, slug, couleur")
    .order("nom");

  // Requête questions avec filtres + pagination
  let query = supabase
    .from("questions")
    .select(
      "id, type, difficulte, enonce, category_id, subcategory_id, created_at",
      { count: "exact" },
    );

  if (params.q && params.q.trim() !== "") {
    query = query.ilike("enonce", `%${params.q.trim()}%`);
  }
  if (params.type && QUESTION_TYPES.includes(params.type as QuestionType)) {
    query = query.eq("type", params.type as QuestionType);
  }
  if (params.category) {
    const catId = parseInt(params.category, 10);
    if (Number.isFinite(catId)) query = query.eq("category_id", catId);
  }
  if (params.difficulte) {
    const d = parseInt(params.difficulte, 10);
    if (Number.isFinite(d) && d >= 1 && d <= 5) {
      query = query.eq("difficulte", d);
    }
  }

  const { data: questions, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-6xl p-6">
        <div className="rounded-lg border border-buzz/40 bg-buzz/10 p-4 text-buzz">
          Erreur de chargement : {error.message}
        </div>
      </main>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">
            Questions
          </h1>
          <p className="text-sm text-navy/70">
            {total} question{total > 1 ? "s" : ""} en base · page {page} / {totalPages}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/questions/new"
            className="flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-midnight transition-colors hover:bg-gold/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvelle
          </Link>
          <Link
            href="/admin/questions/import"
            className="flex items-center gap-1.5 rounded-md border border-gold/50 px-3 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Importer JSON
          </Link>
          <a
            href="/api/questions/export"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-semibold text-navy/80 transition-colors hover:border-cream hover:text-navy"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exporter
          </a>
        </div>
      </header>

      <Filters categories={categories ?? []} current={params} />

      <QuestionsTable
        questions={questions ?? []}
        categories={categories ?? []}
      />

      <Pagination page={page} totalPages={totalPages} />
    </main>
  );
}
