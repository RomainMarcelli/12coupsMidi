import type { BotDifficulty } from "./faceAFace";

/**
 * Types & helpers partagés pour la configuration multijoueur
 * (Coup d'Envoi, Coup par Coup, Duel).
 */

export type MultiMode = "vs_bots" | "vs_humans_local" | "vs_humans_online";

export interface PlayerConfig {
  pseudo: string;
  isBot: boolean;
  /** Identifiant local pour différencier plusieurs joueurs humains. */
  id: string;
  /**
   * Avatar du joueur (URL Storage typiquement). Optionnel : null/absent
   * → l'icône par défaut (Crown/Bot) est affichée. Sert pour l'écran
   * de fin de duel et autres écrans visuels.
   */
  avatarUrl?: string | null;
  /**
   * Cagnotte courante du joueur (€). Optionnelle pour ne pas casser les
   * call sites qui ne passent pas l'info. Utilisée pour afficher le
   * montant transféré sur l'écran de fin de duel.
   */
  cagnotte?: number;
}

export interface MultiConfig {
  mode: MultiMode;
  players: PlayerConfig[];
  /** Seulement défini si mode = vs_bots. */
  botDifficulty?: BotDifficulty;
  /** Respecte les règles officielles (max 4 joueurs). */
  isOfficialRules: boolean;
}

/**
 * Nombre de joueurs :
 *  - Règles officielles : 4 max (comme à la TV).
 *  - Mode libre : jusqu'à 8 pour rester jouable sur un téléphone.
 */
export const OFFICIAL_MAX_PLAYERS = 4;
export const FREE_MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;

/**
 * Valide une config et retourne une erreur human-readable si invalide.
 */
export function validateMultiConfig(config: MultiConfig): string | null {
  if (config.players.length < MIN_PLAYERS) {
    return `Il faut au moins ${MIN_PLAYERS} joueurs.`;
  }
  if (config.isOfficialRules && config.players.length > OFFICIAL_MAX_PLAYERS) {
    return `En règles officielles, maximum ${OFFICIAL_MAX_PLAYERS} joueurs.`;
  }
  if (config.players.length > FREE_MAX_PLAYERS) {
    return `Maximum ${FREE_MAX_PLAYERS} joueurs.`;
  }
  if (config.mode === "vs_bots" && !config.botDifficulty) {
    return "La difficulté du bot est requise en mode vs Bots.";
  }
  if (config.players.some((p) => !p.pseudo.trim())) {
    return "Tous les joueurs doivent avoir un pseudo.";
  }
  const pseudos = config.players.map((p) => p.pseudo.trim().toLowerCase());
  if (new Set(pseudos).size !== pseudos.length) {
    return "Les pseudos doivent être uniques.";
  }
  return null;
}

/**
 * Génère des noms de bots par défaut (« Bot 1 », « Bot 2 », …).
 */
export function defaultBotName(index: number, difficulty: BotDifficulty): string {
  const labels: Record<BotDifficulty, string> = {
    facile: "Bot débutant",
    moyen: "Bot joueur",
    difficile: "Bot champion",
  };
  return `${labels[difficulty]} ${index + 1}`;
}

/**
 * Calcule l'index du joueur suivant en rotation tour par tour.
 * Ignore les joueurs éliminés (si `eliminatedIds` fourni).
 */
export function nextActivePlayerIdx(
  currentIdx: number,
  players: PlayerConfig[],
  eliminatedIds: ReadonlySet<string> = new Set(),
): number {
  if (players.length === 0) return -1;
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const candidate = (currentIdx + step) % n;
    const player = players[candidate];
    if (player && !eliminatedIds.has(player.id)) return candidate;
  }
  // Tous éliminés (cas pathologique)
  return -1;
}

/**
 * Génère un id unique pour un joueur (crypto.randomUUID si dispo, fallback sinon).
 */
export function newPlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
