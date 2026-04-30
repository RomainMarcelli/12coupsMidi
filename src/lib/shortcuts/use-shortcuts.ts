"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isShortcutKey,
  mergeWithDefaults,
  SHORTCUT_CONTEXTS,
  type ShortcutContext,
  type ShortcutsMap,
} from "./defaults";
import { fetchShortcuts } from "./actions";

const LS_CACHE_KEY = "mahylan-shortcuts-cache-v1";

/**
 * Hook qui charge la map des raccourcis personnalisés du user (depuis
 * `profiles.keyboard_shortcuts`) puis la merge avec les defaults.
 *
 * - Au mount : tente d'abord le cache localStorage (synchrone, instantané),
 *   puis fetch BDD en async pour invalider le cache si nécessaire.
 * - Si pas connecté ou pas de personnalisation → defaults uniquement.
 *
 * Utilisé en interne par `useShortcut(...)` ; le composant Paramètres
 * en utilise aussi `mutate()` pour rafraîchir après save.
 */
export function useShortcutsMap(): ShortcutsMap {
  const [map, setMap] = useState<ShortcutsMap>(() => {
    if (typeof window === "undefined") return mergeWithDefaults({});
    try {
      const cached = window.localStorage.getItem(LS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ShortcutsMap;
        return mergeWithDefaults(parsed);
      }
    } catch {
      // localStorage corrompu → ignore
    }
    return mergeWithDefaults({});
  });

  useEffect(() => {
    let alive = true;
    void fetchShortcuts().then((custom) => {
      if (!alive) return;
      try {
        window.localStorage.setItem(LS_CACHE_KEY, JSON.stringify(custom));
      } catch {
        // Quota exceeded ou private browsing : on ignore
      }
      setMap(mergeWithDefaults(custom));
    });
    return () => {
      alive = false;
    };
  }, []);

  return map;
}

/**
 * Hook ergonomique : enregistre un handler global pour une action donnée
 * dans un contexte donné. Le hook ignore automatiquement :
 *   - Les keydown auto-repeat
 *   - Les keydown quand le focus est dans un INPUT/TEXTAREA (sauf si
 *     `allowInInput=true`)
 *
 * Exemple :
 *   useShortcut("fiches", "reveal", () => setRevealed(true), [setRevealed]);
 *
 * NB : les `deps` sont passées au useEffect interne pour bien
 * resynchroniser le handler quand il capture des states.
 */
export function useShortcut(
  context: ShortcutContext,
  actionId: string,
  handler: (e: KeyboardEvent) => void,
  options: { enabled?: boolean; allowInInput?: boolean } = {},
): void {
  const { enabled = true, allowInInput = false } = options;
  const map = useShortcutsMap();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const configured = map[context]?.[actionId];
    if (!configured) return;

    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (!allowInInput) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      if (!isShortcutKey(e.key, configured!)) return;
      handlerRef.current(e);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, allowInInput, map, context, actionId]);
}

/**
 * Petit utilitaire pour rendre une touche lisible dans l'UI Paramètres.
 * "Enter" → "Entrée", " " → "Espace", "ArrowRight" → "→", "a" → "A".
 */
export function formatKeyLabel(key: string): string {
  if (!key) return "—";
  if (key === " " || key.toLowerCase() === "space") return "Espace";
  if (key === "Enter") return "Entrée";
  if (key === "Escape") return "Échap";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** Liste des contextes pour itération externe (UI Paramètres). */
export const ALL_CONTEXTS = Object.keys(SHORTCUT_CONTEXTS) as ShortcutContext[];

/**
 * Détecte un conflit dans une map à updater (deux actions du MÊME contexte
 * partageant la même touche). Retourne l'id de l'action en conflit, ou
 * null si pas de conflit.
 */
export function findConflict(
  map: ShortcutsMap,
  context: ShortcutContext,
  actionId: string,
  newKey: string,
): string | null {
  const ctxMap = map[context];
  if (!ctxMap) return null;
  for (const [otherId, otherKey] of Object.entries(ctxMap)) {
    if (otherId === actionId) continue;
    if (isShortcutKey(newKey, otherKey)) return otherId;
  }
  return null;
}
