import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBuildBrand } from "@/lib/build-brand";
import { devLog } from "@/lib/dev-log";
import { DAILY_CHALLENGE_QUESTION_COUNT } from "@/app/(app)/revision/defi/constants";

/**
 * H3 — Cron Vercel pour générer le défi du jour à 00:05 UTC.
 *
 * Schedule dans `vercel.json` :
 *   { "path": "/api/cron/daily-challenge", "schedule": "5 0 * * *" }
 *
 * Protégé par CRON_SECRET (Authorization: Bearer <secret>).
 * Si le défi du jour existe déjà → no-op.
 *
 * Utilise le service_role côté serveur pour bypasser RLS sur l'INSERT.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // O4 — Garde-fou multi-déploiement : un seul build (le générique)
  // exécute le cron pour éviter les doublons d'INSERT dans
  // `daily_challenges` (les 2 déploiements partagent la même BDD).
  const brand = getBuildBrand();
  if (brand.mode !== "generic") {
    devLog("[cron:daily-challenge] skipped on non-generic deployment:", {
      brand: brand.mode,
    });
    return NextResponse.json({
      skipped: true,
      reason: `cron disabled on this deployment (BRAND_MODE=${brand.mode})`,
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "missing supabase service role config" },
      { status: 500 },
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const today = new Date().toISOString().slice(0, 10);

  // No-op si déjà créé.
  const { data: existing } = await admin
    .from("daily_challenges")
    .select("date")
    .eq("date", today)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ status: "exists", date: today });
  }

  // Pioche des questions quizz_2/quizz_4 avec diversité de catégories.
  const { data: qs, error: qErr } = await admin
    .from("questions")
    .select("id, category_id")
    .in("type", ["quizz_2", "quizz_4"])
    .limit(500);
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const seed = hashSeed(today);
  const shuffled = shuffleArray(qs ?? [], seed);
  const seenCat = new Map<number, number>();
  const picked: string[] = [];
  for (const q of shuffled) {
    if (picked.length >= DAILY_CHALLENGE_QUESTION_COUNT) break;
    const c = q.category_id ?? 0;
    if ((seenCat.get(c) ?? 0) >= 2) continue;
    picked.push(q.id);
    seenCat.set(c, (seenCat.get(c) ?? 0) + 1);
  }
  if (picked.length < DAILY_CHALLENGE_QUESTION_COUNT) {
    for (const q of shuffled) {
      if (picked.length >= DAILY_CHALLENGE_QUESTION_COUNT) break;
      if (!picked.includes(q.id)) picked.push(q.id);
    }
  }

  const { error: insErr } = await admin
    .from("daily_challenges")
    .insert({ date: today, question_ids: picked });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "created",
    date: today,
    count: picked.length,
  });
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleArray<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
