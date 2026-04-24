import type { LifeState } from "@/components/game/LifeBar";
import type { Database, Json } from "@/types/database";

/**
 * Helpers métier du Jeu 1 (Quizz 1 chance sur 2).
 *
 * Règles :
 *  - 10 questions tirées au hasard (type quizz_2), variées en catégories.
 *  - Timer 10 s par question.
 *  - Compteur d'erreurs : 0 = vert, 1 = jaune, 2 = rouge, 3 = game over (face-à-face).
 *  - Bonne réponse  : +100 XP. 10/10 sans erreur : +500 XP de bonus.
 */

export const JEU1_TOTAL_QUESTIONS = 10;
export const JEU1_TIMER_SECONDS = 10;
export const JEU1_XP_PER_CORRECT = 100;
export const JEU1_XP_PERFECT_BONUS = 500;
export const JEU1_MAX_PER_CATEGORY = 2;

type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

export interface Jeu1Question {
  id: string;
  enonce: string;
  reponses: { text: string; correct: boolean }[];
  category?: { nom: string; couleur: string | null };
  explication: string | null;
  difficulte: number;
}

export interface Jeu1AnswerLog {
  questionId: string;
  isCorrect: boolean;
  timeMs: number;
}

/**
 * Sélectionne 10 questions parmi les `pool` quizz_2 fournies, en limitant
 * `maxPerCategory` par catégorie pour assurer la variété.
 *
 * Mélange les réponses A/B aléatoirement à chaque question pour qu'on
 * ne puisse pas se reposer sur "la bonne est toujours la première".
 */
export function pickJeu1Questions(
  pool: QuestionRow[],
  categoriesById: Map<number, CategoryRow>,
  count = JEU1_TOTAL_QUESTIONS,
  maxPerCategory = JEU1_MAX_PER_CATEGORY,
): Jeu1Question[] {
  // Shuffle pool (Fisher-Yates)
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const picked: QuestionRow[] = [];
  const perCat = new Map<number | null, number>();

  for (const q of shuffled) {
    if (picked.length >= count) break;
    const used = perCat.get(q.category_id) ?? 0;
    if (used >= maxPerCategory) continue;
    picked.push(q);
    perCat.set(q.category_id, used + 1);
  }
  // Si on n'a pas assez (catégories trop contraintes), on complète sans limite
  if (picked.length < count) {
    for (const q of shuffled) {
      if (picked.length >= count) break;
      if (picked.includes(q)) continue;
      picked.push(q);
    }
  }

  return picked.map((q) => {
    const reponsesArr = Array.isArray(q.reponses)
      ? (q.reponses as unknown as { text: string; correct: boolean }[])
      : [];
    // Shuffle A/B (en quizz_2 il y a exactement 2 réponses)
    const shuffledRep =
      Math.random() < 0.5 ? [reponsesArr[0]!, reponsesArr[1]!] : [reponsesArr[1]!, reponsesArr[0]!];

    const cat = q.category_id ? categoriesById.get(q.category_id) : null;

    return {
      id: q.id,
      enonce: q.enonce,
      reponses: shuffledRep,
      category: cat ? { nom: cat.nom, couleur: cat.couleur } : undefined,
      explication: q.explication,
      difficulte: q.difficulte,
    };
  });
}

/** 0 erreur → green, 1 → yellow, 2 → red. À 3 c'est game over. */
export function computeLifeState(wrongCount: number): LifeState {
  if (wrongCount <= 0) return "green";
  if (wrongCount === 1) return "yellow";
  return "red";
}

export function shouldTriggerFaceAFace(wrongCount: number): boolean {
  return wrongCount >= 3;
}

/** XP final d'une partie : 100/correct + 500 bonus si parfait (10/10). */
export function computeJeu1Xp(correctCount: number, total: number): number {
  const base = correctCount * JEU1_XP_PER_CORRECT;
  const perfect = correctCount === total ? JEU1_XP_PERFECT_BONUS : 0;
  return base + perfect;
}

/**
 * Sérialise les réponses pour insertion dans questions.reponses (jsonb).
 * Utile si on persiste un snapshot.
 */
export function reponsesToJson(
  reponses: { text: string; correct: boolean }[],
): Json {
  return reponses as unknown as Json;
}
