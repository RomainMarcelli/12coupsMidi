"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  buildSignature,
  findDuplicateGroups,
  type DuplicateGroup,
} from "@/lib/duplicates";
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

/**
 * Suppression multiple. Renvoie le nombre de lignes effectivement
 * supprimées (utile pour le toast UI). Cap à 500 ids par appel pour
 * éviter une URL trop longue côté Supabase JS.
 */
export async function deleteQuestionsBulk(
  ids: string[],
): Promise<ActionResult & { deleted?: number }> {
  await requireAdmin();
  if (ids.length === 0) {
    return { status: "error", message: "Aucune question sélectionnée." };
  }
  if (ids.length > 500) {
    return {
      status: "error",
      message: "Sélection trop large (max 500 par lot).",
    };
  }
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("questions")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { status: "error", message: error.message };
  revalidatePath("/admin/questions");
  return {
    status: "ok",
    message: `${count ?? ids.length} question(s) supprimée(s).`,
    deleted: count ?? ids.length,
  };
}

// ---------------------------------------------------------------------------
// BULK IMPORT
// ---------------------------------------------------------------------------

export interface ImportDuplicate {
  /** Index 0-based dans le tableau d'import (pour highlight côté UI). */
  index: number;
  enonce: string;
  type: string;
  category_slug: string;
  /** ID de la question existante en BDD qui est le doublon canonique. */
  existingId: string;
}

export type ImportResult =
  | {
      status: "ok";
      inserted: number;
      skipped: number;
      warnings: string[];
      /** K2.1 — Doublons détectés avec une question déjà en BDD (ignorés). */
      duplicates: ImportDuplicate[];
    }
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
  const catSlugById = new Map(cats.map((c) => [c.id, c.slug]));
  const subcatIdByPair = new Map(
    subcats.map(
      (s) => [`${s.category_id}|${s.slug}`, s.id] as [string, number],
    ),
  );

  // K2.1 — Charger les questions existantes pour la détection de
  // doublons. On ne récupère que les colonnes nécessaires à la
  // signature (id + type + category_id + enonce + bonne_reponse).
  // À ~3000 questions × 200 octets = 600 KB en RAM, parfaitement
  // gérable côté serveur.
  const { data: existing, error: existingErr } = await supabase
    .from("questions")
    .select("id, type, category_id, enonce, bonne_reponse");
  if (existingErr) {
    return {
      status: "error",
      message: `Impossible de charger les questions existantes : ${existingErr.message}`,
    };
  }

  // Map signature → existingId (premier rencontré gagne).
  const existingBySig = new Map<string, string>();
  for (const q of existing ?? []) {
    const slug = q.category_id != null ? catSlugById.get(q.category_id) : null;
    const sig = buildSignature({
      type: q.type,
      enonce: q.enonce,
      category_slug: slug ?? null,
      bonne_reponse: q.bonne_reponse,
    });
    if (!existingBySig.has(sig)) existingBySig.set(sig, q.id);
  }

  const warnings: string[] = [];
  const duplicates: ImportDuplicate[] = [];
  type Row = ReturnType<typeof buildRow>;
  const rows: Row[] = [];

  for (let idx = 0; idx < parsed.data.length; idx++) {
    const q = parsed.data[idx]!;
    const cid = catIdBySlug.get(q.category_slug);
    if (cid === undefined) {
      warnings.push(`Catégorie inconnue "${q.category_slug}" — ignorée.`);
      continue;
    }
    // K2.1 — Calcul de signature et test d'existence en BDD.
    const sig = buildSignature({
      type: q.type,
      enonce: q.enonce,
      category_slug: q.category_slug,
      bonne_reponse: q.bonne_reponse ?? null,
    });
    const dupId = existingBySig.get(sig);
    if (dupId !== undefined) {
      duplicates.push({
        index: idx,
        enonce: q.enonce,
        type: q.type,
        category_slug: q.category_slug,
        existingId: dupId,
      });
      continue; // skip — l'import continue sans cette question
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
    skipped: parsed.data.length - rows.length - duplicates.length,
    warnings,
    duplicates,
  };
}

