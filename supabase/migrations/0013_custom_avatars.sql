-- =============================================================================
-- 0013 — Avatars custom uploadés par l'admin (H4.3)
-- =============================================================================
-- Une table `custom_avatars` pour stocker les URLs d'avatars custom et
-- leurs tags optionnels. Les fichiers eux-mêmes sont dans le bucket
-- Storage `avatars-presets` (créé idempotent ci-dessous).
--
-- RLS :
--   - SELECT : tout utilisateur authentifié (les avatars sont publics).
--   - INSERT/UPDATE/DELETE : admin uniquement (vérifié via la table
--     profiles.role).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.custom_avatars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_avatars_created_at_idx
  ON public.custom_avatars (created_at DESC);

ALTER TABLE public.custom_avatars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_avatars select for authenticated"
  ON public.custom_avatars;
CREATE POLICY "custom_avatars select for authenticated"
  ON public.custom_avatars FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "custom_avatars admin write"
  ON public.custom_avatars;
CREATE POLICY "custom_avatars admin write"
  ON public.custom_avatars FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================================================
-- Bucket Storage `avatars-presets` (public en lecture)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars-presets', 'avatars-presets', true)
ON CONFLICT (id) DO NOTHING;
