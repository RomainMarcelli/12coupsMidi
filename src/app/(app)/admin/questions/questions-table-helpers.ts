import type { Json, QuestionType } from "@/types/database";

/**
 * N2.1 — Helper pur pour la table admin : retourne le texte de la
 * "bonne réponse" affichable dans la colonne dédiée, selon le type
 * de question.
 *
 * Règles :
 *   - face_a_face / etoile / coup_maitre  → `bonne_reponse` direct
 *   - quizz_2 / quizz_4                    → texte de la réponse `correct: true`
 *   - coup_par_coup                        → "Intrus : <texte>" (la
 *     réponse `correct: false` parmi les 7 — c'est l'intrus à éviter)
 *
 * Si l'info est manquante (data corrompue, type inconnu) → "—".
 *
 * Extrait dans son propre fichier pour permettre des tests unitaires
 * sans dépendre de React (cf. `questions-table-helpers.test.ts`).
 */

interface ResponseLike {
  text: string;
  correct: boolean;
}

export interface DisplayedAnswerInput {
  type: QuestionType;
  bonne_reponse: string | null;
  reponses: Json | null;
}

const PLACEHOLDER = "—";

export function getDisplayedAnswer(q: DisplayedAnswerInput): string {
  switch (q.type) {
    case "face_a_face":
    case "etoile":
    case "coup_maitre": {
      const ans = q.bonne_reponse?.trim();
      return ans && ans.length > 0 ? ans : PLACEHOLDER;
    }
    case "quizz_2":
    case "quizz_4": {
      const reponses = parseReponses(q.reponses);
      const correct = reponses.find((r) => r.correct === true);
      return correct?.text?.trim() || PLACEHOLDER;
    }
    case "coup_par_coup": {
      const reponses = parseReponses(q.reponses);
      const intrus = reponses.find((r) => r.correct === false);
      const t = intrus?.text?.trim();
      return t ? `Intrus : ${t}` : PLACEHOLDER;
    }
    default:
      return PLACEHOLDER;
  }
}

function parseReponses(raw: Json | null): ResponseLike[] {
  if (!Array.isArray(raw)) return [];
  const out: ResponseLike[] = [];
  for (const r of raw) {
    if (
      typeof r === "object" &&
      r !== null &&
      !Array.isArray(r) &&
      typeof (r as { text?: unknown }).text === "string" &&
      typeof (r as { correct?: unknown }).correct === "boolean"
    ) {
      out.push({
        text: (r as { text: string }).text,
        correct: (r as { correct: boolean }).correct,
      });
    }
  }
  return out;
}

/**
 * Tronque une chaîne pour affichage en cellule, garde le texte
 * complet en `title` HTML (tooltip natif).
 */
export function truncate(s: string, max = 60): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
