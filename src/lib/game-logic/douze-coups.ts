import type { Database } from "@/types/database";
import type { BotDifficulty } from "./faceAFace";

/**
 * Logique pure du mode "12 Coups de Midi" (parcours multijoueur).
 *
 * Le mode enchaîne Jeu 1 (Coup d'Envoi) → Jeu 2 (Coup par Coup) → Face-à-Face
 * final. Entre les jeux et pendant eux, dès qu'un joueur passe au rouge
 * (2 erreurs dans le jeu en cours), un Duel éliminatoire est déclenché :
 * le rouge désigne un adversaire qui joue une question quizz_4 one-shot.
 *  - Si l'adversaire a bon : le rouge est éliminé, sa cagnotte est transférée.
 *  - Si l'adversaire a faux : l'adversaire est éliminé, sa cagnotte passe au rouge.
 *
 * Règles importantes (validées avec le user) :
 *  - Pas de max de tours : on joue jusqu'à avoir un éliminé avant de passer
 *    au jeu suivant.
 *  - Cagnotte initiale : 10 000 € par joueur. Reset à chaque nouvelle partie
 *    (pas d'accumulation entre parties).
 *  - 2 thèmes de duel tirés AU DÉPART de la partie (figés). Chaque duel
 *    « consomme » un thème. Si les 2 sont consommés, on retire 2 nouveaux
 *    thèmes à la volée.
 *  - Le survivant d'un duel voit ses erreurs du jeu en cours remises à zéro
 *    (il redémarre à vert).
 */

type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "slug" | "couleur"
>;

export const DC_STARTING_CAGNOTTE = 10_000;
/** Bonus cagnotte par bonne réponse dans les jeux (Jeu 1 et Jeu 2). */
export const DC_CORRECT_BONUS = 100;
/** Timer par question en Jeu 1 (Coup d'Envoi). */
export const DC_JEU1_TIMER_SECONDS = 10;
/** Timer par question en Jeu 2 (Coup par Coup) — plus long car il faut réfléchir. */
export const DC_JEU2_TIMER_SECONDS = 20;
/** Max d'erreurs par joueur dans le jeu courant avant déclenchement du duel. */
export const DC_MAX_ERRORS = 2;
/** Minimum de joueurs pour une partie. */
export const DC_MIN_PLAYERS = 2;
/** Maximum de joueurs pour une partie. */
export const DC_MAX_PLAYERS = 4;

export type DcGamePhase =
  | "setup"
  | "intro"
  | "jeu1"
  | "jeu2"
  | "duel"
  | "faceaface"
  | "results";

export type DcLifeState = "green" | "yellow" | "red";

export interface DcPlayer {
  id: string;
  pseudo: string;
  isBot: boolean;
  botLevel?: BotDifficulty;
  /** Cagnotte courante (€). */
  cagnotte: number;
  /** Erreurs accumulées dans le jeu courant (remis à 0 après duel gagné / passage au jeu suivant). */
  errors: number;
  isEliminated: boolean;
  correctCount: number;
  wrongCount: number;
}

export interface DcDuelThemes {
  theme1: CategoryRow;
  theme2: CategoryRow;
  theme1Used: boolean;
  theme2Used: boolean;
}

/**
 * État d'un Duel en cours.
 *  - `challengerId` : le joueur qui était au rouge et a déclenché le duel.
 *  - `challengedId` : l'adversaire désigné (réponds).
 *  - `returnPhase` : phase à reprendre après le duel (jeu1 ou jeu2).
 */
export interface DcPendingDuel {
  challengerId: string;
  challengedId: string | null;
  returnPhase: "jeu1" | "jeu2";
}

/**
 * Mappe nombre d'erreurs → état LifeBar.
 * 0 → green, 1 → yellow, 2+ → red.
 */
export function dcLifeState(errors: number): DcLifeState {
  if (errors <= 0) return "green";
  if (errors === 1) return "yellow";
  return "red";
}

/** `true` si le joueur a atteint le seuil rouge (déclenche duel). */
export function dcShouldTriggerDuel(errors: number): boolean {
  return errors >= DC_MAX_ERRORS;
}

/**
 * Tire `count` catégories distinctes au hasard parmi `categories`, en ne
 * gardant que celles qui ont au moins `minQuizz4` questions quizz_4 disponibles.
 *
 * Retourne [] si moins de `count` catégories sont éligibles.
 */
export function pickDuelCategories(
  categories: CategoryRow[],
  quizz4CountByCategory: Map<number, number>,
  count: number,
  minQuizz4: number = 1,
  rng: () => number = Math.random,
): CategoryRow[] {
  const eligible = categories.filter(
    (c) => (quizz4CountByCategory.get(c.id) ?? 0) >= minQuizz4,
  );
  if (eligible.length < count) return [];
  // Fisher-Yates
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, count);
}

/**
 * Construit l'objet initial des 2 thèmes de duel d'une partie.
 * Retourne `null` si pas assez de catégories avec des quizz_4.
 */
