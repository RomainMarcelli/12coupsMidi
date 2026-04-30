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
    .replace(/[‘’`]/g, "'")
    .replace(/^(le |la |les |l'|un |une |des |the )/i, "")
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

const DEFAULT_THRESHOLD = 2;

/**
 * Détecte si une chaîne ressemble à une date / un repère temporel.
 * Pour ces réponses on REFUSE toute tolérance Levenshtein : "1972" vs
 * "1969" (distance 2) doit être strictement rejeté.
 *
 * Couvre :
 *  - année seule sur 4 chiffres entre 1000 et 2100 (ex: "1969")
 *  - siècle en chiffres romains : "XIXe", "XXe siècle"
 *  - siècle en chiffres arabes : "20e siècle", "20ème"
 *  - date complète : "12 mars 1789", "1789-03-12"
 */
export function isLikelyDate(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  // Année seule : 4 chiffres
  if (/^\d{4}$/.test(trimmed)) {
    const year = Number.parseInt(trimmed, 10);
    return year >= 1000 && year <= 2100;
  }
  // Siècle en romain (avec ou sans " siècle" derrière)
  if (/^[IVXLCDM]+\s*(?:e|er|eme|ème)?\s*(?:si[èe]cle)?$/i.test(trimmed)) {
    // Garde-fou : il faut au moins une lettre romaine valide
    return /[IVXLCDM]/i.test(trimmed);
  }
  // Siècle en chiffres arabes : "20e", "20e siècle", "20ème siècle"
  if (/^\d{1,2}\s*(?:e|er|eme|ème)\s*(?:si[èe]cle)?$/i.test(trimmed)) {
    return true;
  }
  // Date complète format "12 mars 1789" / "12 mars 1789"
  if (/\b\d{1,2}\s+\p{L}+\s+\d{4}\b/u.test(trimmed)) return true;
  // ISO "1789-03-12" ou "12/03/1789"
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(trimmed)) return true;
  if (/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/.test(trimmed)) return true;
  return false;
}

/**
 * Renvoie la distance de Levenshtein maximale autorisée pour une réponse
 * de longueur `len`. Barème dégressif :
 *  - len ≤ 4 : 0 (strict — années, sigles, mots très courts)
 *  - len ≤ 7 : 1 (ex: "Madrid", "Brésil")
 *  - sinon  : 2 (noms longs)
 *
 * Justification : une distance de 2 sur "1969" donne "1972" qui est
 * sémantiquement très différent. Plus la chaîne est courte, plus une
 * petite faute change le sens — donc on doit exiger l'exactitude.
 */
export function maxLevenshteinDistance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

/**
 * Renvoie `true` si `input` correspond à `correctAnswer` ou à l'un des
 * `aliases` après normalisation.
 *
 * Règles :
 *  - Si l'un des candidats ressemble à une date (année, siècle, date
 *    complète) → match STRICT pour tous les candidats : pas de tolérance.
 *  - Sinon, pour chaque candidat : égalité stricte, ou distance de
 *    Levenshtein ≤ `min(threshold, maxLevenshteinDistance(cand.length))`.
 *
 * Le `threshold` reste configurable (compat tests existants) mais ne
 * peut jamais dépasser le barème dégressif.
 */
export function isMatch(
  input: string,
  correctAnswer: string,
  aliases: readonly string[] = [],
  threshold = DEFAULT_THRESHOLD,
): boolean {
  const n = normalize(input);
  if (!n) return false;

  const rawCandidates = [correctAnswer, ...aliases];
  // Si N'IMPORTE QUEL candidat ressemble à une date, on bascule en mode strict
  // pour tous (évite qu'un alias non-date relâche la règle date).
  const strictDateMode = rawCandidates.some((c) => isLikelyDate(c));

  const candidates = rawCandidates.map(normalize).filter((c) => c.length > 0);

  for (const cand of candidates) {
    if (cand === n) return true;
    if (strictDateMode) continue; // dates : pas de Levenshtein
    const allowed = Math.min(threshold, maxLevenshteinDistance(cand.length));
    if (allowed === 0) continue;
    if (distance(n, cand) <= allowed) return true;
  }
  return false;
}

/**
 * Variante : renvoie aussi le candidat qui a matché (utile pour les logs).
 * Mêmes règles que `isMatch`.
 */
export function matchDetails(
  input: string,
  correctAnswer: string,
  aliases: readonly string[] = [],
  threshold = DEFAULT_THRESHOLD,
): { matched: true; on: string } | { matched: false } {
  const n = normalize(input);
  if (!n) return { matched: false };

  const rawCandidates = [correctAnswer, ...aliases];
  const strictDateMode = rawCandidates.some((c) => isLikelyDate(c));

  for (const cand of rawCandidates) {
    const nc = normalize(cand);
    if (!nc) continue;
    if (nc === n) return { matched: true, on: cand };
    if (strictDateMode) continue;
    const allowed = Math.min(threshold, maxLevenshteinDistance(nc.length));
    if (allowed === 0) continue;
    if (distance(n, nc) <= allowed) return { matched: true, on: cand };
  }
  return { matched: false };
}
