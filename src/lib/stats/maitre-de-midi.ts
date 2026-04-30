/**
 * Calcul du "Score Maître de Midi" — un indicateur composite 0-100 basé sur
 * 4 dimensions pondérées :
 *   - Précision globale (30%)
 *   - Couverture catégories : % de catégories ≥70% réussite avec ≥20 questions (30%)
 *   - Consistance : streak quotidien actuel (20%)
 *   - Performance Face-à-Face : taux de victoire vs bots (20%)
 *
 * Le module est pur (aucun import Next/React/Supabase) pour rester
 * facilement testable.
 */

export interface CategoryStat {
  /** Nombre total de questions répondues dans cette catégorie. */
  total: number;
  /** Nombre de bonnes réponses. */
  correct: number;
}

export interface MaitreInput {
  /** Total de questions répondues toutes catégories confondues. */
  totalAnswered: number;
  /** Total de bonnes réponses toutes catégories confondues. */
  totalCorrect: number;
  /** Stats par catégorie (clé = nom ou id de la catégorie). */
  perCategory: Map<string | number, CategoryStat>;
  /** Streak quotidien actuel (jours consécutifs avec au moins 1 partie). */
  currentStreak: number;
  /** Nombre de parties Face-à-Face jouées. */
  fafPlayed: number;
  /** Nombre de parties Face-à-Face gagnées. */
  fafWon: number;
}

export interface MaitreOutput {
  /** Score 0-100. */
  score: number;
  /** Détail par dimension (utile pour debug / tooltip). */
  breakdown: {
    accuracy: number;       // 0-100
    coverage: number;       // 0-100
    consistency: number;    // 0-100
    facePerf: number;       // 0-100
  };
}

const WEIGHTS = {
  accuracy: 0.3,
  coverage: 0.3,
  consistency: 0.2,
  facePerf: 0.2,
};

/** Seuil de réussite pour considérer une catégorie comme "maîtrisée". */
export const CATEGORY_MASTERY_RATIO = 0.7;
/** Nombre min de questions pour qu'une catégorie compte dans la couverture. */
export const CATEGORY_MIN_QUESTIONS = 20;
/** Streak considéré comme "100% consistent". */
export const STREAK_MAX_DAYS = 30;

export function computeMaitreScore(input: MaitreInput): MaitreOutput {
  // 1. Précision globale (0-100)
  const accuracy =
    input.totalAnswered > 0
      ? (input.totalCorrect / input.totalAnswered) * 100
      : 0;

  // 2. Couverture catégories (0-100)
  let mastered = 0;
  let countedCategories = 0;
  for (const stat of input.perCategory.values()) {
    if (stat.total < CATEGORY_MIN_QUESTIONS) continue;
    countedCategories += 1;
    const ratio = stat.total > 0 ? stat.correct / stat.total : 0;
    if (ratio >= CATEGORY_MASTERY_RATIO) mastered += 1;
  }
  const coverage =
    countedCategories > 0 ? (mastered / countedCategories) * 100 : 0;

  // 3. Consistance (streak / STREAK_MAX_DAYS, plafonné à 100)
  const consistency = Math.min(
    100,
    (input.currentStreak / STREAK_MAX_DAYS) * 100,
  );

  // 4. Performance Face-à-Face (taux de victoire en %)
  const facePerf =
    input.fafPlayed > 0 ? (input.fafWon / input.fafPlayed) * 100 : 0;

  const score =
    accuracy * WEIGHTS.accuracy +
    coverage * WEIGHTS.coverage +
    consistency * WEIGHTS.consistency +
    facePerf * WEIGHTS.facePerf;

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { accuracy, coverage, consistency, facePerf },
  };
}

/**
 * Estime le nombre de jours pour atteindre 100 % en extrapolant la pente
 * de progression sur les `windowDays` derniers points.
 *
 * `history` : liste de scores Maître par date (ordonnés du plus ancien au plus récent).
 * Renvoie :
 *   - un nombre de jours estimé (capé à 365)
 *   - `null` si la pente est ≤ 0 ou si l'historique est trop court.
 */
export function estimateMasteryDays(
  history: Array<{ date: string; score: number }>,
  windowDays = 14,
): number | null {
  if (history.length < 2) return null;
  const window = history.slice(-windowDays);
  if (window.length < 2) return null;

  const first = window[0]!;
  const last = window[window.length - 1]!;
  const dayDiff = daysBetween(first.date, last.date);
  if (dayDiff <= 0) return null;

  const slope = (last.score - first.score) / dayDiff;
  if (slope <= 0) return null;

  const remaining = 100 - last.score;
  if (remaining <= 0) return 0;

  const days = Math.ceil(remaining / slope);
  return Math.min(365, Math.max(1, days));
}

/** Top N catégories où le user est le moins bon (parmi celles avec ≥ minQ questions). */
export function weakestCategories(
  perCategory: Map<string | number, CategoryStat>,
  topN = 3,
  minQ = 10,
): Array<{ key: string | number; ratio: number }> {
  const eligible: Array<{ key: string | number; ratio: number }> = [];
  for (const [key, stat] of perCategory.entries()) {
    if (stat.total < minQ) continue;
    eligible.push({
      key,
      ratio: stat.total > 0 ? stat.correct / stat.total : 0,
    });
  }
  eligible.sort((a, b) => a.ratio - b.ratio);
  return eligible.slice(0, topN);
}

/** Distance en jours entre deux dates ISO (YYYY-MM-DD). */
function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86_400_000);
}
