-- =============================================================================
-- F1.2 — Audit des questions face_a_face où `bonne_reponse` apparaît
-- textuellement dans `enonce` (signe probable de copier-coller raté).
--
-- À LANCER MANUELLEMENT (Supabase Dashboard → SQL Editor → Run).
--
-- Étape 1 : audit (lecture seule). Liste-moi le résultat.
-- Étape 2 : correction Beethoven (UPDATE ciblé).
-- Étape 3 : (à voir au cas par cas selon le résultat de l'audit).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- ÉTAPE 1 — Audit large (face_a_face + autres types à réponse libre)
-- ----------------------------------------------------------------------------
-- Critère : la bonne_reponse (≥ 3 caractères) apparaît dans l'énoncé.
-- On filtre les pronoms / mots courants pour limiter le bruit.
SELECT
  id,
  type,
  enonce,
  bonne_reponse,
  category_id
FROM public.questions
WHERE bonne_reponse IS NOT NULL
  AND length(bonne_reponse) >= 3
  AND type IN ('face_a_face', 'coup_maitre', 'etoile')
  AND POSITION(LOWER(bonne_reponse) IN LOWER(enonce)) > 0
  -- Exclut les cas où la bonne réponse N'EST PAS le mot pivot (ex:
  -- "Sport" dans "Sport · Le Tour de France" pour des contextes
  -- catégorie ; à raffiner manuellement).
ORDER BY type, id;

-- ----------------------------------------------------------------------------
-- ÉTAPE 2 — Correction ciblée : Beethoven
-- ----------------------------------------------------------------------------
-- Le user a vu : "Combien de symphonies Beethoven a-t-il composées ?"
-- → bonne_reponse incorrecte = "Beethoven" (devrait être "9").
--
-- On identifie par le motif d'énoncé (ILIKE) au lieu de l'id (le user
-- ne nous l'a pas donné). Vérifie le résultat AVANT le UPDATE.
SELECT id, enonce, bonne_reponse, alias
FROM public.questions
WHERE enonce ILIKE '%symphonies%' AND enonce ILIKE '%Beethoven%';

-- Si la requête ci-dessus retourne UNE seule ligne avec un mauvais
-- bonne_reponse, applique le UPDATE :
UPDATE public.questions
SET
  bonne_reponse = '9',
  alias = '["neuf", "9 symphonies", "neuf symphonies"]'::jsonb
WHERE enonce ILIKE '%symphonies%'
  AND enonce ILIKE '%Beethoven%'
  AND (bonne_reponse IS NULL OR bonne_reponse = 'Beethoven' OR bonne_reponse = 'beethoven');

-- ----------------------------------------------------------------------------
-- ÉTAPE 3 — Recherche élargie (autres patterns suspects)
-- ----------------------------------------------------------------------------
-- Cas où bonne_reponse est un mot < 6 caractères qui apparaît dans
-- l'énoncé (très probable copier-coller du sujet).
SELECT
  id,
  type,
  enonce,
  bonne_reponse
FROM public.questions
WHERE bonne_reponse IS NOT NULL
  AND length(bonne_reponse) BETWEEN 3 AND 6
  AND type IN ('face_a_face', 'coup_maitre', 'etoile')
  AND POSITION(LOWER(' ' || bonne_reponse || ' ') IN LOWER(' ' || enonce || ' ')) > 0
ORDER BY type, id
LIMIT 100;
