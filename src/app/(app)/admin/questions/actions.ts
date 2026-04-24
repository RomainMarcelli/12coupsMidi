"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  questionSchema,
  questionsBulkSchema,
  type QuestionInput,
} from "@/lib/schemas/question";

/**
 * Résout slug → id pour une question. Retourne null si category_slug invalide.
 */
async function resolveSlugs(
  q: QuestionInput,
): Promise<
  | { ok: true; category_id: number; subcategory_id: number | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", q.category_slug)
    .maybeSingle();

  if (!cat) {
    return { ok: false, error: `Catégorie inconnue : ${q.category_slug}` };
  }

  let subcategory_id: number | null = null;
  if (q.subcategory_slug) {
    const { data: subcat } = await supabase
      .from("subcategories")
      .select("id")
      .eq("category_id", cat.id)
      .eq("slug", q.subcategory_slug)
      .maybeSingle();
    if (!subcat) {
      return {
        ok: false,
        error: `Sous-catégorie inconnue : ${q.category_slug} / ${q.subcategory_slug}`,
      };
    }
    subcategory_id = subcat.id;
  }

  return { ok: true, category_id: cat.id, subcategory_id };
}

function buildRow(q: QuestionInput, category_id: number, subcategory_id: number | null) {
  return {
    type: q.type,
    category_id,
    subcategory_id,
    difficulte: q.difficulte,
    enonce: q.enonce,
    reponses: q.reponses,
    bonne_reponse: q.bonne_reponse ?? null,
    alias: q.alias ?? null,
    indices: q.indices ?? null,
    image_url: q.image_url ?? null,
    explication: q.explication ?? null,
    format: q.format ?? null,
  };
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

export type ActionResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export async function createQuestion(
  input: unknown,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues.map((i) => i.message).join(" · "),
    };
  }

  const resolved = await resolveSlugs(parsed.data);
  if (!resolved.ok) return { status: "error", message: resolved.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .insert(
      buildRow(parsed.data, resolved.category_id, resolved.subcategory_id),
    );

  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/questions");
  return { status: "ok", message: "Question créée." };
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

export async function updateQuestion(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues.map((i) => i.message).join(" · "),
    };
  }

  const resolved = await resolveSlugs(parsed.data);
  if (!resolved.ok) return { status: "error", message: resolved.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update(
      buildRow(parsed.data, resolved.category_id, resolved.subcategory_id),
    )
    .eq("id", id);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${id}`);
  return { status: "ok", message: "Question mise à jour." };
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function deleteQuestion(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) return { status: "error", message: error.message };
  revalidatePath("/admin/questions");
  return { status: "ok", message: "Question supprimée." };
}

// ---------------------------------------------------------------------------
// BULK IMPORT
// ---------------------------------------------------------------------------

export type ImportResult =
  | { status: "ok"; inserted: number; skipped: number; warnings: string[] }
  | { status: "error"; message: string; issues?: string[] };

export async function importQuestionsBulk(
  input: unknown,
): Promise<ImportResult> {
  await requireAdmin();

  const parsed = questionsBulkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: `Validation échouée sur ${parsed.error.issues.length} point(s).`,
      issues: parsed.error.issues
        .slice(0, 50)
        .map((i) => `[${i.path.join(".")}] ${i.message}`),
    };
  }

  const supabase = await createClient();

  // Charger les mappings slug → id une seule fois.
  const [{ data: cats }, { data: subcats }] = await Promise.all([
    supabase.from("categories").select("id, slug"),
    supabase.from("subcategories").select("id, slug, category_id"),
  ]);
  if (!cats || !subcats) {
    return {
      status: "error",
      message: "Impossible de charger les catégories (ont-elles été seedées ?)",
    };
  }

  const catIdBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const subcatIdByPair = new Map(
    subcats.map(
      (s) => [`${s.category_id}|${s.slug}`, s.id] as [string, number],
    ),
  );

  const warnings: string[] = [];
  type Row = ReturnType<typeof buildRow>;
  const rows: Row[] = [];

  for (const q of parsed.data) {
    const cid = catIdBySlug.get(q.category_slug);
    if (cid === undefined) {
      warnings.push(`Catégorie inconnue "${q.category_slug}" — ignorée.`);
      continue;
    }
    let sid: number | null = null;
    if (q.subcategory_slug) {
      sid = subcatIdByPair.get(`${cid}|${q.subcategory_slug}`) ?? null;
      if (sid === null) {
        warnings.push(
          `Sous-catégorie inconnue "${q.category_slug}/${q.subcategory_slug}" — subcategory_id = null.`,
        );
      }
    }
    rows.push(buildRow(q, cid, sid));
  }

  // Insert par lots de 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("questions")
      .insert(batch, { count: "exact" });
    if (error) {
      return {
        status: "error",
        message: `Erreur batch ${i / BATCH + 1} : ${error.message}`,
      };
    }
    inserted += count ?? batch.length;
  }

  revalidatePath("/admin/questions");
  return {
    status: "ok",
    inserted,
    skipped: parsed.data.length - rows.length,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helper : navigation post-action depuis un form
// ---------------------------------------------------------------------------

export async function redirectToAdminList(): Promise<never> {
  redirect("/admin/questions");
}
