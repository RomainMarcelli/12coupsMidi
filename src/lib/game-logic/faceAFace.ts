import type { Database } from "@/types/database";

/**
 * Règles Face-à-Face (Jeu 3 dans Midi Master) :
 *  - 2 joueurs, chacun 60 s de chrono.
 *  - Le joueur actif doit répondre : bonne réponse → son chrono fige,
 *    l'autre joue. Mauvaise réponse → question suivante auto, le chrono
 *    continue de tourner. Passer = question suivante, chrono continue.
 *  - Entre 2 tours, on demande au joueur appuyer sur un bouton avant
 *    de démarrer (pratique en mode Ami pour se passer le téléphone).
 *  - Premier dont le chrono atteint 0 = perd.
 *  - Modes : vs Bot (facile / moyen / difficile) ou vs Ami (local).
 */

export const FAF_DURATION_MS = 60_000;
export const FAF_POOL_SIZE = 50;

export type FafMode = "vs_bot" | "vs_ami";
export type BotDifficulty = "facile" | "moyen" | "difficile";

type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

export interface FafQuestion {
  id: string;
  enonce: string;
  bonne_reponse: string;
  alias: string[];
  category?: { nom: string; couleur: string | null };
  explication: string | null;
  difficulte: number;
}

export interface BotProfile {
  correctProbability: number;
  minDelayMs: number;
  maxDelayMs: number;
  label: string;
}

/**
 * Profils du bot par difficulté.
 *  - facile   : 50 % de bonnes réponses, délai 2.5–4.5 s
 *  - moyen    : 70 % de bonnes réponses, délai 1.8–3.2 s
 *  - difficile: 90 % de bonnes réponses, délai 1.2–2.5 s
 */
export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  facile: {
    correctProbability: 0.5,
    minDelayMs: 2500,
    maxDelayMs: 4500,
    label: "Facile",
  },
  moyen: {
    correctProbability: 0.7,
    minDelayMs: 1800,
    maxDelayMs: 3200,
    label: "Moyen",
  },
  difficile: {
    correctProbability: 0.9,
    minDelayMs: 1200,
    maxDelayMs: 2500,
    label: "Difficile",
  },
};

type Rng = () => number;

/**
 * Sélectionne jusqu'à `count` questions face_a_face dans le pool.
 * Fisher-Yates avec RNG injectable (utile pour tests).
 */
export function pickFaceAFaceQuestions(
  pool: QuestionRow[],
  categoriesById: Map<number, CategoryRow>,
  count: number = FAF_POOL_SIZE,
  rng: Rng = Math.random,
): FafQuestion[] {
  if (pool.length === 0) return [];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, count).map((q) => {
    const aliasRaw = Array.isArray(q.alias) ? (q.alias as unknown[]) : [];
    const alias = aliasRaw.filter((a): a is string => typeof a === "string");
    const cat = q.category_id ? categoriesById.get(q.category_id) : null;
    return {
      id: q.id,
      enonce: q.enonce,
      bonne_reponse: q.bonne_reponse ?? "",
      alias,
      category: cat ? { nom: cat.nom, couleur: cat.couleur } : undefined,
      explication: q.explication,
      difficulte: q.difficulte,
    };
  });
}

/**
 * Tire l'index d'une question qui n'est pas dans `usedIds`.
 * Si toutes les questions ont été utilisées, on repart sur l'ensemble
 * (pool de 50, peu probable d'en arriver là vu le chrono 60 s).
 * Retourne -1 si le pool est vide.
 */
export function nextQuestionIndex(
  poolSize: number,
  usedIds: ReadonlySet<number>,
  rng: Rng = Math.random,
): number {
  if (poolSize <= 0) return -1;
  if (usedIds.size >= poolSize) {
    return Math.floor(rng() * poolSize);
  }
  const available: number[] = [];
  for (let i = 0; i < poolSize; i++) {
    if (!usedIds.has(i)) available.push(i);
  }
  if (available.length === 0) return Math.floor(rng() * poolSize);
  return available[Math.floor(rng() * available.length)]!;
}

/** Délai de réponse du bot (ms) — uniforme entre min et max du profil. */
export function botResponseDelayMs(
  difficulty: BotDifficulty,
  rng: Rng = Math.random,
): number {
  const p = BOT_PROFILES[difficulty];
  return p.minDelayMs + Math.floor(rng() * (p.maxDelayMs - p.minDelayMs));
}

/** True si le bot donne une bonne réponse à ce tour (tirage Bernoulli). */
export function botAnswersCorrectly(
  difficulty: BotDifficulty,
  rng: Rng = Math.random,
): boolean {
  return rng() < BOT_PROFILES[difficulty].correctProbability;
}

/**
 * XP barème pour le vainqueur humain :
 *  - défaite         : 0
 *  - victoire > 30 s restantes : 500
 *  - 15 – 30 s        : 400
 *  - 5 – 15 s         : 300
 *  - 0 – 5 s          : 200
 * (Le bot ne gagne pas d'XP ; en vs Ami, seul le vainqueur en gagne.)
 */
export function computeFafXp(params: {
  won: boolean;
  timeLeftMs: number;
}): number {
  if (!params.won) return 0;
  const { timeLeftMs } = params;
  if (timeLeftMs >= 30_000) return 500;
  if (timeLeftMs >= 15_000) return 400;
  if (timeLeftMs >= 5_000) return 300;
  return 200;
}

/** Type utilitaire pour le log de réponses envoyé à `actions.ts`. */
export interface FafAnswerLog {
  questionId: string;
  isCorrect: boolean;
  timeMs: number;
  /** 'user' | 'bot' | 'ami' — qui répondait. 'user' = le joueur authentifié. */
  by: "user" | "bot" | "ami";
}
