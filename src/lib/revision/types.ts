/**
 * Types partagés entre les différents sous-modes de révision.
 * Une `RevQuestion` est la version normalisée d'une ligne `questions` BDD,
 * avec tout ce dont les composants ont besoin pour rejouer/afficher.
 */

import type { QuestionType } from "@/types/database";

export interface RevQuestion {
  questionId: string;
  type: QuestionType;
  enonce: string;
  /** Pour quizz_2 / quizz_4 : tableau {text, correct}. Vide pour les autres. */
  reponses: { text: string; correct: boolean }[];
  /** Pour face_a_face / coup_par_coup / etoile / coup_maitre : la bonne réponse texte. */
  bonneReponse: string;
  alias: string[];
  explication: string | null;
  category: { id: number; nom: string; couleur: string | null } | null;
  difficulte: number;
}

export interface RevisionFilters {
  /** Liste d'IDs de catégories autorisées (vide = toutes). */
  categoryIds: number[];
  /** Difficultés autorisées (vide = toutes). */
  difficulties: number[];
  /** Types autorisés (vide = tous). */
  types: QuestionType[];
  /** Nombre max de questions à jouer dans la session. */
  count: number;
}
