/**
 * Script de seed Midi Master.
 *
 * Usage :
 *   npm run seed
 *
 * Pré-requis :
 *   - Les migrations 0001_init.sql et 0002_seed.sql sont déjà passées
 *     (catégories et sous-catégories doivent exister en base).
 *   - .env.local contient NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.
 *
 * Ce que fait le script :
 *   1. Charge src/data/seed-questions.json.
 *   2. Valide chaque question avec le schéma zod (types cohérents).
 *   3. Résout category_slug / subcategory_slug → IDs.
 *   4. Insère en batch (100 à la fois) via SUPABASE_SERVICE_ROLE_KEY.
 *   5. Affiche un récap (OK / erreurs / stats par type).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import type { Database } from "../types/database";
import {
  questionsBulkSchema,
  type QuestionInput,
} from "../lib/schemas/question";

// -----------------------------------------------------------------------------
// Env — charge .env.local puis .env
// -----------------------------------------------------------------------------

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.error("Copie .env.example en .env.local et remplis-les.");
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

const BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  console.log("Midi Master — seed des questions\n");

  // 1. Charge les JSON (fichier principal + extensions éventuelles)
  const sources = [
    "src/data/seed-questions.json",
    "src/data/coup-par-coup.json",
    "src/data/coup-d-envoi.json",
  ];

  const rawAll: unknown[] = [];
  for (const rel of sources) {
    const absPath = resolve(process.cwd(), rel);
    try {
      const content = JSON.parse(readFileSync(absPath, "utf8")) as unknown;
      if (!Array.isArray(content)) {
        console.warn(`  ! ${rel} : format inattendu (pas un tableau), ignoré.`);
        continue;
      }
      console.log(`  · ${rel} : ${content.length} questions lues`);
      rawAll.push(...content);
    } catch (e) {
      console.warn(
        `  ! ${rel} : fichier absent ou invalide (${e instanceof Error ? e.message : "?"}).`,
      );
    }
  }

  // 2. Validation zod
  const parsed = questionsBulkSchema.safeParse(rawAll);
  if (!parsed.success) {
    console.error("\nErreur de validation :");
    for (const issue of parsed.error.issues.slice(0, 20)) {
      console.error(
        ` - [${issue.path.join(".")}] ${issue.message}`,
      );
    }
    if (parsed.error.issues.length > 20) {
      console.error(`   ... (${parsed.error.issues.length - 20} erreurs de plus)`);
    }
    process.exit(1);
  }
  const questions: QuestionInput[] = parsed.data;

  console.log(`\nTotal questions : ${questions.length}`);

  const byType: Record<string, number> = {};
  for (const q of questions) byType[q.type] = (byType[q.type] ?? 0) + 1;
  console.log(
    "  par type :",
    Object.entries(byType)
      .map(([t, n]) => `${t}=${n}`)
      .join(", "),
  );

  // 3. Charge le mapping slug → id pour categories et subcategories
  const [{ data: cats, error: errCats }, { data: subcats, error: errSubcats }] =
    await Promise.all([
      supabase.from("categories").select("id, slug"),
      supabase.from("subcategories").select("id, slug, category_id"),
    ]);

  if (errCats || errSubcats) {
    console.error(
      "Impossible de charger catégories/sous-catégories :",
      errCats?.message ?? errSubcats?.message,
    );
    console.error(
      "As-tu bien passé la migration 0002_seed.sql dans Supabase ?",
    );
    process.exit(1);
  }
  if (!cats || !subcats) {
    console.error("Pas de catégorie en base. Passe d'abord 0002_seed.sql.");
    process.exit(1);
  }

  const catIdBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const subcatIdByPair = new Map(
    subcats.map(
      (s) => [`${s.category_id}|${s.slug}`, s.id] as [string, number],
    ),
  );

  // 4. Préparation des rows pour insert
  type Row = Database["public"]["Tables"]["questions"]["Insert"];
  const rows: Row[] = [];
  const unresolved: string[] = [];

  for (const q of questions) {
    const categoryId = catIdBySlug.get(q.category_slug);
    if (categoryId === undefined) {
      unresolved.push(`category inconnue : ${q.category_slug}`);
      continue;
    }

    let subcategoryId: number | null = null;
    if (q.subcategory_slug) {
      const key = `${categoryId}|${q.subcategory_slug}`;
      const id = subcatIdByPair.get(key);
      if (id === undefined) {
        unresolved.push(
          `subcategory inconnue : ${q.category_slug} / ${q.subcategory_slug}`,
        );
        // Non-bloquant : on met null et on continue.
      } else {
        subcategoryId = id;
      }
    }

    rows.push({
      type: q.type,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      difficulte: q.difficulte,
      enonce: q.enonce,
      reponses: q.reponses,
      bonne_reponse: q.bonne_reponse ?? null,
      alias: q.alias ?? null,
      indices: q.indices ?? null,
      image_url: q.image_url ?? null,
      explication: q.explication ?? null,
      format: q.format ?? null,
    });
  }

  if (unresolved.length > 0) {
    console.warn(`\nAvertissements (${unresolved.length}) :`);
    for (const msg of unresolved.slice(0, 10)) console.warn(`  - ${msg}`);
    if (unresolved.length > 10) {
      console.warn(`  ... et ${unresolved.length - 10} autres`);
    }
    console.warn("");
  }

  // 5. Insert par lots
  console.log(`Insertion (${rows.length} questions, lots de ${BATCH_SIZE})…`);
  let inserted = 0;
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error, count } = await supabase
      .from("questions")
      .insert(batch, { count: "exact" });
    if (error) {
      console.error(`Erreur batch ${inserted / BATCH_SIZE} :`, error.message);
      process.exit(1);
    }
    inserted += count ?? batch.length;
    process.stdout.write(`  ${inserted} / ${rows.length}\r`);
  }

  const tookSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n\nSeed terminé. ${inserted} questions insérées en ${tookSec}s.`);
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
