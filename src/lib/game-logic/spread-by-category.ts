/**
 * Anti-répétition de catégorie (F1.3).
 *
 * Réordonne un tableau de questions de manière à garantir qu'une même
 * catégorie n'apparaît pas dans une fenêtre glissante de `minGap`
 * positions consécutives (par défaut : 3).
 *
 * Règle :
 *   - Si question N°5 est de catégorie X, alors les questions 6, 7, 8
 *     ne doivent PAS être de catégorie X. La N°9 peut l'être.
 *
 * Algorithme : glouton à 2 phases.
 *   1. À chaque étape, on choisit une question dont la catégorie n'est
 *      PAS dans les `minGap` dernières positions.
 *   2. Si plusieurs candidats valides, on prend celui dont la catégorie
 *      a été vue le moins récemment (pour étaler au max).
 *   3. Si aucun candidat respecte la règle (cas dégénéré : pool trop
 *      petit), on prend celui dont la catégorie a été vue le plus tôt
 *      possible (le moins pire).
 *
 * Tolérance :
 *   - Si toutes les questions partagent la même catégorie, on retourne
 *     l'ordre original (impossible de respecter, et l'appelant le sait
 *     généralement déjà).
 *   - Si le pool a < 2 catégories distinctes, idem.
 *   - Si `questions.length <= minGap`, on essaie quand même mais on ne
 *     casse pas si on n'arrive pas (pool insuffisant).
 *
 * Note : cette fonction est PURE. Elle ne mute pas l'entrée, retourne
 * un nouveau tableau.
 */

interface Categorizable {
  /**
   * Identifiant de catégorie. `null` est traité comme une catégorie
   * « sans nom » distincte de toute autre — donc deux items avec
   * `category_id = null` consécutifs SONT considérés comme un doublon.
   */
  category_id: number | null;
}

export function spreadByCategory<T extends Categorizable>(
  questions: ReadonlyArray<T>,
  minGap: number = 3,
): T[] {
  if (questions.length === 0) return [];
  if (minGap < 1) return [...questions];

  // Compte le nombre de catégories distinctes. Si < 2 → on peut pas
  // espacer, on retourne l'ordre original.
  const distinctCats = new Set(questions.map((q) => q.category_id));
  if (distinctCats.size < 2) return [...questions];

  // Pool des indices restants à placer
  const remaining = new Set<number>();
  for (let i = 0; i < questions.length; i++) remaining.add(i);

  const result: T[] = [];
  // Pour chaque catégorie, on retient la position de sa dernière
  // utilisation dans `result`. -Infinity = jamais vue.
  const lastUseByCat = new Map<number | null, number>();

  while (remaining.size > 0) {
    const currentPos = result.length;
    let bestIdx: number | null = null;
    let bestLastUse: number = Number.POSITIVE_INFINITY;
    // Pass 1 : chercher un candidat « valide » (gap respecté) avec la
    // catégorie la moins récemment vue.
    for (const idx of remaining) {
      const q = questions[idx]!;
      const lastUse = lastUseByCat.get(q.category_id) ?? Number.NEGATIVE_INFINITY;
      // « Valide » si la dernière apparition est ≤ currentPos - minGap
      // OU jamais vue. Equivalent : currentPos - lastUse >= minGap.
      const gap = currentPos - lastUse;
      if (gap >= minGap && lastUse < bestLastUse) {
        bestIdx = idx;
        bestLastUse = lastUse;
      }
    }
    // Pass 2 : si aucun candidat valide, prendre celui vu le plus tôt
    // (le moins pire). Cas dégénéré : pool trop petit.
    if (bestIdx === null) {
      for (const idx of remaining) {
        const q = questions[idx]!;
        const lastUse = lastUseByCat.get(q.category_id) ?? Number.NEGATIVE_INFINITY;
        if (lastUse < bestLastUse) {
          bestIdx = idx;
          bestLastUse = lastUse;
        }
      }
    }
    // Sécurité : ne devrait jamais arriver puisque remaining > 0
    if (bestIdx === null) break;
    const chosen = questions[bestIdx]!;
    result.push(chosen);
    lastUseByCat.set(chosen.category_id, currentPos);
    remaining.delete(bestIdx);
  }

  return result;
}

/**
 * Variante générique qui accepte n'importe quel type de clé pour la
 * catégorie (string, number, null, undefined). Utile quand on n'a pas
 * de `category_id` direct mais juste un nom (ex: CeQuestion qui a
 * `category.nom` mais pas l'id).
 */
export function spreadByCategoryWithGetter<T, K>(
  questions: ReadonlyArray<T>,
  getCategoryKey: (q: T) => K,
  minGap: number = 3,
): T[] {
  if (questions.length === 0) return [];
  if (minGap < 1) return [...questions];

  // Compte les catégories distinctes
  const distinctCats = new Set<K>();
  for (const q of questions) distinctCats.add(getCategoryKey(q));
  if (distinctCats.size < 2) return [...questions];

  const remaining = new Set<number>();
  for (let i = 0; i < questions.length; i++) remaining.add(i);

  const result: T[] = [];
  const lastUseByCat = new Map<K, number>();

  while (remaining.size > 0) {
    const currentPos = result.length;
    let bestIdx: number | null = null;
    let bestLastUse: number = Number.POSITIVE_INFINITY;

    // Pass 1 : candidats valides (gap respecté)
    for (const idx of remaining) {
      const key = getCategoryKey(questions[idx]!);
      const lastUse = lastUseByCat.get(key) ?? Number.NEGATIVE_INFINITY;
      const gap = currentPos - lastUse;
      if (gap >= minGap && lastUse < bestLastUse) {
        bestIdx = idx;
        bestLastUse = lastUse;
      }
    }

    // Pass 2 : fallback (catégorie la moins récemment vue)
    if (bestIdx === null) {
      for (const idx of remaining) {
        const key = getCategoryKey(questions[idx]!);
        const lastUse = lastUseByCat.get(key) ?? Number.NEGATIVE_INFINITY;
        if (lastUse < bestLastUse) {
          bestIdx = idx;
          bestLastUse = lastUse;
        }
      }
    }

    if (bestIdx === null) break;
    const chosen = questions[bestIdx]!;
    result.push(chosen);
    lastUseByCat.set(getCategoryKey(chosen), currentPos);
    remaining.delete(bestIdx);
  }

  return result;
}
