/**
 * Helpers d'affichage de la "bonne réponse" dans les écrans de feedback.
 *
 * Problème historique : pour les questions quizz_2 format "L'un ou l'autre"
 * (ou "Vrai/Faux", "Plus/Moins"), les `reponses[].text` sont des labels
 * génériques ("L'un", "L'autre", "Vrai", "Faux", ...) tels qu'ils ont
 * été seedés. L'écran de feedback affichait alors :
 *
 *   "Mauvaise réponse — La bonne réponse : L'autre"
 *
 * ...ce qui ne dit RIEN à l'utilisateur. La vraie info est dans
 * l'explication ("Werner Heisenberg formula en 1927 ...").
 *
 * Stratégie d'affichage (priorité décroissante) :
 *   1. Si `text` n'est PAS un label générique → on l'utilise tel quel
 *   2. Sinon, on tente d'extraire la 1re entité nommée de l'explication
 *      (ex: "Astana", "Werner Heisenberg", "Le traité de Verdun (843)")
 *   3. Sinon, fallback `null` → le composant feedback affichera
 *      l'explication entière en gras à la place.
 */

/** Tokens considérés comme "labels génériques" qui n'apportent pas l'info. */
const GENERIC_LABELS = new Set([
  "l'un",
  "l un",
  "l'autre",
  "l autre",
  "vrai",
  "faux",
  "plus",
  "moins",
  "+",
  "-",
  "oui",
  "non",
  "a",
  "b",
]);

/** True si le `text` est un label de choix générique (sans contenu propre). */
export function isGenericChoiceLabel(text: string | null | undefined): boolean {
  if (!text) return false;
  const norm = text.trim().toLowerCase().replace(/[‘’]/g, "'");
  return GENERIC_LABELS.has(norm);
}

/**
 * Extrait un libellé court "best guess" de la bonne réponse à partir du
 * début de l'explication. Heuristique :
 *   - Coupe au premier des séparateurs : virgule, parenthèse, point,
 *     tiret, " est ", " a été ", " était ", " : ", "depuis", " en ".
 *   - Cape à 60 caractères (garde-fou contre les explications sans
 *     ponctuation).
 *   - Retourne `null` si l'explication est vide ou trop courte (<3 chars).
 */
export function guessLabelFromExplanation(
  explication: string | null | undefined,
): string | null {
  if (!explication) return null;
  const cleaned = explication.trim();
  if (cleaned.length < 3) return null;

  // Premier séparateur fort (ponctuation ou conjonction explicative).
  // Note : on garde " ou " hors de la liste pour ne pas couper sur "L'un ou l'autre".
  // Note : " a " (auxiliaire avoir seul) est inclus pour couvrir les
  // explications type "Frank Gehry a conçu …" → on coupe juste après le
  // sujet pour garder un label propre.
  const SEP_REGEX =
    /[(,.;:!?]|\s+(?:est|était|a été|a|ont|fut|sont|étaient|depuis|en)\s+/i;
  const m = SEP_REGEX.exec(cleaned);
  let candidate = m ? cleaned.slice(0, m.index) : cleaned;
  candidate = candidate.trim();

  // Cap longueur (60 chars) — au-delà ce n'est plus un "label" lisible.
  if (candidate.length > 60) {
    candidate = candidate.slice(0, 60).trim();
    // Coupe sur le dernier espace pour éviter de couper un mot
    const lastSpace = candidate.lastIndexOf(" ");
    if (lastSpace > 20) candidate = candidate.slice(0, lastSpace);
    candidate += "…";
  }

  if (candidate.length < 3) return null;
  return candidate;
}

/**
 * Renvoie le meilleur libellé à afficher pour la "bonne réponse" :
 *  - Si `correctText` est informatif (non générique) → on le garde.
 *  - Sinon → on essaye d'extraire un libellé depuis l'explication.
 *  - Sinon → `null` (le composant doit alors masquer la ligne et
 *    afficher l'explication à la place).
 */
export function resolveCorrectAnswerLabel(
  correctText: string | null | undefined,
  explication: string | null | undefined,
): string | null {
  if (correctText && !isGenericChoiceLabel(correctText)) {
    return correctText;
  }
  return guessLabelFromExplanation(explication);
}
