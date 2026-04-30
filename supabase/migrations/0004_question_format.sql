-- Migration 0004 — Ajoute un champ `format` sur questions pour Le Coup d'Envoi.
--
-- `format` s'applique uniquement au type `quizz_2` (2 options) et décline le
-- phrasing du présentateur :
--   - 'vrai_faux'  : « Vrai ou faux ? [assertion] » → réponses ["Vrai","Faux"]
--   - 'ou'         : « L'un ou l'autre ? [A] ou [B] » → réponses [A, B]
--   - 'plus_moins' : « Plus ou moins ? [valeur] » → réponses ["Plus","Moins"]
-- NULL pour tout autre type (quizz_4, etoile, face_a_face, coup_maitre,
-- coup_par_coup) et pour les quizz_2 legacy.

alter table questions
  add column if not exists format text
    check (format in ('vrai_faux', 'ou', 'plus_moins'));

comment on column questions.format is
  'Sous-format optionnel pour quizz_2 (Coup d''Envoi) : vrai_faux, ou, plus_moins.';
