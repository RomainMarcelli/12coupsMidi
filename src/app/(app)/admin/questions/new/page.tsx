import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "../question-form";

export const metadata = {
  title: "Admin — Nouvelle question",
};

export default async function NewQuestionPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: categories }, { data: subcategories }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, nom, slug")
      .order("nom"),
    supabase
      .from("subcategories")
      .select("id, category_id, nom, slug")
      .order("nom"),
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

      <h1 className="font-display text-3xl font-extrabold text-foreground">
        Nouvelle question
      </h1>

      <QuestionForm
        categories={categories ?? []}
        subcategories={subcategories ?? []}
      />
    </main>
  );
}