export function makeInitialDuelThemes(
  categories: CategoryRow[],
  quizz4CountByCategory: Map<number, number>,
  rng: () => number = Math.random,
): DcDuelThemes | null {
  const picks = pickDuelCategories(
    categories,
    quizz4CountByCategory,
    2,
    1,
    rng,
  );
  if (picks.length < 2) return null;
  return {
    theme1: picks[0]!,
    theme2: picks[1]!,
    theme1Used: false,
    theme2Used: false,
  };
}

/**
 * Renvoie les thèmes proposables pour un duel (= non consommés).
 * Si les deux sont consommés, renvoie un tableau vide (au caller de re-tirer).
 */
export function availableDuelThemes(
  themes: DcDuelThemes,
): CategoryRow[] {
  const out: CategoryRow[] = [];
  if (!themes.theme1Used) out.push(themes.theme1);
  if (!themes.theme2Used) out.push(themes.theme2);
  return out;
}

/**
 * Marque un thème comme utilisé après un duel.
 */
export function consumeDuelTheme(
  themes: DcDuelThemes,
  chosenCategoryId: number,
): DcDuelThemes {
  if (themes.theme1.id === chosenCategoryId) {
    return { ...themes, theme1Used: true };
  }
  if (themes.theme2.id === chosenCategoryId) {
    return { ...themes, theme2Used: true };
  }
  return themes;
}

/**
 * Rotation du tour : renvoie l'index du prochain joueur actif,
 * en sautant les éliminés. Retourne -1 si tous sont éliminés.
 */
export function dcNextActiveIdx(
  currentIdx: number,
  players: DcPlayer[],
): number {
  if (players.length === 0) return -1;
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const candidate = (currentIdx + step) % n;
    const p = players[candidate];
    if (p && !p.isEliminated) return candidate;
  }
  return -1;
}

/**
 * Nombre de joueurs non éliminés.
 */
export function dcAliveCount(players: DcPlayer[]): number {
  return players.filter((p) => !p.isEliminated).length;
}

/**
 * Applique le résultat d'un duel :
 *  - Si `adversaryCorrect` : le challenger (rouge) est éliminé, sa cagnotte
 *    passe au challenged.
 *  - Sinon : le challenged est éliminé, sa cagnotte passe au challenger.
 * Retourne un nouveau tableau de joueurs (immutable).
 *
 * Remet aussi les erreurs du survivant à 0 (repart à vert).
 */
export function applyDuelResult(
  players: DcPlayer[],
  challengerId: string,
  challengedId: string,
  adversaryCorrect: boolean,
): DcPlayer[] {
  const loserId = adversaryCorrect ? challengerId : challengedId;
  const winnerId = adversaryCorrect ? challengedId : challengerId;

  return players.map((p) => {
    if (p.id === loserId) {
      return { ...p, isEliminated: true, cagnotte: 0, errors: 0 };
    }
    if (p.id === winnerId) {
      const loser = players.find((pl) => pl.id === loserId);
      const loot = loser?.cagnotte ?? 0;
      return {
        ...p,
        cagnotte: p.cagnotte + loot,
        errors: 0, // on repart à vert
      };
    }
    return p;
  });
}

/** Enregistre une bonne réponse : +bonus cagnotte + correctCount. */
export function applyCorrectAnswer(
  players: DcPlayer[],
  playerId: string,
  bonus: number = DC_CORRECT_BONUS,
): DcPlayer[] {
  return players.map((p) =>
    p.id === playerId
      ? { ...p, cagnotte: p.cagnotte + bonus, correctCount: p.correctCount + 1 }
      : p,
  );
}

/** Enregistre une mauvaise réponse : +1 erreur et wrongCount. */
export function applyWrongAnswer(
  players: DcPlayer[],
  playerId: string,
): DcPlayer[] {
  return players.map((p) =>
    p.id === playerId
      ? { ...p, errors: p.errors + 1, wrongCount: p.wrongCount + 1 }
      : p,
  );
}

/** Remet à zéro les erreurs de tous les joueurs non éliminés (entre jeu 1 et jeu 2). */
export function resetErrorsForNewGame(players: DcPlayer[]): DcPlayer[] {
  return players.map((p) =>
    p.isEliminated ? p : { ...p, errors: 0 },
  );
}

/**
 * Détermine la phase suivante après un jeu en fonction du nombre de
 * survivants.
 *   - 2 survivants → face-à-face final
 *   - 3+ survivants après jeu 1 → jeu 2
 *   - 3+ survivants après jeu 2 → face-à-face (on force 2 derniers)
 *     NB : en théorie on ne sort du jeu 2 qu'à 2 survivants, mais on
 *     protège.
 */
export function nextPhaseAfter(
  currentPhase: "jeu1" | "jeu2",
  players: DcPlayer[],
): "jeu2" | "faceaface" | "results" {
  const alive = dcAliveCount(players);
  if (alive <= 1) return "results";
  if (alive === 2) return "faceaface";
  if (currentPhase === "jeu1") return "jeu2";
  return "faceaface";
}

/**
 * Construit l'ordre de podium final (vainqueur en premier).
 * Trié par (non-éliminé > éliminé) puis cagnotte décroissante.
 */
export function dcPodium(players: DcPlayer[]): DcPlayer[] {
  return [...players].sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) {
      return a.isEliminated ? 1 : -1;
    }
    return b.cagnotte - a.cagnotte;
  });
}
