-- =============================================================================
-- 0012 — Défi du jour : archivage + résultats par utilisateur (H3)
-- =============================================================================
-- 2 nouvelles tables :
--
--   public.daily_challenges            : un défi = N questions tirées
--                                        une fois par jour, identique
--                                        pour tous les utilisateurs.
--                                        Renseigné par cron à 00:05 UTC.
--
--   public.daily_challenge_results     : résultats de chaque user pour
--                                        chaque défi joué (1 ligne par
--                                        couple user×date).
--
-- RLS :
--   - daily_challenges : SELECT public (auth requis), pas d'INSERT
--     (le service role passe par RPC ou bypass RLS).
--   - daily_challenge_results : chacun voit/écrit uniquement les siens.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.daily_challenges (
  date         DATE PRIMARY KEY,
  question_ids UUID[] NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_challenges select for authenticated"
  ON public.daily_challenges;
CREATE POLICY "daily_challenges select for authenticated"
  ON public.daily_challenges FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daily_challenge_results (
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date          DATE NOT NULL REFERENCES public.daily_challenges(date) ON DELETE CASCADE,
  correct_count INT NOT NULL,
  total_count   INT NOT NULL,
  -- [{ questionId, userAnswer, isCorrect }]
  answers       JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS daily_challenge_results_user_date_idx
  ON public.daily_challenge_results (user_id, date DESC);

ALTER TABLE public.daily_challenge_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_challenge_results owner select"
  ON public.daily_challenge_results;
CREATE POLICY "daily_challenge_results owner select"
  ON public.daily_challenge_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_challenge_results owner insert"
  ON public.daily_challenge_results;
CREATE POLICY "daily_challenge_results owner insert"
  ON public.daily_challenge_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
