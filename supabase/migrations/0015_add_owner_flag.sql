-- ---------------------------------------------------------------------------
-- K4 — Flag is_owner pour le branding conditionnel "Mahylan vs générique"
-- ---------------------------------------------------------------------------
--
-- L'utilisateur Mahylan (mahylan.veclin@gmail.com) doit voir
-- "Les 12 coups de Mahylan" + son logo perso ; les autres utilisateurs
-- voient "Coups de Midi Quiz" + un logo générique. C'est purement
-- cosmétique — aucune action sensible ne dépend de ce flag.
--
-- ATTENTION : si le compte mahylan.veclin@gmail.com n'existe pas
-- encore en base au moment de l'application, le UPDATE est no-op.
-- Dans ce cas, l'admin doit set is_owner = TRUE manuellement après
-- création du compte (cf. docs/CORRECTIONS_VAGUE_K.md procédure K4.2).
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_owner
  ON public.profiles(is_owner) WHERE is_owner = TRUE;

-- Set is_owner = TRUE pour Mahylan si le compte existe déjà.
UPDATE public.profiles
SET is_owner = TRUE
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = 'mahylan.veclin@gmail.com'
  LIMIT 1
);

COMMENT ON COLUMN public.profiles.is_owner IS
  'K4 — Flag cosmétique : seul le owner voit le branding "Mahylan". Aucun pouvoir admin associé (cf. role pour ça).';
