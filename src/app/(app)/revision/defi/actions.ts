"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { devError, devLog } from "@/lib/dev-log";
import type { Json, QuestionType } from "@/types/database";
import type { RevQuestion } from "@/lib/revision/types";
import { DAILY_CHALLENGE_QUESTION_COUNT } from "./constants";

interface RawQuestion {
  id: string;
  type: QuestionType;
  category_id: number | null;
  difficulte: number;
  enonce: string;
  reponses: Json;
  bonne_reponse: string | null;
  alias: Json | null;
  explication: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeQuestion(
  q: RawQuestion,
  catsById: Map<number, { id: number; nom: string; couleur: string | null }>,
): RevQuestion {
  const cat =
    q.category_id != null ? catsById.get(q.category_id) ?? null : null;
  return {
    questionId: q.id,
    type: q.type,
    enonce: q.enonce,
    reponses: Array.isArray(q.reponses)
      ? (q.reponses as { text: string; correct: boolean }[])
      : [],
    bonneReponse: q.bonne_reponse ?? "",
    alias: Array.isArray(q.alias) ? (q.alias as string[]) : [],
    explication: q.explication,
    category: cat,
    difficulte: q.difficulte,
  };
}

/**
 * H3 — Récupère le défi du jour (ou d'une date passée). Charge :
 *   - les question_ids depuis daily_challenges
 *   - les données complètes depuis questions
 *   - le résultat existant de l'utilisateur s'il a déjà joué
 *
 * Si la date demandée est aujourd'hui ET que daily_challenges est
 * vide pour ce jour, on génère le défi à la volée (fallback si le
 * cron Vercel n'a pas tourné). En revanche si c'est une date passée
 * sans entrée, on retourne `not_found` (pas de génération rétroactive).
 */
export async function fetchDailyChallenge(
  isoDate?: string,
): Promise<
  | {
      status: "ok";
      date: string;
      questions: RevQuestion[];
      existingResult: ChallengeResult | null;
    }
  | { status: "not_found" }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const targetDate = isoDate ?? todayIso();
  const today = todayIso();
  // Bloque le futur : on ne génère pas un défi pour une date à venir.
  const isFuture = targetDate > today;

  // 1) On cherche l'entrée du défi pour cette date.
  let { data: challenge } = await supabase
    .from("daily_challenges")
    .select("date, question_ids")
    .eq("date", targetDate)
    .maybeSingle();

  // 2) Si aujourd'hui ou un jour passé sans entrée, on génère à la
  //    volée. Le seed est déterministe (hash de la date) donc une
  //    génération rétroactive produit toujours les mêmes questions.
  if (!challenge && !isFuture) {
    const generated = await generateChallengeForDate(targetDate);
    if (generated.status === "error")
      return { status: "error", message: generated.message };
    challenge = generated.row;
  }

  if (!challenge) return { status: "not_found" };

  // 3) Charge les questions complètes via les IDs stockés.
  const [{ data: qs, error }, { data: cats }, { data: existing }] =
    await Promise.all([
      supabase
        .from("questions")
        .select(
          "id, type, category_id, difficulte, enonce, reponses, bonne_reponse, alias, explication",
        )
        .in("id", challenge.question_ids as unknown as string[]),
      supabase.from("categories").select("id, nom, couleur"),
      supabase
        .from("daily_challenge_results")
        .select("correct_count, total_count, answers, completed_at")
        .eq("user_id", user.id)
        .eq("date", targetDate)
        .maybeSingle(),
    ]);

  if (error) return { status: "error", message: error.message };
  const catsById = new Map((cats ?? []).map((c) => [c.id, c] as const));
  // Préserve l'ordre stocké dans question_ids.
  const byId = new Map((qs ?? []).map((q) => [q.id, q] as const));
  const orderedQuestions: RevQuestion[] = [];
  for (const id of challenge.question_ids as unknown as string[]) {
    const raw = byId.get(id);
    if (raw) orderedQuestions.push(normalizeQuestion(raw, catsById));
  }

