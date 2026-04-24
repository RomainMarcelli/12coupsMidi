import { distance } from "fastest-levenshtein";

/**
 * Normalise une chaîne pour comparaison tolérante :
 *  - minuscules
 *  - retrait des diacritiques (é → e, ç → c, …)
 *  - retrait des articles français en début ("le ", "la ", "les ", "l'", "un ", "une ")
 *  - espaces multiples → simples
 *  - trim
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/^(le |la |les |l'|un |une |des |the )/i, "")
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

const DEFAULT_THRESHOLD = 2;

/**
 * Renvoie `true` si `input` correspond à `correctAnswer` ou à l'un
 * des `aliases` après normalisation :
 *  - égalité stricte après normalisation
 *  - OU distance de Levenshtein ≤ `threshold` (défaut 2)
 *
 * Pour les saisies très courtes (≤ 3 caractères après normalisation),
 * on exige une égalité stricte pour éviter les faux positifs
 * (ex: "oui" vs "nui" = 1 char de Levenshtein mais sens opposé).
 */
export function isMatch(
  input: string,
  correctAnswer: string,
  aliases: readonly string[] = [],
  threshold = DEFAULT_THRESHOLD,
): boolean {
  const n = normalize(input);
  if (!n) return false;

  const candidates = [correctAnswer, ...aliases]
    .map(normalize)
    .filter((c) => c.length > 0);

  for (const cand of candidates) {
    if (cand === n) return true;
    // Pour les réponses très courtes, on n'accepte pas de faute
    if (cand.length <= 3 || n.length <= 3) continue;
    if (distance(n, cand) <= threshold) return true;
  }
  return false;
}

/**
 * Variante : renvoie aussi le candidat qui a matché (utile pour les logs).
 */
export function matchDetails(
  input: string,
  correctAnswer: string,
  aliases: readonly string[] = [],
  threshold = DEFAULT_THRESHOLD,
): { matched: true; on: string } | { matched: false } {
  const n = normalize(input);
  if (!n) return { matched: false };
  const candidates = [correctAnswer, ...aliases];
  for (const cand of candidates) {
    const nc = normalize(cand);
    if (!nc) continue;
    if (nc === n) return { matched: true, on: cand };
    if (nc.length > 3 && n.length > 3 && distance(n, nc) <= threshold) {
      return { matched: true, on: cand };
    }
  }
  return { matched: false };
}
