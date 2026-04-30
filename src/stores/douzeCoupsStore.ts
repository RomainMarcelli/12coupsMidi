"use client";

import { create } from "zustand";
import type { BotDifficulty } from "@/lib/game-logic/faceAFace";
import {
  DC_PLAYER_COLORS,
  DC_STARTING_CAGNOTTE,
  applyCorrectAnswer,
  applyDuelResult,
  applyWrongAnswer,
  availableDuelThemes,
  consumeDuelTheme,
  dcAliveCount,
  dcNextActiveIdx,
  dcShouldTriggerDuel,
  makeInitialDuelThemes,
  nextPhaseAfter,
  resetErrorsForNewGame,
  type DcDuelThemes,
  type DcGamePhase,
  type DcPendingDuel,
  type DcPlayer,
} from "@/lib/game-logic/douze-coups";
import type { Database } from "@/types/database";

type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "slug" | "couleur"
>;

export interface DcSetupInput {
  players: Array<{
    pseudo: string;
    isBot: boolean;
    botLevel?: BotDifficulty;
    avatarUrl?: string | null;
  }>;
  categories: CategoryRow[];
  quizz4CountByCategory: Map<number, number>;
}

interface DouzeCoupsState {
  // Config + progression
  phase: DcGamePhase;
  players: DcPlayer[];
  currentPlayerIdx: number;
  duelThemes: DcDuelThemes | null;
  pendingDuel: DcPendingDuel | null;
  startedAt: number;

  // Actions de setup
  initParty: (input: DcSetupInput) => { ok: boolean; error?: string };
  startIntro: () => void;
  startJeu1: () => void;

  // Actions de jeu (Jeu 1 & Jeu 2)
  recordCorrect: (playerId: string) => void;
  recordWrong: (playerId: string, returnPhase: "jeu1" | "jeu2") => void;
  nextPlayer: () => void;

  // Duel
  /**
   * Sort de la phase `transition_duel` (sas 20 s après la 2e erreur) pour
   * démarrer effectivement le duel. Idempotent : ne fait rien si la phase
   * courante n'est pas `transition_duel`.
   */
  startDuelPhase: () => void;
  designateAdversary: (challengedId: string) => void;
  resolveDuel: (adversaryCorrect: boolean, chosenCategoryId: number) => void;

  // Transitions
  advanceToJeu2: () => void;
  advanceToFaceAFace: () => void;
  /** Safety net : garantit que les survivants entrent en Jeu 2 avec 0 erreur. */
  forceResetErrorsJeu2: () => void;
  finalizeFaceAFace: (winnerId: string, loserId: string) => void;
  finishGame: () => void;

  // Reset
  reset: () => void;
}

const INITIAL_STATE = {
  phase: "setup" as DcGamePhase,
  players: [] as DcPlayer[],
  currentPlayerIdx: 0,
  duelThemes: null as DcDuelThemes | null,
  pendingDuel: null as DcPendingDuel | null,
  startedAt: 0,
};

function generatePlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useDouzeCoupsStore = create<DouzeCoupsState>((set, get) => ({
  ...INITIAL_STATE,

  initParty: (input) => {
    if (input.players.length < 2) {
      return { ok: false, error: "Il faut au moins 2 joueurs." };
    }
    if (input.players.length > 4) {
      return { ok: false, error: "Maximum 4 joueurs." };
    }
    const duelThemes = makeInitialDuelThemes(
      input.categories,
      input.quizz4CountByCategory,
    );
    if (!duelThemes) {
      return {
        ok: false,
        error:
          "Pas assez de catégories avec questions quizz_4 pour les thèmes de duel.",
      };
    }

    const players: DcPlayer[] = input.players.map((p, idx) => ({
      id: generatePlayerId(),
      pseudo: p.pseudo.trim(),
      isBot: p.isBot,
      botLevel: p.botLevel,
      avatarUrl: p.avatarUrl ?? null,
      color: DC_PLAYER_COLORS[idx % DC_PLAYER_COLORS.length]!,
      cagnotte: DC_STARTING_CAGNOTTE,
      errors: 0,
      isEliminated: false,
      eliminatedAt: null,
      correctCount: 0,
      wrongCount: 0,
    }));

    set({
      ...INITIAL_STATE,
      players,
      duelThemes,
      phase: "setup",
    });
    return { ok: true };
  },

  startIntro: () => set({ phase: "intro" }),

  startJeu1: () =>
    set({
      phase: "jeu1",
      currentPlayerIdx: 0,
      startedAt: Date.now(),
    }),

  recordCorrect: (playerId) => {
    set((s) => ({
      players: applyCorrectAnswer(s.players, playerId),
    }));
  },

  recordWrong: (playerId, returnPhase) => {
    const state = get();
    const updated = applyWrongAnswer(state.players, playerId);
    const target = updated.find((p) => p.id === playerId);
    if (!target) return;

    if (dcShouldTriggerDuel(target.errors)) {
      // Bascule en phase transition_duel : on garde le rendu Jeu 1/Jeu 2
      // affiché avec le feedback de la question ratée pendant 20 s
      // (lecture de la bonne réponse + explication) avant de basculer
      // dans le duel proprement dit via `startDuelPhase()`.
      set({
        players: updated,
        phase: "transition_duel",
        pendingDuel: {
          challengerId: playerId,
          challengedId: null,
          returnPhase,
        },
      });
    } else {
      set({ players: updated });
    }
  },

  nextPlayer: () => {
    set((s) => ({
      currentPlayerIdx: dcNextActiveIdx(s.currentPlayerIdx, s.players),
    }));
  },

  startDuelPhase: () => {
    const state = get();
    if (state.phase !== "transition_duel") return;
    set({ phase: "duel" });
  },

  designateAdversary: (challengedId) => {
    set((s) =>
      s.pendingDuel
        ? { pendingDuel: { ...s.pendingDuel, challengedId } }
        : {},
    );
  },

  resolveDuel: (adversaryCorrect, chosenCategoryId) => {
    const state = get();
    const pending = state.pendingDuel;
    if (!pending || !pending.challengedId || !state.duelThemes) return;

    // Applique le résultat du duel (élimination + transfert cagnotte + reset erreurs)
    const afterDuel = applyDuelResult(
      state.players,
      pending.challengerId,
      pending.challengedId,
      adversaryCorrect,
    );

    // Consomme le thème utilisé. Si les 2 sont consommés, le composant
    // déclenchera un re-tirage au prochain duel.
    const newThemes = consumeDuelTheme(state.duelThemes, chosenCategoryId);

    const alive = dcAliveCount(afterDuel);

    // Règle : un duel produit toujours un éliminé, donc on passe TOUJOURS au
    // jeu suivant. Jeu1 → Jeu2 (ou face-à-face si ≤ 2 alive). Jeu2 → FaceAFace.
    let nextPhase: DcGamePhase;
    if (alive <= 1) {
      nextPhase = "results";
    } else if (alive === 2) {
      nextPhase = "faceaface";
    } else if (pending.returnPhase === "jeu1") {
      nextPhase = "jeu2";
    } else {
      nextPhase = "faceaface";
    }

    // Reset les erreurs de tous les non-éliminés pour le prochain jeu
    const updated = resetErrorsForNewGame(afterDuel);

    // Repositionne l'index de tour sur le premier survivant si le courant
    // est éliminé.
    let newIdx = state.currentPlayerIdx;
    const currentStill = updated[newIdx];
    if (!currentStill || currentStill.isEliminated) {
      newIdx = dcNextActiveIdx(newIdx, updated);
    }

    set({
      players: updated,
      duelThemes: newThemes,
      pendingDuel: null,
      phase: nextPhase,
      currentPlayerIdx: newIdx,
    });
  },

  advanceToJeu2: () => {
    set((s) => {
      const alive = dcAliveCount(s.players);
      if (alive <= 2) {
        return { phase: "faceaface", players: resetErrorsForNewGame(s.players) };
      }
      return {
        phase: "jeu2",
        players: resetErrorsForNewGame(s.players),
        currentPlayerIdx: dcNextActiveIdx(-1, s.players),
      };
    });
  },

  advanceToFaceAFace: () => {
    set((s) => ({
      phase: "faceaface",
      players: resetErrorsForNewGame(s.players),
    }));
  },

  forceResetErrorsJeu2: () => {
    set((s) => {
      const needsReset = s.players.some(
        (p) => !p.isEliminated && p.errors > 0,
      );
      if (!needsReset) return {};
      if (typeof console !== "undefined") {
        console.debug("[douze-coups] forceResetErrorsJeu2 corrige un état incohérent");
      }
      return { players: resetErrorsForNewGame(s.players) };
    });
  },

  finalizeFaceAFace: (winnerId, loserId) => {
    set((s) => {
      const loser = s.players.find((p) => p.id === loserId);
      const loot = loser?.cagnotte ?? 0;
      const now = Date.now();
      const updated = s.players.map((p) => {
        if (p.id === loserId) {
          // Le perdant du face-à-face final est par construction le
          // DERNIER éliminé de la partie → finit 2e du classement.
          return { ...p, isEliminated: true, eliminatedAt: now, cagnotte: 0 };
        }
        if (p.id === winnerId) {
          return { ...p, cagnotte: p.cagnotte + loot };
        }
        return p;
      });
      return { players: updated, phase: "results" as DcGamePhase };
    });
  },

  finishGame: () => set({ phase: "results" }),

  reset: () => set({ ...INITIAL_STATE }),
}));

// Helpers pour composants
export function selectAlivePlayers(state: DouzeCoupsState): DcPlayer[] {
  return state.players.filter((p) => !p.isEliminated);
}

export function selectCurrentPlayer(
  state: DouzeCoupsState,
): DcPlayer | undefined {
  return state.players[state.currentPlayerIdx];
}

// Re-export pour convenance
export { availableDuelThemes, nextPhaseAfter };
