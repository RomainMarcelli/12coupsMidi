/**
 * J1.5 — Mémoire courte terme des IDs vus en Marathon.
 *
 * Stocke en localStorage les `questionId` des N dernières sessions
 * Marathon (par défaut 5 sessions). Au démarrage de Marathon, on
 * passe ces IDs en `excludeQuestionIds` pour réduire les répétitions
 * à court terme.
 *
 * Ring buffer à plat (Array<string>), capé à `MAX_RECENT_IDS` pour
 * éviter une croissance infinie.
 */

const KEY = "mm-marathon-recent-ids-v1";
const MAX_RECENT_IDS = 250; // ≈ 5 sessions × 50 questions

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readRecentIds(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

export function pushRecentIds(newIds: string[]): void {
  if (!isBrowser()) return;
  if (newIds.length === 0) return;
  try {
    const existing = readRecentIds();
    // On préfixe les nouveaux IDs (les plus récents en tête), puis on
    // tronque à MAX_RECENT_IDS. Les IDs en double sont supprimés
    // (Set garde l'ordre d'insertion → première occurrence gagne).
    const merged = Array.from(new Set([...newIds, ...existing])).slice(
      0,
      MAX_RECENT_IDS,
    );
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // localStorage plein / désactivé → on perd la mémoire courte terme
    // sans gravité.
  }
}

/** Vide le buffer (utile pour debug ou réinitialisation utilisateur). */
export function clearRecentIds(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
