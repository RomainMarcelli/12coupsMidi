/**
 * L+ — Logger silencieux en production.
 *
 * Sert à logger des infos potentiellement sensibles (userId, payload,
 * détails serveur) sans risquer de leak en prod via les logs Vercel.
 *
 * Usage :
 *   import { devLog, devError } from "@/lib/dev-log";
 *   devLog("[defi:server] start", { userId, date });
 *   devError("[defi:server] insert failed", error);
 *
 * En dev (NODE_ENV=development) → délègue à console.log/error.
 * En prod (NODE_ENV=production) → no-op total.
 *
 * Pour les vraies erreurs critiques qu'on veut voir en prod, utiliser
 * `console.error` direct (à pondérer selon le contenu).
 */

const isDev = process.env.NODE_ENV === "development";

export function devLog(...args: unknown[]): void {
  if (isDev) console.log(...args);
}

export function devError(...args: unknown[]): void {
  if (isDev) console.error(...args);
}

export function devWarn(...args: unknown[]): void {
  if (isDev) console.warn(...args);
}
