/**
 * Raccourcis clavier par défaut de l'application (E4.1).
 *
 * Organisés par CONTEXTE (global, en jeu quizz, etc.). Chaque action a :
 *   - un id stable (utilisé en clé du JSONB profiles.keyboard_shortcuts)
 *   - un libellé humain pour l'UI Paramètres
 *   - une touche par défaut (au format `KeyboardEvent.key`, lowercase pour
 *     les lettres ; on tolère majuscules/minuscules à l'exécution).
 *
 * Le hook `useShortcuts` (use-shortcuts.ts) merge ces defaults avec les
 * customisations user pour produire la map effective.
 */

export type ShortcutContext =
  | "global"
  | "quiz"
  | "free-answer"
  | "face-a-face"
  | "fiches";

export interface ShortcutDefaultEntry {
  /** Identifiant stable, sert de clé dans la BDD. */
  id: string;
  /** Libellé affiché dans Paramètres. */
  label: string;
  /** Touche par défaut (KeyboardEvent.key). */
  defaultKey: string;
}

export const SHORTCUT_CONTEXTS: Record<
  ShortcutContext,
  { label: string; description: string; entries: ShortcutDefaultEntry[] }
> = {
  global: {
    label: "Global",
    description: "Disponibles partout dans l'application.",
    entries: [
      { id: "close-modal", label: "Fermer une fenêtre", defaultKey: "Escape" },
      { id: "help", label: "Afficher l'aide", defaultKey: "?" },
    ],
  },
  quiz: {
    label: "En jeu — Quizz à choix",
    description:
      "Pendant les questions à choix multiple (Coup d'Envoi, Coup par Coup, Duel, Apprentissage…).",
    entries: [
      { id: "answer-a", label: "Choix A (gauche)", defaultKey: "a" },
      { id: "answer-b", label: "Choix B (droite)", defaultKey: "b" },
      { id: "answer-1", label: "Choix 1", defaultKey: "1" },
      { id: "answer-2", label: "Choix 2", defaultKey: "2" },
      { id: "answer-3", label: "Choix 3", defaultKey: "3" },
      { id: "answer-4", label: "Choix 4", defaultKey: "4" },
      { id: "next", label: "Question suivante", defaultKey: "Enter" },
    ],
  },
  "free-answer": {
    label: "En jeu — Réponse libre",
    description:
      "Pendant les questions à réponse libre (Marathon libre, Face-à-Face).",
    entries: [
      { id: "validate", label: "Valider la réponse", defaultKey: "Enter" },
      {
        id: "next",
        label: "Question suivante (après feedback)",
        defaultKey: "Enter",
      },
    ],
  },
  "face-a-face": {
    label: "Face-à-Face",
    description: "Spécifiques au Face-à-Face final / dédié.",
    entries: [
      { id: "pass", label: "Passer", defaultKey: " " },
      { id: "pass-alt", label: "Passer (alt.)", defaultKey: "$" },
      { id: "pass-arrow", label: "Passer (flèche)", defaultKey: "ArrowRight" },
    ],
  },
  fiches: {
    label: "Fiches de révision",
    description: "Système d'étude carte par carte.",
    entries: [
      { id: "reveal", label: "Afficher la réponse", defaultKey: " " },
      { id: "reveal-alt", label: "Afficher (alt.)", defaultKey: "Enter" },
      { id: "self-eval-good", label: "J'ai bon", defaultKey: "b" },
      { id: "self-eval-good-alt", label: "J'ai bon (alt.)", defaultKey: "1" },
      { id: "self-eval-bad", label: "J'ai eu faux", defaultKey: "m" },
      { id: "self-eval-bad-alt", label: "J'ai eu faux (alt.)", defaultKey: "2" },
    ],
  },
};

/** Type de la map JSONB stockée en BDD : `{ [ctx]: { [actionId]: key } }`. */
export type ShortcutsMap = Partial<
  Record<ShortcutContext, Record<string, string>>
>;

/**
 * Reconstruit la map "effective" en mergeant les defaults avec les
 * customisations user. Si l'user n'a personnalisé aucun raccourci d'un
 * contexte, on retombe sur les defaults.
 */
export function mergeWithDefaults(custom: ShortcutsMap): ShortcutsMap {
  const out: ShortcutsMap = {};
  for (const ctxKey of Object.keys(SHORTCUT_CONTEXTS) as ShortcutContext[]) {
    const ctx = SHORTCUT_CONTEXTS[ctxKey];
    const userMap = custom[ctxKey] ?? {};
    const merged: Record<string, string> = {};
    for (const entry of ctx.entries) {
      merged[entry.id] = userMap[entry.id] ?? entry.defaultKey;
    }
    out[ctxKey] = merged;
  }
  return out;
}

/**
 * Récupère la touche effective pour une action (defaults + custom).
 * Si le contexte ou l'action sont inconnus, retourne null.
 */
export function getShortcutKey(
  effective: ShortcutsMap,
  ctx: ShortcutContext,
  actionId: string,
): string | null {
  return effective[ctx]?.[actionId] ?? null;
}

/**
 * Vérifie si une touche pressée correspond à un raccourci configuré.
 * Tolère la casse (lettre) et l'unicode minimal (` ` vs `Space`).
 */
export function isShortcutKey(pressed: string, configured: string): boolean {
  if (pressed === configured) return true;
  if (pressed.toLowerCase() === configured.toLowerCase()) return true;
  // Tolère " " (Space) et "Space"
  if (
    (pressed === " " && configured === "Space") ||
    (pressed === "Space" && configured === " ")
  )
    return true;
  return false;
}
