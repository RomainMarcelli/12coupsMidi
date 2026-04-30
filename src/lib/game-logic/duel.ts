import type { Database } from "@/types/database";

/**
 * Règles du Duel (nouveau jeu introduit quand un candidat passe au rouge).
 *
 * Flux :
 *  1. Le candidat "rouge" désigne un adversaire.
 *  2. L'adversaire choisit entre 2 thèmes (1er Duel) OU se voit imposer
 *     un thème (2e Duel, après le Coup par Coup).
 *  3. Une question quizz_4 sur le thème choisi.
 *  4. Si bonne réponse → l'adversaire gagne la cagnotte du rouge.
 *     Si mauvaise → l'adversaire est éliminé, le rouge garde sa place.
 *
 * Scoring XP côté user authentifié :
 *  - Gagner un Duel : +300 XP
 *  - Perdre un Duel : 0
 */

export const DUEL_TIMER_SECONDS = 15;
export const DUEL_CHOICES = 4;
export const DUEL_XP_WIN = 300;

type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "slug" | "couleur"
>;

export interface DuelTheme {
  categoryId: number;
  label: string;
  couleur: string | null;
  /** Questions quizz_4 disponibles sur ce thème. */
  questions: DuelQuestion[];
}

export interface DuelQuestion {
  id: string;
  enonce: string;
  reponses: { text: string; correct: boolean }[];
  explication: string | null;
  difficulte: number;
}

export interface DuelResult {
  /** id du joueur qui gagne le Duel. */
  winnerId: string;
  /** id du joueur éliminé. */
  eliminatedId: string;
  /** true si l'adversaire (non-rouge) a répondu correctement. */
  adversaryAnsweredCorrectly: boolean;
  questionId: string;
  /**
   * H1.1 — categoryId du thème choisi pour ce duel. Permet à l'appelant
   * de consommer le thème côté store sans avoir à re-deviner via
   * `findCategoryForQuestion` (qui peut retourner -1 si la question
   * n'est pas dans le pool local).
   */
  chosenCategoryId: number;
}

/**
 * Construit un pool de thèmes Duel à partir des questions quizz_4 + catégories.
 * Ne garde que les catégories qui ont au moins une quizz_4.
 */
export function buildDuelThemes(
  pool: QuestionRow[],
  categories: CategoryRow[],
): DuelTheme[] {
  const quizz4 = pool.filter((q) => q.type === "quizz_4");
  if (quizz4.length === 0) return [];

  const byCategory = new Map<number, QuestionRow[]>();
  for (const q of quizz4) {
    if (q.category_id === null) continue;
    const list = byCategory.get(q.category_id) ?? [];
    list.push(q);
    byCategory.set(q.category_id, list);
  }

  const themes: DuelTheme[] = [];
  for (const cat of categories) {
    const qs = byCategory.get(cat.id);
    if (!qs || qs.length === 0) continue;
    themes.push({
      categoryId: cat.id,
      label: cat.nom,
      couleur: cat.couleur,
      questions: qs.map(toDuelQuestion),
    });
  }
  return themes;
}

function toDuelQuestion(q: QuestionRow): DuelQuestion {
  const raw = Array.isArray(q.reponses)
    ? (q.reponses as unknown as { text: string; correct: boolean }[])
    : [];
  return {
    id: q.id,
    enonce: q.enonce,
    reponses: raw,
    explication: q.explication,
    difficulte: q.difficulte,
  };
}

/**
 * Tire 2 thèmes distincts (1er Duel) ou 1 thème (2e Duel) depuis le pool.
 * Retourne [] si pas assez de thèmes dispo.
 */
export function pickDuelThemes(
  themes: DuelTheme[],
  count: 1 | 2,
  rng: () => number = Math.random,
): DuelTheme[] {
  if (themes.length < count) return themes.slice(0, count);
  const shuffled = [...themes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, count);
}

/** Tire une question au hasard dans le thème choisi. */
export function pickDuelQuestion(
  theme: DuelTheme,
  rng: () => number = Math.random,
): DuelQuestion | null {
  if (theme.questions.length === 0) return null;
  const idx = Math.floor(rng() * theme.questions.length);
  return theme.questions[idx] ?? null;
}

/**
 * Shuffle les 4 réponses d'une question pour éviter la triche positionnelle.
 */
export function shuffleDuelAnswers(
  question: DuelQuestion,
  rng: () => number = Math.random,
): DuelQuestion {
  const reponses = [...question.reponses];
  for (let i = reponses.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = reponses[i]!;
    reponses[i] = reponses[j]!;
    reponses[j] = tmp;
  }
  return { ...question, reponses };
}

/**
 * Détermine l'issue d'un Duel :
 *  - Si l'adversaire a bien répondu → il gagne (rouge éliminé).
 *  - Sinon → l'adversaire est éliminé (rouge garde sa place).
 */
export function resolveDuel(params: {
  rougeId: string;
  adversaryId: string;
  adversaryAnsweredCorrectly: boolean;
  questionId: string;
  chosenCategoryId: number;
}): DuelResult {
  const {
    rougeId,
    adversaryId,
    adversaryAnsweredCorrectly,
    questionId,
    chosenCategoryId,
  } = params;
  return {
    winnerId: adversaryAnsweredCorrectly ? adversaryId : rougeId,
    eliminatedId: adversaryAnsweredCorrectly ? rougeId : adversaryId,
    adversaryAnsweredCorrectly,
    questionId,
    chosenCategoryId,
  };
}

/** XP gagnés par le user authentifié selon le résultat du Duel. */
export function computeDuelXp(params: {
  userId: string;
  result: DuelResult;
}): number {
  return params.result.winnerId === params.userId ? DUEL_XP_WIN : 0;
}
