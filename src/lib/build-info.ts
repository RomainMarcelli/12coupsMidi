/**
 * L1.1 — Build version string.
 *
 * Injecté au build via `next.config.ts` (cf clé `env`). Format
 * ISO-like compact : `YYYY-MM-DD-HH-mm-ss` UTC. Affiché en bas
 * de Navbar (très discret, opacity-30) — utile pour confirmer
 * qu'on tourne bien sur la dernière build après un refresh
 * (en cas de Service Worker récalcitrant).
 *
 * Note : `process.env.NEXT_PUBLIC_*` est statiquement remplacé
 * au build → la valeur est gelée dans le bundle, pas re-évaluée
 * à runtime côté client.
 */
export const BUILD_VERSION =
  process.env.NEXT_PUBLIC_BUILD_VERSION ?? "unknown";
