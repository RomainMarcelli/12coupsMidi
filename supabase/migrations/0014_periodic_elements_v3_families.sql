-- =============================================================================
-- 0014 — Tableau périodique : v3 des familles + fix data CPC (I2.1 + I2.3)
-- =============================================================================
--
-- I2.1 — Refonte des familles (3e tentative, mapping validé utilisateur).
--
--   10 familles finales (slugs) :
--     1.  metaux-alcalins
--     2.  metaux-alcalino-terreux
--     3.  metaux-transition
--     4.  metaux-post-transition       (renommé depuis metaux-pauvres)
--     5.  metalloides
--     6.  non-metaux-reactifs           (fusion non-metaux + non-metaux-reactifs)
--     7.  gaz-nobles
--     8.  lanthanides
--     9.  actinides
--     10. proprietes-inconnues
--
--   Notes importantes :
--     • Astate (85) → metaux-post-transition (PAS non-métaux)
--     • Hydrogène (1) → non-metaux-reactifs
--     • Polonium (84) → metaux-post-transition
--
-- I2.3 — Fix data Coup par Coup : "Films ayant remporté au moins 9 Oscars"
--   contenait "Le Parrain" sans parenthèses (intrus trop visible). On
--   harmonise en RETIRANT toutes les parenthèses de TOUTES les
--   propositions (cohérent avec H1.3 qui retire les dates dans le CPC).
--
-- Idempotente : peut être réexécutée sans effet de bord (UPDATE par slug).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- I2.1 — Réécriture du mapping famille (UPDATE par numéro atomique)
-- ---------------------------------------------------------------------------

-- Métaux alcalins (groupe 1 sauf H)
UPDATE periodic_elements SET famille = 'metaux-alcalins'
WHERE numero_atomique IN (3, 11, 19, 37, 55, 87);

-- Métaux alcalino-terreux (groupe 2)
UPDATE periodic_elements SET famille = 'metaux-alcalino-terreux'
WHERE numero_atomique IN (4, 12, 20, 38, 56, 88);

-- Métaux de post-transition (Al, Ga, In, Sn, Tl, Pb, Bi, Po, At)
UPDATE periodic_elements SET famille = 'metaux-post-transition'
WHERE numero_atomique IN (13, 31, 49, 50, 81, 82, 83, 84, 85);

-- Métalloïdes (B, Si, Ge, As, Sb, Te)
UPDATE periodic_elements SET famille = 'metalloides'
WHERE numero_atomique IN (5, 14, 32, 33, 51, 52);

-- Non-métaux réactifs (H, C, N, O, F, P, S, Cl, Se, Br, I)
UPDATE periodic_elements SET famille = 'non-metaux-reactifs'
WHERE numero_atomique IN (1, 6, 7, 8, 9, 15, 16, 17, 34, 35, 53);

-- Gaz nobles (groupe 18)
UPDATE periodic_elements SET famille = 'gaz-nobles'
WHERE numero_atomique IN (2, 10, 18, 36, 54, 86, 118);

-- Lanthanides (Ce → Lu)
UPDATE periodic_elements SET famille = 'lanthanides'
WHERE numero_atomique BETWEEN 58 AND 71;

-- Actinides (Th → Lr)
UPDATE periodic_elements SET famille = 'actinides'
WHERE numero_atomique BETWEEN 90 AND 103;

-- Propriétés inconnues (super-lourds non encore caractérisés)
UPDATE periodic_elements SET famille = 'proprietes-inconnues'
WHERE numero_atomique IN (112, 113, 114, 115, 116, 117, 119);

-- Tous les autres = métaux de transition (groupes 3 à 12, plus tout
-- élément qui n'est pas tombé dans une famille ci-dessus).
UPDATE periodic_elements SET famille = 'metaux-transition'
WHERE famille NOT IN (
  'metaux-alcalins',
  'metaux-alcalino-terreux',
  'metaux-transition',
  'metaux-post-transition',
  'metalloides',
  'non-metaux-reactifs',
  'gaz-nobles',
  'lanthanides',
  'actinides',
  'proprietes-inconnues'
);

-- ---------------------------------------------------------------------------
-- Vérification post-migration : doit afficher EXACTEMENT 10 lignes.
-- ---------------------------------------------------------------------------
--
--   SELECT famille, COUNT(*)
--   FROM periodic_elements
--   GROUP BY famille
--   ORDER BY famille;
--
-- Comptes attendus (mapping validé) :
--   actinides                14
--   gaz-nobles                7
--   lanthanides              15
--   metaloides                6
--   metaux-alcalino-terreux   6
--   metaux-alcalins           6
--   metaux-post-transition    9
--   metaux-transition       ~38 (selon nombre total d'éléments seedés)
--   non-metaux-reactifs      11
--   proprietes-inconnues      7
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- I2.3 — Fix data Coup par Coup : harmonisation format Oscars
-- ---------------------------------------------------------------------------
--
-- Stratégie : retire les parenthèses (et leur contenu) de TOUTES les
-- propositions de la question Oscars, pour que "Le Parrain" ne sorte
-- plus du lot. L'expression régulière suit le format `(...)` y compris
-- avec des virgules à l'intérieur (`(1997, 11 Oscars)`).
--
-- jsonb_path_query_array est utilisé pour parcourir les propositions ;
-- on génère un nouveau tableau JSONB où chaque `text` est nettoyé.
-- ---------------------------------------------------------------------------

UPDATE questions
SET propositions = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(prop->'text') = 'string'
        THEN jsonb_set(
          prop,
          '{text}',
          to_jsonb(
            trim(regexp_replace(prop->>'text', '\s*\([^)]*\)\s*', ' ', 'g'))
          )
        )
      ELSE prop
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(propositions) WITH ORDINALITY AS t(prop, ordinality)
)
WHERE type = 'coup_par_coup'
  AND LOWER(enonce) LIKE '%oscars%'
  AND propositions::text ~ '\(';

-- =============================================================================
-- Fin de migration 0014.
-- =============================================================================
