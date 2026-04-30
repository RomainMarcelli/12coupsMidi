import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeMaitreScore,
  estimateMasteryDays,
  weakestCategories,
  type CategoryStat,
} from "@/lib/stats/maitre-de-midi";
import { StatsClient, type StatsData } from "./stats-client";

export const metadata = { title: "Stats" };
export const dynamic = "force-dynamic";

const HISTORY_DAYS = 30;

/**
 * Page Stats : agrégat serveur + rendu client des graphiques.
 * Calculs faits côté serveur (Postgres + JS) pour minimiser le payload.
 */
export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sinceIso = new Date(
    Date.now() - HISTORY_DAYS * 86_400_000,
  ).toISOString();

  const [
    { data: profile },
    { data: sessions },
    { data: userBadges },
    { data: answers },
    { data: categories },
    { count: wrongCount },
    { count: favCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("pseudo, xp, niveau, avatar_url, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("game_sessions")
      .select(
        "id, mode, score, correct_count, total_count, duration_seconds, xp_gained, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_badges")
      .select("badge_id, obtained_at")
      .eq("user_id", user.id),
    supabase
      .from("answers_log")
      .select("question_id, is_correct, time_taken_ms, created_at")
      .eq("user_id", user.id)
      .gte("created_at", sinceIso),
    supabase.from("categories").select("id, nom, couleur"),
    supabase
      .from("wrong_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("user_favorites")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  // Charge les questions concernées par answers_log pour récupérer la catégorie
  const answerList = answers ?? [];
  const questionIds = Array.from(
    new Set(
      answerList.map((a) => a.question_id).filter((id): id is string => !!id),
    ),
  );
  const { data: qRows } =
    questionIds.length > 0
      ? await supabase
          .from("questions")
          .select("id, category_id")
          .in("id", questionIds)
      : { data: [] as Array<{ id: string; category_id: number | null }> };

  const catByQuestion = new Map(
    (qRows ?? []).map((q) => [q.id, q.category_id] as const),
  );
  const catsById = new Map(
    (categories ?? []).map((c) => [c.id, c] as const),
  );

  // -------------------------------------------------------------------
  // Agrégats
  // -------------------------------------------------------------------

  // 1. Par catégorie (taux de réussite)
  const perCategory = new Map<number, CategoryStat>();
  for (const a of answerList) {
    if (!a.question_id) continue;
    const catId = catByQuestion.get(a.question_id);
    if (catId == null) continue;
    const stat = perCategory.get(catId) ?? { total: 0, correct: 0 };
    stat.total += 1;
    if (a.is_correct) stat.correct += 1;
    perCategory.set(catId, stat);
  }

  // 2. Par jour (évolution sur HISTORY_DAYS jours) — basé sur le score
  //    moyen des sessions de la journée
  const perDay = new Map<string, { score: number; count: number; questions: number }>();
  for (const s of sessions ?? []) {
    const day = new Date(s.created_at).toISOString().slice(0, 10);
    const cur = perDay.get(day) ?? { score: 0, count: 0, questions: 0 };
    cur.score += s.score ?? 0;
    cur.count += 1;
    cur.questions += s.total_count ?? 0;
    perDay.set(day, cur);
  }

  // 3. Par mode (camembert)
  const perMode = new Map<string, number>();
  for (const s of sessions ?? []) {
    perMode.set(s.mode, (perMode.get(s.mode) ?? 0) + 1);
  }

  // -------------------------------------------------------------------
  // KPIs
  // -------------------------------------------------------------------

  const totalAnswered = answerList.length;
  const totalCorrect = answerList.filter((a) => a.is_correct).length;
  const accuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Streak : jours consécutifs jusqu'à aujourd'hui (ou hier max)
  const days = new Set(
    (sessions ?? []).map((s) =>
      new Date(s.created_at).toISOString().slice(0, 10),
    ),
  );
  const streak = computeStreak(days);
  const bestStreak = computeBestStreak(days);

  const fafSessions = (sessions ?? []).filter((s) => s.mode === "face_a_face");
  // Convention : score > 0 = victoire user (cf. saveFafSession)
  const fafWon = fafSessions.filter((s) => s.score > 0).length;
  const bestFaf = Math.max(0, ...fafSessions.map((s) => s.score));

  const totalCagnotte = (sessions ?? [])
    .filter((s) => s.mode === "douze_coups")
    .reduce((s, x) => s + (x.score ?? 0), 0);

  const totalQuestions = (sessions ?? []).reduce(
    (s, x) => s + (x.total_count ?? 0),
    0,
  );
  const totalTimeMs = answerList.reduce(
    (s, x) => s + (x.time_taken_ms ?? 0),
    0,
  );
  const avgResponseSec =
    totalAnswered > 0
      ? Math.round((totalTimeMs / totalAnswered) / 100) / 10
      : 0;

  // -------------------------------------------------------------------
  // Maître de Midi
  // -------------------------------------------------------------------

  const perCategoryStringKeyed = new Map<string | number, CategoryStat>();
  for (const [k, v] of perCategory) perCategoryStringKeyed.set(k, v);

  const maitre = computeMaitreScore({
    totalAnswered,
    totalCorrect,
    perCategory: perCategoryStringKeyed,
    currentStreak: streak,
    fafPlayed: fafSessions.length,
    fafWon,
  });

  // Évolution du score Maître par jour : on ré-injecte les agrégats jour par
  // jour (approximation : on re-calcule un score par jour avec les sessions
  // jusqu'à ce jour-là, mais simplifié = score moyen normalisé).
  const masteryHistory = buildMasteryHistory(sessions ?? []);
  const estimatedDays = estimateMasteryDays(masteryHistory);

  const weakest = weakestCategories(perCategoryStringKeyed, 3, 10).map((w) => ({
    nom: catsById.get(Number(w.key))?.nom ?? String(w.key),
    couleur: catsById.get(Number(w.key))?.couleur ?? null,
    ratio: w.ratio,
  }));

  // Charge les badges par id (deux étapes pour éviter typing supabase)
  const badgeIds = (userBadges ?? []).map((b) => b.badge_id);
  const { data: badgeRows } =
    badgeIds.length > 0
      ? await supabase
          .from("badges")
          .select("id, code, nom, description, icone")
          .in("id", badgeIds)
      : { data: [] as Array<{
          id: number;
          code: string;
          nom: string;
          description: string | null;
          icone: string | null;
        }> };

  const data: StatsData = {
    pseudo: profile?.pseudo ?? "joueur",
    xp: profile?.xp ?? 0,
    niveau: profile?.niveau ?? 1,
    accuracy,
    streak,
    bestStreak,
    totalQuestions,
    avgResponseSec,
    bestFaf,
    totalCagnotte,
    favCount: favCount ?? 0,
    wrongCount: wrongCount ?? 0,
    evolution: buildEvolution(perDay, HISTORY_DAYS),
    perCategory: Array.from(perCategory.entries())
      .map(([id, s]) => {
        const cat = catsById.get(id);
        return {
          nom: cat?.nom ?? `Cat #${id}`,
          couleur: cat?.couleur ?? "#F5C518",
          total: s.total,
          correct: s.correct,
          ratio: s.total > 0 ? s.correct / s.total : 0,
        };
      })
      .sort((a, b) => b.ratio - a.ratio),
    perMode: Array.from(perMode.entries()).map(([mode, count]) => ({
      mode,
      count,
    })),
    activity: buildActivity(perDay, HISTORY_DAYS),
    badges: (userBadges ?? [])
      .map((ub) => {
        const b = badgeRows?.find((r) => r.id === ub.badge_id);
        if (!b) return null;
        return {
          code: b.code,
          nom: b.nom,
          description: b.description,
          icone: b.icone,
          obtainedAt: ub.obtained_at,
        };
      })
      .filter((b): b is NonNullable<typeof b> => !!b),
    maitre: {
      score: maitre.score,
      breakdown: maitre.breakdown,
      estimatedDays,
      weakest,
    },
  };

  return <StatsClient data={data} />;
}

// ============================================================================
// Helpers d'agrégat
// ============================================================================

/** Compte les jours consécutifs jusqu'à aujourd'hui (ou hier max). */
function computeStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  let started = false;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (days.has(iso)) {
      streak += 1;
      started = true;
    } else if (started) {
      break;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

/** Plus longue série jamais atteinte. */
function computeBestStreak(days: Set<string>): number {
  if (days.size === 0) return 0;
  const sorted = Array.from(days).sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const next = new Date(sorted[i]!);
    const diff = Math.round(
      (next.getTime() - prev.getTime()) / 86_400_000,
    );
    if (diff === 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

/** Tableau date→score moyen sur N jours, complétant les jours sans partie à null. */
function buildEvolution(
  perDay: Map<string, { score: number; count: number; questions: number }>,
  days: number,
): Array<{ date: string; score: number | null }> {
  const out: Array<{ date: string; score: number | null }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const entry = perDay.get(iso);
    out.push({
      date: iso,
      score: entry && entry.count > 0 ? entry.score / entry.count : null,
    });
  }
  return out;
}

/** Heatmap d'activité : N derniers jours avec nombre de questions jouées. */
function buildActivity(
  perDay: Map<string, { score: number; count: number; questions: number }>,
  days: number,
): Array<{ date: string; questions: number }> {
  const out: Array<{ date: string; questions: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({
      date: iso,
      questions: perDay.get(iso)?.questions ?? 0,
    });
  }
  return out;
}

/**
 * Approximation de l'historique du score Maître :
 * pour chaque jour avec sessions, on approxime le score Maître = précision
 * moyenne du jour (ratio bonnes/total). Suffisant pour estimer la pente.
 */
function buildMasteryHistory(
  sessions: Array<{
    created_at: string;
    correct_count: number;
    total_count: number;
  }>,
): Array<{ date: string; score: number }> {
  const perDay = new Map<string, { c: number; t: number }>();
  for (const s of sessions) {
    const day = new Date(s.created_at).toISOString().slice(0, 10);
    const cur = perDay.get(day) ?? { c: 0, t: 0 };
    cur.c += s.correct_count ?? 0;
    cur.t += s.total_count ?? 0;
    perDay.set(day, cur);
  }
  return Array.from(perDay.entries())
    .map(([date, { c, t }]) => ({
      date,
      score: t > 0 ? (c / t) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
