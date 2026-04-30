/**
 * État sérialisable d'une partie TV simplifiée (stocké dans
 * `tv_rooms.state` JSONB). Volontairement épuré par rapport au mode 12
 * Coups complet : tour par tour, score = bonnes réponses, pas de
 * cagnotte / duel / face-à-face pour ce premier MVP du mode TV.
 *
 * Un mode plus riche (réplique exacte du parcours 12 Coups) pourra être
 * ajouté plus tard en étendant ce type.
 */

export interface TvQuestionData {
  id: string;
  enonce: string;
  format?: string | null;
  /** Choix proposés. `correctIdx` est conservé côté state mais NE DOIT PAS être broadcast aux téléphones. */
  choices: Array<{ idx: number; text: string }>;
  correctIdx: number;
  explication?: string | null;
}

export interface TvGameState {
  phase: "intro" | "playing" | "results";
  questions: TvQuestionData[];
  /** Index de la question courante. */
  currentQuestionIdx: number;
  /** Token du joueur dont c'est le tour. */
  currentPlayerToken: string | null;
  /** Score (bonnes réponses) par player_token. */
  scores: Record<string, number>;
  /** Ordre de tour figé au démarrage (liste de tokens). */
  turnOrder: string[];
  /** Nombre total de questions à jouer dans cette session. */
  totalRounds: number;
  /** Index du tour courant (0..totalRounds-1). */
  currentRound: number;
}

export function isTvGameState(x: unknown): x is TvGameState {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.phase === "string" &&
    Array.isArray(o.questions) &&
    Array.isArray(o.turnOrder) &&
    typeof o.scores === "object"
  );
}
