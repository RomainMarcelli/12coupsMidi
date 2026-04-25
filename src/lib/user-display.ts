/**
 * Helpers d'affichage du nom d'utilisateur.
 *
 * Règle : on utilise UNIQUEMENT le pseudo défini en BDD. On ne retombe
 * jamais sur l'email — exposer une partie d'email dans une UI partagée
 * (setup multi-joueurs visible à l'écran) est intrusif.
 */

/** Renvoie le pseudo BDD, ou un fallback générique si non défini. */
export function resolveUserPseudo(
  pseudo: string | null | undefined,
  fallback = "Joueur",
): string {
  const p = pseudo?.trim();
  if (p) return p;
  return fallback;
}
