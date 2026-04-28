-- =============================================================================
-- 0011 — Tableau périodique V2 : familles FR standards (H2)
-- =============================================================================
-- Corrections post-Vague G :
--
-- H2.1 — Renommage des slugs vers les 10 familles standards FR
--   (cf. https://artsexperiments.withgoogle.com/periodic-table/?lang=fr) :
--     • metaux-post-transition  → metaux-pauvres
--     • non-metaux-reactifs (mélangé)  → split en 2 :
--         - non-metaux-reactifs (diatomic nonmetal : H, N, O, F, Cl, Br, I)
--         - non-metaux         (polyatomic nonmetal : C, P, S, Se)
--
-- H2.2 — Repositionne Lanthane (57) et Actinium (89) dans la grille
--   principale (groupe 3, périodes 6 et 7), comme les autres tableaux
--   périodiques classiques. Les rangées 9/10 commencent désormais à
--   Cérium (58) et Thorium (90) respectivement.
--
-- H2.3 — Corrections ponctuelles de famille pour 3 éléments (référence
--   Google Arts) :
--     • Astate (85)         → metaux-pauvres (au lieu de metalloides)
--     • Copernicium (112)   → proprietes-inconnues (au lieu de metaux-transition)
--     • Flérovium (114)     → proprietes-inconnues (au lieu de metaux-pauvres)
--
-- Idempotente : tous les UPDATE sont stables si rejoués.
-- =============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- H2.1 — Renommages globaux
-- --------------------------------------------------------------------------

UPDATE public.periodic_elements
SET famille = 'metaux-pauvres'
WHERE famille = 'metaux-post-transition';

-- Re-split nonmetals : on remappe par numero_atomique (la category JSON
-- distinguait diatomic vs polyatomic, info perdue après le 0010).
-- Diatomic nonmetals (H, N, O, F, Cl, Br, I) → restent non-metaux-reactifs
UPDATE public.periodic_elements
SET famille = 'non-metaux-reactifs'
WHERE numero_atomique IN (1, 7, 8, 9, 17, 35, 53);

-- Polyatomic nonmetals (C, P, S, Se) → nouveau slug non-metaux
UPDATE public.periodic_elements
SET famille = 'non-metaux'
WHERE numero_atomique IN (6, 15, 16, 34);

-- --------------------------------------------------------------------------
-- H2.3 — Corrections ponctuelles
-- --------------------------------------------------------------------------

UPDATE public.periodic_elements
SET famille = 'metaux-pauvres'
WHERE numero_atomique = 85; -- Astate

UPDATE public.periodic_elements
SET famille = 'proprietes-inconnues'
WHERE numero_atomique IN (112, 114); -- Copernicium, Flérovium

-- --------------------------------------------------------------------------
-- H2.2 — Repositionnement Lanthane et Actinium
-- --------------------------------------------------------------------------

UPDATE public.periodic_elements
SET grid_row = 6, grid_col = 3
WHERE numero_atomique = 57; -- Lanthane

UPDATE public.periodic_elements
SET grid_row = 7, grid_col = 3
WHERE numero_atomique = 89; -- Actinium

COMMIT;
