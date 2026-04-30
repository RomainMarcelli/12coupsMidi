/**
 * P5.1 — État du mode "Face-à-face avec présentateur humain".
 *
 * 2 finalistes s'affrontent. Vote majoritaire de tous les joueurs pour
 * désigner le présentateur (qui lit les questions à voix haute et valide
 * via son téléphone). L'autre est le challenger qui répond.
 *
 * Chaque joueur a un timer (default 60s). Quand le challenger répond
 * correctement, son timer fige et les rôles s'inversent. Quand il se
 * trompe, son timer continue et il a une nouvelle question. Premier
 * timer à 0 = éliminé, l'autre gagne.
 */

export interface FaceAFaceQuestion {
  id: string;
  enonce: string;
  /** Les choix sont conservés en BDD/state mais ne sont pas affichés à
   *  l'écran du challenger : le présentateur lit la question à voix haute. */
  choices: Array<{ idx: number; text: string }>;
  correctIdx: number;
}

export interface FaceAFaceState {
  phase: "vote" | "playing" | "ended";
  /** Tokens des 2 finalistes. */
  finalists: [string, string];
  /** Pseudos pour affichage (cache local). */
  finalistPseudos: Record<string, string>;
  /** Votes : votant → token choisi. */
  votes: Record<string, string>;
  /** Présentateur (résultat du vote). Null tant que phase=vote. */
  presenterToken: string | null;
  /** Challenger (l'autre finaliste). Null tant que phase=vote. */
  challengerToken: string | null;
  /** Token du joueur dont c'est le tour de répondre. */
  currentChallengerToken: string | null;
  /** Timers en secondes restantes par token. */
  timers: Record<string, number>;
  /** Pool de questions disponibles + index courant. */
  questions: FaceAFaceQuestion[];
  currentQuestionIdx: number;
  /** Indique si le timer décompte (pause entre 2 questions). */
  ticking: boolean;
  /** Gagnant final (phase=ended). */
  winnerToken: string | null;
}

/** Décompte le vote, retourne le token gagnant (égalité = aléatoire). */
export function tallyVote(
  votes: Record<string, string>,
  finalists: [string, string],
): string {
  const counts: Record<string, number> = { [finalists[0]]: 0, [finalists[1]]: 0 };
  for (const v of Object.values(votes)) {
    if (v in counts) counts[v]! += 1;
  }
  const a = counts[finalists[0]] ?? 0;
  const b = counts[finalists[1]] ?? 0;
  if (a > b) return finalists[0];
  if (b > a) return finalists[1];
  // Égalité : tirage au sort
  return Math.random() < 0.5 ? finalists[0] : finalists[1];
}

export function isFaceAFaceState(x: unknown): x is FaceAFaceState {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.phase === "string" &&
    Array.isArray(o.finalists) &&
    o.finalists.length === 2 &&
    typeof o.timers === "object"
  );
}
