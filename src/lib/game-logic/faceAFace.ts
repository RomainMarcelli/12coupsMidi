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
  /** Délai de base avant que le bot "réfléchisse" à répondre. */
  minDelayMs: number;
  maxDelayMs: number;
  /**
   * Facteur appliqué au temps de lecture/saisie calculé à partir de la
   * longueur de la question + réponse. Plus le bot est facile, plus il
   * met de temps "à lire" (ex. 1.4x plus lent qu'un bot difficile).
   */
  readingFactor: number;
  label: string;
}

/**
 * Profils du bot par difficulté.
 * Délais réajustés pour rester réalistes même sur questions courtes :
 * un humain met 2–3 s minimum pour lire un énoncé court + saisir.
 *
 *  - facile   : 50 %, délai base 3.0–5.5 s, lecture lente (1.4x)
 *  - moyen    : 70 %, délai base 2.5–4.5 s, lecture normale (1.0x)
 *  - difficile: 90 %, délai base 2.0–3.5 s, lecture rapide (0.7x)
 *
 * Le délai TOTAL = base + (enonceLength + answerLength) × 25ms × readingFactor.
 * Plafonné à 8 000 ms par tour pour que le jeu reste fluide même sur
 * des questions longues.
 */
export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  facile: {
    correctProbability: 0.5,
    minDelayMs: 3000,
    maxDelayMs: 5500,
    readingFactor: 1.4,
    label: "Facile",
  },
  moyen: {
    correctProbability: 0.7,
    minDelayMs: 2500,
    maxDelayMs: 4500,
    readingFactor: 1.0,
    label: "Moyen",
  },
  difficile: {
    correctProbability: 0.9,
    minDelayMs: 2000,
    maxDelayMs: 3500,
    readingFactor: 0.7,
    label: "Difficile",
  },
};

/** ms par caractère pour le temps de lecture/saisie (avant readingFactor). */
const MS_PER_CHAR = 25;
/** Cap dur pour ne pas avoir un bot qui dort 15 s sur une longue question. */
const MAX_READING_BONUS_MS = 4000;
/** Cap total pour que le tour reste jouable. */
const MAX_TOTAL_DELAY_MS = 8000;

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

/**
 * Délai de réponse du bot (ms). Délai de base aléatoire dans le profil,
 * + bonus "temps de lecture/saisie" proportionnel à la longueur de la
 * question et de la réponse correcte (modulé par `readingFactor`).
 *
 * Sans `enonceLength`/`answerLength`, on retombe sur le délai de base
 * uniquement (ancien comportement). Mais idéalement les callers passent
 * ces longueurs pour que le bot soit "réaliste" sur les questions longues.
 */
export function botResponseDelayMs(
  difficulty: BotDifficulty,
  optsOrRng: Rng | { enonceLength?: number; answerLength?: number; rng?: Rng } = Math.random,
): number {
  const p = BOT_PROFILES[difficulty];
  const opts =
    typeof optsOrRng === "function"
      ? { rng: optsOrRng, enonceLength: 0, answerLength: 0 }
      : {
          rng: optsOrRng.rng ?? Math.random,
          enonceLength: Math.max(0, optsOrRng.enonceLength ?? 0),
          answerLength: Math.max(0, optsOrRng.answerLength ?? 0),
        };
  const base =
    p.minDelayMs + Math.floor(opts.rng() * (p.maxDelayMs - p.minDelayMs));
  const readingBonusRaw =
    (opts.enonceLength + opts.answerLength) * MS_PER_CHAR * p.readingFactor;
  const readingBonus = Math.min(MAX_READING_BONUS_MS, readingBonusRaw);
  return Math.min(MAX_TOTAL_DELAY_MS, Math.floor(base + readingBonus));
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