  return {
    status: "ok",
    date: targetDate,
    questions: orderedQuestions,
    existingResult: existing
      ? {
          correctCount: existing.correct_count,
          totalCount: existing.total_count,
          answers: Array.isArray(existing.answers)
            ? (existing.answers as unknown as ChallengeAnswer[])
            : [],
          completedAt: existing.completed_at,
        }
      : null,
  };
}

export interface ChallengeAnswer {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface ChallengeResult {
  correctCount: number;
  totalCount: number;
  answers: ChallengeAnswer[];
  completedAt: string;
}

/**
 * H3 — Soumet le résultat d'un défi joué. Une seule soumission par
 * couple (user, date) — la PRIMARY KEY garantit l'unicité côté BDD.
 *
 * K1 — Ajout de logs serveur + vérification post-INSERT pour
 * diagnostiquer le bug "résultat non enregistré sans erreur visible".
 * On chaîne `.select(...).maybeSingle()` pour forcer Supabase à
 * retourner la ligne insérée — si elle est null sans `error`, ça
 * signifie qu'une RLS a filtré silencieusement le retour (cas
 * théorique, mais ceinture-bretelle).
 */
export async function submitDailyChallengeResult(input: {
  date: string;
  correctCount: number;
  totalCount: number;
  answers: ChallengeAnswer[];
}): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  devLog("[defi:server] submitDailyChallengeResult start", {
    userId: user.id,
    date: input.date,
    correctCount: input.correctCount,
    totalCount: input.totalCount,
    answersLen: input.answers.length,
  });

  const { data, error } = await supabase
    .from("daily_challenge_results")
    .insert({
      user_id: user.id,
      date: input.date,
      correct_count: input.correctCount,
      total_count: input.totalCount,
      answers: input.answers as unknown as Json,
    })
    .select("user_id, date, correct_count, total_count")
    .maybeSingle();

  if (error) {
    devError("[defi:server] INSERT error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { status: "error", message: error.message };
  }
  if (!data) {
    devError("[defi:server] INSERT returned no row (RLS filter ?)");
    return {
      status: "error",
      message:
        "L'enregistrement n'a retourné aucune ligne (problème RLS suspecté). Contacte l'admin.",
    };
  }
  devLog("[defi:server] INSERT OK", data);
  revalidatePath("/revision/defi");
  revalidatePath("/revision");
  return { status: "ok" };
}

/**
 * H3 — Stats agrégées de l'utilisateur sur l'historique des défis.
 * Calculées côté JS car le volume reste très faible (≤ 1 ligne / jour).
 */
export interface DailyStats {
  totalPlayed: number;
  averagePercent: number;
  currentStreak: number;
  bestStreak: number;
  /** [{ date, percent }] sur les 30 derniers jours. */
  last30: Array<{ date: string; percent: number }>;
  /**
   * J3.2 — Compteurs pour le PieChart "Répartition des défis" en
   * 5 buckets de score. Plus granulaire que les 3 d'I3.2 — la
   * tranche 50-99 % était trop large.
   */
  perfectCount: number;
  excellentCount: number;
  goodCount: number;
  averageCount: number;
  failedCount: number;
}

export async function fetchDailyStats(): Promise<
  { status: "ok"; stats: DailyStats } | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("daily_challenge_results")
    .select("date, correct_count, total_count")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(180);

  if (error) return { status: "error", message: error.message };

  const all = rows ?? [];
  const totalPlayed = all.length;
  const averagePercent =
    totalPlayed === 0
      ? 0
      : Math.round(
          all.reduce(
            (acc, r) =>
              acc +
              (r.total_count > 0 ? (r.correct_count / r.total_count) * 100 : 0),
            0,
          ) / totalPlayed,
        );

