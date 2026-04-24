import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { QuestionForm } from "../question-form";
import type { QuestionInput } from "@/lib/schemas/question";
import type { Json } from "@/types/database";

export const metadata = {
  title: "Admin — Éditer une question",
};

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();

  const [{ data: question }, { data: categories }, { data: subcategories }] =
    await Promise.all([
      supabase
        .from("questions")
        .select(
          "id, type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("categories").select("id, nom, slug").order("nom"),
      supabase
        .from("subcategories")
        .select("id, category_id, nom, slug")
        .order("nom"),
    ]);

  if (!question) notFound();
  if (!categories || !subcategories) notFound();

  const category = categories.find((c) => c.id === question.category_id);
  if (!category) notFound();

  const subcategory = question.subcategory_id
    ? subcategories.find((s) => s.id === question.subcategory_id)
    : null;

  const reponsesRaw = question.reponses as Json;
  const reponses: { text: string; correct: boolean }[] = Array.isArray(
    reponsesRaw,
  )
    ? (reponsesRaw as { text: string; correct: boolean }[])
    : [];

  const aliasRaw = question.alias as Json | null;
  const alias: string[] = Array.isArray(aliasRaw)
    ? (aliasRaw as string[])
    : [];

  const indicesRaw = question.indices as Json | null;
  const indices: string[] = Array.isArray(indicesRaw)
    ? (indicesRaw as string[])
    : [];

  const initial: QuestionInput & { id: string } = {
    id: question.id,
    type: question.type,
    category_slug: category.slug,
    subcategory_slug: subcategory?.slug,
    difficulte: question.difficulte,
    enonce: question.enonce,
    reponses,
    bonne_reponse: question.bonne_reponse ?? undefined,
    alias: alias.length > 0 ? alias : undefined,
    indices: indices.length > 0 ? indices : undefined,
    image_url: question.image_url ?? undefined,
    explication: question.explication ?? undefined,
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/questions"
        className="flex items-center gap-1 self-start text-sm text-navy/70 transition-colors hover:text-gold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la liste
      </Link>

      <h1 className="font-display text-3xl font-extrabold text-navy">
        Éditer la question
      </h1>

      <QuestionForm
        categories={categories}
        subcategories={subcategories}
        initial={initial}
      />
    </main>
  );
}
