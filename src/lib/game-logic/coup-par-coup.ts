import type { LifeState } from "@/components/game/LifeBar";
import type { Database, Json } from "@/types/database";

/**
 * Règles "Le Coup par Coup" (Jeu 2 dans Midi Master) :
 *  - Un thème + 7 propositions : 6 sont liées au thème, 1 est l'intrus.
 *  - Le joueur clique les propositions une à une en évitant l'intrus.
 *  - Une partie = 5 rounds consécutifs (thèmes différents).
 *  - **LifeBar 2 paliers** :
 *      0 erreur = green · 1 erreur = yellow · 2 erreurs = FACE-À-FACE
 *    (le compteur est global sur toute la partie, pas par round)
 *  - Scoring : +50 XP par proposition correcte, +200 XP bonus si round parfait,
 *    +500 XP bonus si partie parfaite (5 rounds consécutifs sans erreur).
 */

export const CPC_ROUNDS_PER_GAME = 5;
export const CPC_PROPOSITIONS_PER_ROUND = 7;
export const CPC_VALID_PER_ROUND = 6;
export const CPC_XP_PER_CORRECT = 50;
export const CPC_XP_ROUND_PERFECT_BONUS = 200;
export const CPC_XP_GAME_PERFECT_BONUS = 500;

type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

export interface CpcProposition {
  text: string;
  /** true = liée au thème (à cliquer). false = intrus (à éviter). */
  isValid: boolean;
}

export interface CpcRound {
  questionId: string;
  theme: string;
  propositions: CpcProposition[];
  category?: { nom: string; couleur: string | null };
  explication: string | null;
}

/**
 * Tire `count` rounds aléatoires du pool, mélange les propositions,
 * et retourne les questions préparées pour l'UI.
 *
 * Si le pool est plus petit que `count`, on complète en répétant
 * (dans les faits on a 17 thèmes seedés et on n'en joue que 5).
 */
export function pickCoupParCoupRounds(
  pool: QuestionRow[],
  categoriesById: Map<number, CategoryRow>,
  count = CPC_ROUNDS_PER_GAME,
): CpcRound[] {
  if (pool.length === 0) return [];

  // Fisher-Yates
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const picked = shuffled.slice(0, count);

  return picked.map((q) => {
    const reponsesRaw = Array.isArray(q.reponses)
      ? (q.reponses as unknown as { text: string; correct: boolean }[])
      : [];

    // Convertit en CpcProposition + shuffle
    const props: CpcProposition[] = reponsesRaw.map((r) => ({
      text: r.text,
      isValid: r.correct,
    }));

    // Fisher-Yates pour randomiser l'ordre d'affichage
    for (let i = props.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = props[i]!;
      props[i] = props[j]!;
      props[j] = tmp;
    }

    const cat = q.category_id ? categoriesById.get(q.category_id) : null;

    return {
      questionId: q.id,
      theme: q.enonce,
      propositions: props,
      category: cat ? { nom: cat.nom, couleur: cat.couleur } : undefined,
      explication: q.explication,
    };
  });
}

/**
 * LifeBar mapping pour Le Coup par Coup.
 *  - 0 erreur → green
 *  - 1 erreur → yellow (orange dans la spec user)
 *  - 2 erreurs → red (game over, Face-à-Face)
 */
export function cpcLifeState(wrongCount: number): LifeState {
  if (wrongCount <= 0) return "green";
  if (wrongCount === 1) return "yellow";
  return "red";
}

/** À 2 erreurs, la partie est terminée (Face-à-Face pénalité). */
export const CPC_MAX_ERRORS = 2;

export function cpcIsGameOver(wrongCount: number): boolean {
  return wrongCount >= CPC_MAX_ERRORS;
}

/**
 * Calcule l'XP total d'une partie à partir des rounds joués.
 */
export function computeCpcXp(rounds: CpcRoundResult[]): number {
  let xp = 0;
  let allPerfect = true;
  for (const r of rounds) {
    xp += r.correctClicks * CPC_XP_PER_CORRECT;
    if (r.status === "perfect") {
      xp += CPC_XP_ROUND_PERFECT_BONUS;
    } else {
      allPerfect = false;
    }
  }
  if (allPerfect && rounds.length === CPC_ROUNDS_PER_GAME) {
    xp += CPC_XP_GAME_PERFECT_BONUS;
  }
  return xp;
}

export interface CpcRoundResult {
  questionId: string;
  correctClicks: number;
  hitIntrus: boolean;
  status: "perfect" | "caught-intrus" | "incomplete";
}

export function reponsesToJson(
  props: CpcProposition[],
): Json {
  return props.map((p) => ({ text: p.text, correct: p.isValid })) as Json;
}

/**
 * Probabilité qu'un bot clique correctement (proposition valide non cliquée)
 * au lieu de tomber sur l'intrus. Plus le niveau est élevé, moins il se trompe.
 */
const CPC_BOT_CORRECT_PROBA: Record<
  "facile" | "moyen" | "difficile",
  number
> = {
  facile: 0.7,
  moyen: 0.85,
  difficile: 0.95,
};

/**
 * Sélectionne l'index de la proposition que le bot va cliquer ce tour.
 *  - Ne clique jamais une proposition déjà cliquée.
 *  - Avec proba `CPC_BOT_CORRECT_PROBA[difficulty]`, choisit parmi les valides
 *    non cliquées. Sinon clique l'intrus (si non cliqué).
 *  - Retourne -1 si aucune proposition n'est cliquable.
 */
export function botPickCpcProposition(
  propositions: CpcProposition[],
  clicked: ReadonlySet<string>,
  difficulty: "facile" | "moyen" | "difficile",
  rng: () => number = Math.random,
): number {
  const unclicked = propositions
    .map((p, i) => ({ prop: p, idx: i }))
    .filter(({ prop }) => !clicked.has(prop.text));

  if (unclicked.length === 0) return -1;

  const remainingValids = unclicked.filter(({ prop }) => prop.isValid);
  const remainingIntrus = unclicked.filter(({ prop }) => !prop.isValid);

  // Cas triviaux
  if (remainingValids.length === 0) return remainingIntrus[0]?.idx ?? -1;
  if (remainingIntrus.length === 0) {
    const pick = remainingValids[Math.floor(rng() * remainingValids.length)];
    return pick?.idx ?? -1;
  }

  // Tirage pondéré
  const goCorrect = rng() < CPC_BOT_CORRECT_PROBA[difficulty];
  if (goCorrect) {
    const pick = remainingValids[Math.floor(rng() * remainingValids.length)];
    return pick?.idx ?? -1;
  }
  return remainingIntrus[0]?.idx ?? -1;
}