// ---------------------------------------------------------------------------
// K2.2 — AUDIT DES DOUBLONS (manuel)
// ---------------------------------------------------------------------------

export interface AuditDuplicateRow {
  id: string;
  type: string;
  category_slug: string | null;
  /** L2.1 — Nom affichable de la catégorie (ex. "Histoire"). */
  category_nom: string | null;
  enonce: string;
  bonne_reponse: string | null;
  /** L2.1 — Réponses brutes (pour quizz_2/quizz_4/coup_par_coup). */
  reponses: { text: string; correct: boolean }[];
  /** L2.1 — Alias acceptés (face_a_face / etoile). */
  alias: string[];
  /** L2.1 — Indices (etoile / coup_maitre). */
  indices_count: number;
  created_at: string;
}

export interface AuditDuplicateGroup {
  signature: string;
  canonical: AuditDuplicateRow;
  duplicates: AuditDuplicateRow[];
  count: number;
}

export type AuditResult =
  | { status: "ok"; groups: AuditDuplicateGroup[]; totalQuestions: number }
  | { status: "error"; message: string };

/**
 * K2.2 — Scanne toute la base questions et retourne les groupes de
 * doublons (≥ 2 questions partageant la même signature).
 * Tri : groupes par taille décroissante (les plus dupliqués d'abord).
 */
export async function auditDuplicateQuestions(): Promise<AuditResult> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: cats }, { data: questions, error: qErr }] = await Promise.all([
    supabase.from("categories").select("id, slug, nom"),
    supabase
      .from("questions")
      .select(
        "id, type, category_id, enonce, bonne_reponse, reponses, alias, indices, created_at",
      )
      .order("created_at", { ascending: true }),
  ]);

  if (qErr) return { status: "error", message: qErr.message };
  if (!cats) return { status: "error", message: "Catégories introuvables" };

  const catById = new Map(cats.map((c) => [c.id, c]));

  const rows: AuditDuplicateRow[] = (questions ?? []).map((q) => {
    const cat = q.category_id != null ? catById.get(q.category_id) : null;
    return {
      id: q.id,
      type: q.type,
      category_slug: cat?.slug ?? null,
      category_nom: cat?.nom ?? null,
      enonce: q.enonce,
      bonne_reponse: q.bonne_reponse,
      reponses: Array.isArray(q.reponses)
        ? (q.reponses as { text: string; correct: boolean }[])
        : [],
      alias: Array.isArray(q.alias) ? (q.alias as string[]) : [],
      indices_count: Array.isArray(q.indices)
        ? (q.indices as string[]).length
        : 0,
      created_at: q.created_at,
    };
  });

  const groups = findDuplicateGroups(rows, (r) =>
    buildSignature({
      type: r.type,
      enonce: r.enonce,
      category_slug: r.category_slug,
      bonne_reponse: r.bonne_reponse,
    }),
  );

  // Tri par taille de groupe DESC, puis par enonce ASC pour stabilité.
  groups.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.canonical.enonce.localeCompare(b.canonical.enonce);
  });

  return {
    status: "ok",
    groups: groups as AuditDuplicateGroup[],
    totalQuestions: rows.length,
  };
}

// ---------------------------------------------------------------------------
// K2.3 — FUSION DES DOUBLONS
// ---------------------------------------------------------------------------

export interface MergeResult {
  status: "ok" | "error";
  message?: string;
  transferred?: {
    favorites: number;
    errors: number;
    challenges: number;
    deleted: number;
  };
}

/**
 * K2.3 — Fusionne `duplicateIds` dans `canonicalId`. Étapes :
 *   1. Pour chaque doublon, transférer les `user_favorites` :
 *      INSERT new pair (user, canonical) si absente, puis DELETE le
 *      duplicate. Approche via boucle JS (Supabase JS ne supporte pas
 *      un ON CONFLICT raw).
 *   2. Idem pour `wrong_answers`.
 *   3. Pour les `daily_challenges` : remplacer chaque occurrence de
 *      `duplicateId` dans `question_ids` par `canonicalId`.
 *      ATTENTION : si la canonical est DÉJÀ dans le tableau, on
 *      retire juste le duplicate (pas de doublon dans une partie).
 *   4. DELETE FROM questions WHERE id = duplicateId.
 */