  // Streak : on parcourt les dates triées DESC. Streak en cours = nb
  // consécutif depuis aujourd'hui (ou hier si aujourd'hui pas encore joué).
  const playedDates = new Set(all.map((r) => r.date as string));
  const today = todayIso();
  let currentStreak = 0;
  // Remonter jour par jour depuis aujourd'hui.
  let cursor = new Date(today);
  // Si aujourd'hui pas joué, on commence depuis hier (sinon le streak
  // serait toujours 0 jusqu'à 23h59).
  if (!playedDates.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (playedDates.has(cursor.toISOString().slice(0, 10))) {
    currentStreak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Best streak : on parcourt l'historique (sorted ASC) en cherchant
  // les runs consécutifs.
  const allSortedAsc = [...all].sort((a, b) =>
    (a.date as string).localeCompare(b.date as string),
  );
  let bestStreak = 0;
  let runStart: Date | null = null;
  let runLen = 0;
  for (const row of allSortedAsc) {
    const d = new Date(row.date as string);
    if (runStart === null) {
      runStart = d;
      runLen = 1;
    } else {
      const expected = new Date(runStart);
      expected.setUTCDate(expected.getUTCDate() + runLen);
      if (d.toISOString().slice(0, 10) === expected.toISOString().slice(0, 10)) {
        runLen += 1;
      } else {
        if (runLen > bestStreak) bestStreak = runLen;
        runStart = d;
        runLen = 1;
      }
    }
  }
  if (runLen > bestStreak) bestStreak = runLen;

  const last30 = allSortedAsc.slice(-30).map((r) => ({
    date: r.date as string,
    percent:
      r.total_count > 0
        ? Math.round((r.correct_count / r.total_count) * 100)
        : 0,
  }));

  // J3.2 — Comptes pour le camembert en 5 buckets : Parfaits (100%),
  // Excellents (80-99%), Bons (60-79%), Moyens (40-59%), Ratés (<40%).
  let perfectCount = 0;
  let excellentCount = 0;
  let goodCount = 0;
  let averageCount = 0;
  let failedCount = 0;
  for (const r of all) {
    if (r.total_count <= 0) continue;
    const pct = (r.correct_count / r.total_count) * 100;
    if (pct >= 100) perfectCount += 1;
    else if (pct >= 80) excellentCount += 1;
    else if (pct >= 60) goodCount += 1;
    else if (pct >= 40) averageCount += 1;
    else failedCount += 1;
  }

  return {
    status: "ok",
    stats: {
      totalPlayed,
      averagePercent,
      currentStreak,
      bestStreak,
      last30,
      perfectCount,
      excellentCount,
      goodCount,
      averageCount,
      failedCount,
    },
  };
}

/**
 * H3 — Liste des défis joués/disponibles sur un mois donné.
 * Utilisé par le calendrier pour griser/colorer les cases.
 */
export async function fetchMonthChallenges(input: {
  year: number;
  /** Mois 1-12. */
  month: number;
}): Promise<
  | {
      status: "ok";
      /** Map "YYYY-MM-DD" → { played: bool, percent?: number, hasChallenge: bool } */
      days: Record<
        string,
        { played: boolean; percent?: number; hasChallenge: boolean }
      >;
    }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const monthStr = String(input.month).padStart(2, "0");
  const yearStr = String(input.year);
  const start = `${yearStr}-${monthStr}-01`;
  // K1bis — Bug critique : `end = "${yearStr}-${monthStr}-31"` produit
  // une date invalide pour les mois ≤ 30 jours (avril, juin, septembre,
  // novembre, février). Postgres rejette `'2026-04-31'::date` avec
  // "date/time field value out of range" → la requête plante
  // silencieusement (le code ne checke pas l'erreur), `results` est
  // null, et le calendrier ne montre AUCUN jour en vert même quand
  // les rows existent. Fix : utiliser `< start du mois suivant`.
  const nextMonthYear = input.month === 12 ? input.year + 1 : input.year;
  const nextMonthNum = input.month === 12 ? 1 : input.month + 1;
  const startNextMonth = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-01`;

  const [{ data: challenges }, { data: results }] = await Promise.all([
    supabase
      .from("daily_challenges")
      .select("date")
      .gte("date", start)
      .lt("date", startNextMonth),
    supabase
      .from("daily_challenge_results")
      .select("date, correct_count, total_count")
      .eq("user_id", user.id)
      .gte("date", start)
      .lt("date", startNextMonth),
  ]);

  const days: Record<
    string,
    { played: boolean; percent?: number; hasChallenge: boolean }
  > = {};
  // Tous les jours passés (et aujourd'hui) du mois sont jouables : la
  // génération rétroactive est déterministe (seed = hash de la date),
  // donc le défi sera créé à la volée au clic même si aucune ligne
  // n'existe encore en BDD.
  const today = todayIso();
  const lastDayOfMonth = new Date(input.year, input.month, 0).getUTCDate();
  for (let d = 1; d <= lastDayOfMonth; d++) {
    const iso = `${yearStr}-${monthStr}-${String(d).padStart(2, "0")}`;
    if (iso > today) continue;
    days[iso] = { played: false, hasChallenge: true };
  }
  for (const c of challenges ?? []) {
    days[c.date as string] = { played: false, hasChallenge: true };
  }
  for (const r of results ?? []) {
    const date = r.date as string;
    const percent =
      r.total_count > 0
        ? Math.round((r.correct_count / r.total_count) * 100)
        : 0;
    days[date] = {
      played: true,
      percent,
      hasChallenge: true,
    };
  }
  return { status: "ok", days };
}

/**
 * H3 — Génère un défi pour la date donnée si absent.
 * Pioche `DAILY_CHALLENGE_QUESTION_COUNT` questions avec un seed
 * déterministe basé sur la date (pour reproductibilité).
 *
 * L'INSERT dans `daily_challenges` doit se faire via le service_role :
 * la policy RLS n'autorise que SELECT pour les users authentifiés,
 * sans quoi la ligne ne serait pas créée et la FK
 * `daily_challenge_results_date_fkey` exploserait à la soumission.
 *
 * En cas de race (deux users en parallèle, le cron qui passe entre
 * deux), `upsert` avec `ignoreDuplicates` rend l'opération idempotente.
 */
async function generateChallengeForDate(
  isoDate: string,
): Promise<
  | { status: "ok"; row: { date: string; question_ids: string[] } }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  // Pioche 10 questions quizz_2/quizz_4 avec une diversité de
  // catégories. Hash déterministe de la date pour la reproductibilité.
  const { data: qs, error } = await supabase
    .from("questions")
    .select("id, category_id")
    .in("type", ["quizz_2", "quizz_4"])
    .limit(500);
  if (error) return { status: "error", message: error.message };

  const seed = hashSeed(isoDate);
  const shuffled = shuffleArray(qs ?? [], seed);
  // Prend les N premières en s'assurant d'une diversité de catégorie
  // (max 2 par catégorie).
  const seenCat = new Map<number, number>();
  const picked: string[] = [];
  for (const q of shuffled) {
    if (picked.length >= DAILY_CHALLENGE_QUESTION_COUNT) break;
    const c = q.category_id ?? 0;
    if ((seenCat.get(c) ?? 0) >= 2) continue;
    picked.push(q.id);
    seenCat.set(c, (seenCat.get(c) ?? 0) + 1);
  }
  // Fallback : si la diversité empêche d'atteindre N, on complète sans
  // contrainte.
  if (picked.length < DAILY_CHALLENGE_QUESTION_COUNT) {
    for (const q of shuffled) {
      if (picked.length >= DAILY_CHALLENGE_QUESTION_COUNT) break;
      if (!picked.includes(q.id)) picked.push(q.id);
    }
  }

  // Insert via service_role pour bypasser RLS. Si entretemps une autre
  // requête (ou le cron) a créé la ligne, on la récupère.
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      status: "error",
      message:
        e instanceof Error
          ? e.message
          : "Service role Supabase indisponible — défi du jour non créable.",
    };
  }
  const { error: upsertErr } = await admin
    .from("daily_challenges")
    .upsert(
      { date: isoDate, question_ids: picked },
      { onConflict: "date", ignoreDuplicates: true },
    );
  if (upsertErr) return { status: "error", message: upsertErr.message };

  // Si la ligne existait déjà (ignoreDuplicates), on relit pour
  // retourner les question_ids canoniques (pas ceux qu'on vient de
  // piocher localement).
  const { data: canonical } = await admin
    .from("daily_challenges")
    .select("date, question_ids")
    .eq("date", isoDate)
    .maybeSingle();
  if (canonical) {
    return {
      status: "ok",
      row: {
        date: canonical.date as string,
        question_ids: canonical.question_ids as unknown as string[],
      },
    };
  }
  return { status: "ok", row: { date: isoDate, question_ids: picked } };
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
