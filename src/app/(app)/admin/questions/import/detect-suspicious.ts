/**
 * G1.1 — Détecteur de questions suspectes pour l'import admin.
 *
 * Une question est dite "suspecte" quand sa `bonne_reponse` apparaît
 * textuellement dans son `enonce`. Signe probable d'un copier-coller
 * raté côté générateur de questions
 * (ex: "Combien de symphonies Beethoven a composées ?" →
 *  bonne_reponse = "Beethoven" au lieu de "9").
 *
 * Les fonctions tournent sur des objets BRUTS (pré-Zod) pour pouvoir
 * alerter l'admin même quand la validation stricte échoue par
 * ailleurs (ex: champ `categorie_id` mal nommé).
 */

/**
 * Normalise une chaîne pour comparaison tolérante :
 * minuscule + suppression des accents + suppression de la ponctuation.
 */
function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retourne `true` si l'objet `raw` ressemble à une question dont la
 * `bonne_reponse` est contenue dans l'`enonce`.
 *
 * Logique : on découpe `bonne_reponse` en tokens ≥ 3 caractères et on
 * vérifie qu'au moins un d'entre eux apparaît comme mot complet dans
 * `enonce` (avec espaces autour pour éviter les faux positifs sur
 * sous-chaînes — ex: "or" dans "alors").
 */
export function detectSuspiciousRawQuestion(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  const enonce = typeof obj.enonce === "string" ? obj.enonce : "";
  const bonneReponse =
    typeof obj.bonne_reponse === "string" ? obj.bonne_reponse : null;
  if (!bonneReponse || !enonce) return false;
  const enonceNorm = ` ${normalizeForCompare(enonce)} `;
  const tokens = normalizeForCompare(bonneReponse)
    .split(" ")
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.some((t) => enonceNorm.includes(` ${t} `));
}

export interface SuspiciousEntry {
  idx: number;
  type: string;
  enonce: string;
  bonneReponse: string;
}

/**
 * Extrait les entrées suspectes d'un tableau brut.
 * Tolère un input qui n'est pas un tableau (retourne []) — c'est
 * Zod qui se charge de signaler le mauvais format global.
 */
export function extractSuspiciousFromRaw(raw: unknown): SuspiciousEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SuspiciousEntry[] = [];
  raw.forEach((item, idx) => {
    if (!detectSuspiciousRawQuestion(item)) return;
    const obj = item as Record<string, unknown>;
    out.push({
      idx,
      type: typeof obj.type === "string" ? obj.type : "?",
      enonce: typeof obj.enonce === "string" ? obj.enonce : "",
      bonneReponse:
        typeof obj.bonne_reponse === "string" ? obj.bonne_reponse : "",
    });
  });
  return out;
}

/**
 * I2.3 — Détecte un format incohérent dans les propositions d'une
 * question Coup par Coup.
 *
 * Cas typique observé : "Films ayant remporté au moins 9 Oscars" avec
 * "Titanic (1997, 11 Oscars)", "Ben-Hur (1959, 11 Oscars)" et un
 * intrus "Le Parrain" sans parenthèses → l'intrus se reconnaît à
 * l'œil nu. On veut alerter l'admin pour qu'il harmonise (soit toutes
 * avec parenthèses, soit aucune).
 *
 * Retourne :
 *   • `null` si la question n'est pas concernée OU si le format est
 *     cohérent.
 *   • Un objet `{ withParens, withoutParens }` listant les textes
 *     concernés sinon.
 */
export interface InconsistentFormatReason {
  /** Propositions qui contiennent au moins un `(...)`. */
  withParens: string[];
  /** Propositions sans aucune parenthèse. */
  withoutParens: string[];
}

export function detectInconsistentFormat(
  raw: unknown,
): InconsistentFormatReason | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type !== "coup_par_coup") return null;
  const props = obj.propositions;
  if (!Array.isArray(props) || props.length < 2) return null;

  const withParens: string[] = [];
  const withoutParens: string[] = [];
  for (const p of props) {
    if (!p || typeof p !== "object") continue;
    const text = (p as Record<string, unknown>).text;
    if (typeof text !== "string") continue;
    if (/\([^)]+\)/.test(text)) withParens.push(text);
    else withoutParens.push(text);
  }
  // Format incohérent : un mix des deux.
  if (withParens.length > 0 && withoutParens.length > 0) {
    return { withParens, withoutParens };
  }
  return null;
}

export interface InconsistentFormatEntry {
  idx: number;
  enonce: string;
  withParens: string[];
  withoutParens: string[];
}

/** Extrait les questions à format incohérent depuis un tableau brut. */
export function extractInconsistentFormatFromRaw(
  raw: unknown,
): InconsistentFormatEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: InconsistentFormatEntry[] = [];
  raw.forEach((item, idx) => {
    const reason = detectInconsistentFormat(item);
    if (!reason) return;
    const obj = item as Record<string, unknown>;
    out.push({
      idx,
      enonce: typeof obj.enonce === "string" ? obj.enonce : "",
      withParens: reason.withParens,
      withoutParens: reason.withoutParens,
    });
  });
  return out;
}