export async function mergeDuplicateQuestions(
  canonicalId: string,
  duplicateIds: string[],
): Promise<MergeResult> {
  await requireAdmin();
  if (duplicateIds.length === 0) {
    return { status: "error", message: "Aucun duplicate fourni." };
  }
  if (duplicateIds.includes(canonicalId)) {
    return {
      status: "error",
      message: "L'ID canonique ne peut pas figurer dans la liste des doublons.",
    };
  }
  const supabase = await createClient();

  let favCount = 0;
  let errCount = 0;
  let chgCount = 0;
  let delCount = 0;

  // ---- 1. user_favorites ----
  for (const dupId of duplicateIds) {
    const { data: dupFavs } = await supabase
      .from("user_favorites")
      .select("user_id, created_at")
      .eq("question_id", dupId);
    for (const f of dupFavs ?? []) {
      // Tente l'insert canonique. Si conflit (user a déjà favorisé
      // la canonique), on ignore l'erreur — la prochaine étape
      // (DELETE) supprimera le doublon de toute façon.
      const { error } = await supabase.from("user_favorites").insert({
        user_id: f.user_id,
        question_id: canonicalId,
        created_at: f.created_at,
      });
      if (!error) favCount++;
      // Si error.code === '23505' → conflit PK, déjà favorisé. OK.
    }
    const { count } = await supabase
      .from("user_favorites")
      .delete({ count: "exact" })
      .eq("question_id", dupId);
    favCount += count ?? 0;
  }

  // ---- 2. wrong_answers ----
  for (const dupId of duplicateIds) {
    const { data: dupErrs } = await supabase
      .from("wrong_answers")
      .select("user_id, fail_count, success_streak, last_seen_at")
      .eq("question_id", dupId);
    for (const w of dupErrs ?? []) {
      if (!w.user_id) continue;
      const { error } = await supabase.from("wrong_answers").insert({
        user_id: w.user_id,
        question_id: canonicalId,
        fail_count: w.fail_count,
        success_streak: w.success_streak,
        last_seen_at: w.last_seen_at,
      });
      if (!error) errCount++;
    }
    const { count } = await supabase
      .from("wrong_answers")
      .delete({ count: "exact" })
      .eq("question_id", dupId);
    errCount += count ?? 0;
  }

  // ---- 3. daily_challenges (remplacer les question_ids) ----
  // On lit tous les défis qui contiennent un duplicateId et on
  // recompose le tableau en remplaçant. Volume faible (1 défi/jour
  // × 30 jours typique).
  const { data: chgs } = await supabase
    .from("daily_challenges")
    .select("date, question_ids");
  for (const c of chgs ?? []) {
    const ids = (c.question_ids as string[]) ?? [];
    if (!ids.some((id) => duplicateIds.includes(id))) continue;
    const remapped: string[] = [];
    for (const id of ids) {
      const target = duplicateIds.includes(id) ? canonicalId : id;
      // Anti-doublon dans le même défi
      if (!remapped.includes(target)) remapped.push(target);
    }
    const { error } = await supabase
      .from("daily_challenges")
      .update({ question_ids: remapped })
      .eq("date", c.date);
    if (!error) chgCount++;
  }

  // ---- 4. DELETE des questions doublons ----
  const { count, error: delErr } = await supabase
    .from("questions")
    .delete({ count: "exact" })
    .in("id", duplicateIds);
  if (delErr) {
    return {
      status: "error",
      message: `Échec DELETE des doublons : ${delErr.message}`,
    };
  }
  delCount = count ?? 0;

  revalidatePath("/admin/questions");
  revalidatePath("/admin/questions/audit");
  return {
    status: "ok",
    transferred: {
      favorites: favCount,
      errors: errCount,
      challenges: chgCount,
      deleted: delCount,
    },
  };
}

export type { DuplicateGroup };

// ---------------------------------------------------------------------------
// Helper : navigation post-action depuis un form
// ---------------------------------------------------------------------------

export async function redirectToAdminList(): Promise<never> {
  redirect("/admin/questions");
}
