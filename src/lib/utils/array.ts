/**
 * Mélange Fisher-Yates classique (in-place sur copie). Sans seed →
 * utilise Math.random, donc résultat différent à chaque appel.
 *
 * Édge cases :
 *   - tableau vide  → tableau vide
 *   - 1 élément     → tableau d'1 élément (pas d'erreur, pas de modif)
 *   - tous présents → garanti par construction (permutation pure)
 *
 * Note : c'est volontairement séparé du `shuffleArray` interne du
 * fichier `revision/actions.ts` qui prend un seed déterministe (utile
 * pour le défi du jour). Ici on veut un shuffle non-reproducible.
 */
export function shuffle<T>(arr: ReadonlyArray<T>): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
