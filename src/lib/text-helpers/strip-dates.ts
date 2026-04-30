/**
 * H1.3 — Retire les parenthèses contenant uniquement une année (1000-2099)
 * d'une chaîne. Utilisé dans le mode Coup par Coup pour éviter que la
 * présence/absence d'une date trahisse l'intrus.
 *
 * Ne touche pas aux parenthèses contenant autre chose (ex: "Sciences
 * (Domaine: physique)" reste intact).
 *
 * Exemples :
 *   stripDatesFromText("Pierre Curie (1903)")        → "Pierre Curie"
 *   stripDatesFromText("Werner Heisenberg")          → "Werner Heisenberg"
 *   stripDatesFromText("Quelque chose (Domaine: x)") → "Quelque chose (Domaine: x)"
 *   stripDatesFromText("Foo (1969) bar (2024)")      → "Foo bar"
 */
const YEAR_PAREN_RE = /\s*\((1[0-9]{3}|20[0-9]{2})\)\s*/g;

export function stripDatesFromText(text: string): string {
  if (!text) return text;
  return text.replace(YEAR_PAREN_RE, " ").replace(/\s{2,}/g, " ").trim();
}
