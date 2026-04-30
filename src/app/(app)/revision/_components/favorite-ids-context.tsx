"use client";

import { createContext, useContext } from "react";

/**
 * I1.5 — Contexte qui transporte le Set des IDs favoris jusqu'aux
 * QuizPlayer enfants, peu importe le mode (Marathon, Refaire, Apprendre,
 * Favoris…). Utilisé pour afficher l'étoile remplie sur les questions
 * déjà favorites — cohérence dans toute l'app.
 *
 * Le Set est rempli côté serveur dans `revision/page.tsx` puis transmis
 * au RevisionClient qui pose le Provider racine.
 *
 * Fichier séparé (et pas dans revision-client.tsx) pour éviter une
 * dépendance circulaire : QuizPlayer.tsx est importé par revision-client.
 */
export const FavoriteIdsContext = createContext<ReadonlySet<string>>(new Set());

export function useFavoriteIds(): ReadonlySet<string> {
  return useContext(FavoriteIdsContext);
}
