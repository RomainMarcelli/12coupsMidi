import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Exporte TOUTES les questions au format du seed
 * (category_slug / subcategory_slug plutôt que IDs) afin de pouvoir être
 * réimporté tel quel.
 *
 * Téléchargement forcé via Content-Disposition.
 */
export async function GET() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: questions, error }, { data: cats }, { data: subcats }] =
    await Promise.all([
      supabase
        .from("questions")
        .select(
          "type, category_id, subcategory_id, difficulte, enonce, reponses, bonne_reponse, alias, indices, image_url, explication",
        )
        .order("type")
        .order("created_at", { ascending: true }),
      supabase.from("categories").select("id, slug"),
      supabase.from("subcategories").select("id, slug"),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!questions || !cats || !subcats) {
    return NextResponse.json(
      { error: "Aucune donnée à exporter." },
      { status: 404 },
    );
  }

  const catSlugById = new Map(cats.map((c) => [c.id, c.slug]));
  const subcatSlugById = new Map(subcats.map((s) => [s.id, s.slug]));

  const payload = questions.map((q) => {
    const out: Record<string, unknown> = {
      type: q.type,
      category_slug: q.category_id ? catSlugById.get(q.category_id) : null,
      difficulte: q.difficulte,
      enonce: q.enonce,
      reponses: (q.reponses as Json) ?? [],
    };
    if (q.subcategory_id) {
      out.subcategory_slug = subcatSlugById.get(q.subcategory_id);
    }
    if (q.bonne_reponse) out.bonne_reponse = q.bonne_reponse;
    if (q.alias) out.alias = q.alias;
    if (q.indices) out.indices = q.indices;
    if (q.image_url) out.image_url = q.image_url;
    if (q.explication) out.explication = q.explication;
    return out;
  });

  const body = JSON.stringify(payload, null, 2);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="midi-master-questions-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
