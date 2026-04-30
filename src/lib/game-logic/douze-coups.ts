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
/** Max d'erreurs par joueur dans le jeu courant avant déclenchement du duel. */
export const DC_MAX_ERRORS = 2;
/** Minimum de joueurs pour une partie. */
export const DC_MIN_PLAYERS = 2;
/** Maximum de joueurs pour une partie. */
export const DC_MAX_PLAYERS = 4;

/**
 * Couleurs assignées par slot (ordre d'entrée dans la partie).
 * Utilisées pour distinguer visuellement les joueurs (avatar, cadre, pseudo).
 */
export type DcPlayerColor = "gold" | "sky" | "buzz" | "life-green";
export const DC_PLAYER_COLORS: DcPlayerColor[] = [
  "gold",
  "sky",
  "buzz",
  "life-green",
];

export type DcGamePhase =
  | "setup"
  | "intro"
  | "jeu1"
  | "jeu2"
  /**
   * Sas de 20 s entre la 2e mauvaise réponse d'un joueur et le démarrage
   * effectif du duel. Pendant cette phase, le rendu Jeu 1 ou Jeu 2 reste
   * affiché (avec le feedback de la question ratée + l'explication) et un
   * encart overlay propose un bouton "Passer au duel" + countdown.
   * Toute interaction de jeu doit être gelée pendant cette phase.
   */
  | "transition_duel"
  | "duel"
  | "faceaface"
  | "results";

export type DcLifeState = "green" | "yellow" | "red";

export interface DcPlayer {
  id: string;
  pseudo: string;
  isBot: boolean;
  botLevel?: BotDifficulty;
  /**
   * Photo du joueur (humain seulement, optionnelle). URL publique
   * Supabase Storage typiquement, ou DiceBear pour l'avatar du compte
   * connecté. Null/absent = on affiche l'icône par défaut (Crown / Bot).
   */
  avatarUrl?: string | null;
  /** Couleur visuelle attribuée au slot (ne change pas en cours de partie). */
  color: DcPlayerColor;
  /** Cagnotte courante (€). Ne bouge que via duels / face-à-face final. */
  cagnotte: number;
  /** Erreurs accumulées dans le jeu courant (remis à 0 après duel gagné / passage au jeu suivant). */
  errors: number;
  isEliminated: boolean;
  /**
   * Horodatage `Date.now()` du moment où le joueur a été éliminé. Sert au
   * tri du classement final : ordre d'élimination inverse (le dernier
   * éliminé finit 2e, le premier éliminé finit dernier). `null` tant que
   * le joueur est en lice.
   */
  eliminatedAt: number | null;
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
 * Premier mot normalisé d'un nom de catégorie. Sert à éviter de tirer
 * deux catégories trop proches en duel (ex. "Histoire" + "Histoire
 * antique" → on rejette la 2ᵉ et on retente).
 */
function categoryRootKey(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s\-/]+/)[0]!
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Construit l'objet initial des 2 thèmes de duel d'une partie.
 * Retourne `null` si pas assez de catégories avec des quizz_4.
 *
 * I4.2 — Garantit la diversité : on évite de tirer 2 catégories
 * partageant le même 1ᵉʳ mot (heuristique simple qui matche
 * "Histoire / Histoire antique", "Cinéma / Cinéma français", etc.).
 * Si la contrainte n'est pas satisfiable (ex. pool entier partage le
 * même préfixe), on retombe sur 2 catégories quelconques pour ne pas
 * empêcher la partie de démarrer.
 */
export function makeInitialDuelThemes(
  categories: CategoryRow[],
  quizz4CountByCategory: Map<number, number>,
  rng: () => number = Math.random,
): DcDuelThemes | null {
  // On tire suffisamment large pour avoir des chances de trouver une
  // paire diverse — au pire on prend les 2 premières.
  const eligible = categories.filter(
    (c) => (quizz4CountByCategory.get(c.id) ?? 0) >= 1,
  );
  if (eligible.length < 2) return null;

  const picks = pickDuelCategories(
    eligible,
    quizz4CountByCategory,
    eligible.length,
    1,
    rng,
  );
  // picks est une permutation complète de eligible.
  const first = picks[0]!;
  const firstRoot = categoryRootKey(first.nom);
  // Cherche le 1ᵉʳ candidat suivant qui ne partage PAS le préfixe.
  let second = picks.slice(1).find((c) => categoryRootKey(c.nom) !== firstRoot);
  if (!second) {
    // Tout le pool partage le même 1ᵉʳ mot → fallback sur picks[1].
    second = picks[1];
  }
  if (!second) return null;
  return {
    theme1: first,
    theme2: second,
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
  /** Horodatage de l'élimination (utilisé par le tri du classement). */
  now: number = Date.now(),
): DcPlayer[] {
  const loserId = adversaryCorrect ? challengerId : challengedId;
  const winnerId = adversaryCorrect ? challengedId : challengerId;

  return players.map((p) => {
    if (p.id === loserId) {
      return {
        ...p,
        isEliminated: true,
        eliminatedAt: now,
        cagnotte: 0,
        errors: 0,
      };
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

/**
 * Enregistre une bonne réponse : +1 correctCount uniquement.
 * La cagnotte NE BOUGE PAS sur les bonnes réponses — elle ne se déplace
 * qu'au moment des duels et du face-à-face final.
 */
export function applyCorrectAnswer(
  players: DcPlayer[],
  playerId: string,
): DcPlayer[] {
  return players.map((p) =>
    p.id === playerId
      ? { ...p, correctCount: p.correctCount + 1 }
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
 * Construit l'ordre de podium final.
 *
 * Règle (validée user) : **uniquement l'ordre d'élimination inverse**.
 *  - Position 1 : le vainqueur (seul non éliminé en fin de partie)
 *  - Position 2 : dernier éliminé (perdant du face-à-face final)
 *  - Position 3 : avant-dernier éliminé
 *  - …
 *  - Position N : tout premier éliminé de la partie
 *
 * Le système de duel garantit qu'il y a toujours UN éliminé unique par
 * confrontation (pas de double-élimination simultanée), donc pas besoin
 * de gérer les égalités. Le nombre de bonnes réponses ou la cagnotte
 * sont des stats descriptives, pas des critères de tri.
 *
 * Fallback de compat : si `eliminatedAt` est manquant (vieux state ou
 * chemin de code qui aurait oublié de le poser), on dégrade vers la
 * cagnotte décroissante pour ne pas mélanger silencieusement l'ordre.
 */
export function dcPodium(players: DcPlayer[]): DcPlayer[] {
  return [...players].sort((a, b) => {
    // Non-éliminés (vainqueur) en tête
    if (!a.isEliminated && b.isEliminated) return -1;
    if (a.isEliminated && !b.isEliminated) return 1;

    // Entre éliminés : `eliminatedAt` le plus grand (le plus récent) en
    // premier → meilleure position dans le classement final.
    if (a.isEliminated && b.isEliminated) {
      const ta = a.eliminatedAt;
      const tb = b.eliminatedAt;
      if (ta != null && tb != null && ta !== tb) return tb - ta;
      // Fallback : cagnotte (descendante)
      return b.cagnotte - a.cagnotte;
    }

    // Cas théoriquement impossible : 2 non-éliminés en fin de partie
    return 0;
  });
}
