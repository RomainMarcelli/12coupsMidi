-- =============================================================================
-- Midi Master — Ajout du type coup_par_coup
-- =============================================================================
-- Étend la contrainte CHECK de `questions.type` pour accepter 'coup_par_coup'.
-- À passer dans le SQL Editor Supabase après 0001_init.sql et 0002_seed.sql.
--
-- Les questions elles-mêmes sont dans src/data/coup-par-coup.json, seedées
-- via `npm run seed` (qui lit aussi ce fichier).
-- =============================================================================

alter table public.questions
  drop constraint if exists questions_type_check;

alter table public.questions
  add constraint questions_type_check
  check (
    type in (
      'quizz_2',
      'quizz_4',
      'etoile',
      'face_a_face',
      'coup_maitre',
      'coup_par_coup'
    )
  );
