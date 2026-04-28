"use client";

import { createContext, useContext } from "react";

/**
 * J1.2 — Contexte qui centralise la file des questions correctement
 * répondues en mode "Refaire mes erreurs", en attente de DELETE BDD.
 *
 * Avant : la file vivait localement dans QuizPlayer. Conséquence : le
 * bouton "Retour aux modes" (en dehors de QuizPlayer) ne pouvait pas
 * déclencher le flush → l'utilisateur perdait ses bonnes réponses non
 * validées par "Suivant".
 *
 * Maintenant : la file vit au niveau du `RevisionClient` parent.
 * QuizPlayer pousse via `addPending`, et le bouton "Retour aux modes"
 * appelle `flush()` avant la navigation.
 */
export interface ReviewBatcherValue {
  /** Ajoute un questionId à la file (ne touche pas la BDD). */
  addPending: (questionId: string) => void;
  /** DELETE batch côté serveur via server action (asynchrone). */
  flush: () => void;
  /**
   * DELETE batch via `navigator.sendBeacon` (best-effort, utilisé
   * dans `beforeunload` / `pagehide` / `visibilitychange:hidden`).
   * Les server actions ne fonctionnent pas dans ces handlers.
   */
  flushViaBeacon: () => void;
}

const NOOP: ReviewBatcherValue = {
  addPending: () => undefined,
  flush: () => undefined,
  flushViaBeacon: () => undefined,
};

export const ReviewBatcherContext = createContext<ReviewBatcherValue>(NOOP);

export function useReviewBatcher(): ReviewBatcherValue {
  return useContext(ReviewBatcherContext);
}
