/**
 * K2 — Détection / fusion des questions doublons.
 *
 * Helper pur de normalisation + signature pour comparer les questions
 * indépendamment des accents, casse et ponctuation. Utilisé à la fois
 * à l'import (`importQuestionsBulk`) et dans l'outil d'audit
 * (`/admin/questions/audit`).
 */

/**
 * Normalise une chaîne pour comparaison "fuzzy" :
 *   - lowercase
 *   - retire les accents (NFD + suppression des combining marks
 *     ̀-ͯ)
 *   - retire la ponctuation (garde uniquement [a-z0-9 _])
 *   - collapse les espaces
 *
 * Le but est qu'une apostrophe typographique vs droite, un accent
 * en plus / en moins, ou une virgule en trop ne fasse pas passer
 * deux questions équivalentes pour différentes.
 */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Signature canonique d'une question pour la détection de doublons.
 *
 * Stratégie :
 *   - Pour les types avec `bonne_reponse` (face_a_face, etoile,
 *     coup_maitre) : `enonce|categorie|bonne_reponse`. La même
 *     question dans 2 catégories différentes est considérée comme
 *     2 questions distinctes (peu probable mais permet de garder
 *     la séparation par domaine).
 *   - Pour les types sans `bonne_reponse` (quizz_2, quizz_4,
 *     coup_par_coup) : `enonce|categorie`. Suffisant car deux
 *     quizz_2 avec le même énoncé dans la même catégorie sont
 *     forcément des doublons (les choix peuvent varier mais le
 *     fond est identique).
 */
export interface QuestionSignatureInput {
  type: string;
  enonce: string;
  category_slug?: string | null;
  bonne_reponse?: string | null;
}

export function buildSignature(q: QuestionSignatureInput): string {
  const enonce = normalizeForComparison(q.enonce);
  const category = (q.category_slug ?? "").toLowerCase().trim();
  const hasBonneReponse =
    q.type === "face_a_face" ||
    q.type === "etoile" ||
    q.type === "coup_maitre";
  if (hasBonneReponse) {
    const reponse = normalizeForComparison(q.bonne_reponse ?? "");
    return `${category}|${enonce}|${reponse}`;
  }
  return `${category}|${enonce}`;
}

/**
 * Groupe d'éléments ayant la même signature. Le canonique est par
 * convention l'élément le plus ancien (premier inséré ou plus petit
 * `created_at`).
 */
export interface DuplicateGroup<T> {
  signature: string;
  canonical: T;
  duplicates: T[];
  /** Nombre total d'éléments dans le groupe (canonique + doublons). */
  count: number;
}

/**
 * Construit les groupes de doublons à partir d'une liste d'items
 * et d'une fonction qui calcule la signature. Le `canonical` est
 * choisi comme étant l'élément qui apparaît EN PREMIER dans la
 * liste — appelez-la donc déjà triée par `created_at ASC`.
 */
export function findDuplicateGroups<T>(
  items: T[],
  signOf: (item: T) => string,
): DuplicateGroup<T>[] {
  const bySig = new Map<string, T[]>();
  for (const item of items) {
    const sig = signOf(item);
    if (!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig)!.push(item);
  }
  const groups: DuplicateGroup<T>[] = [];
  for (const [signature, group] of bySig.entries()) {
    if (group.length < 2) continue;
    const [canonical, ...duplicates] = group as [T, ...T[]];
    groups.push({
      signature,
      canonical,
      duplicates,
      count: group.length,
    });
  }
  return groups;
}
