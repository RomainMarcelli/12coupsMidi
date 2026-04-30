-- =============================================================================
-- 0008 — User preferences (E4.1 raccourcis clavier + E4.2 notifs mail)
-- =============================================================================
-- Ajoute deux colonnes JSONB sur `profiles` :
--   - `keyboard_shortcuts` : map des raccourcis personnalisés par contexte.
--     Forme : { "[context]": { "[actionId]": "[key]" } }
--     Ex   : { "quiz": { "answer-1": "a", "answer-2": "b" } }
--     Vide par défaut → on retombe sur les raccourcis par défaut côté client.
--
--   - `notification_settings` : préférences de notifications (push + mail).
--     Forme : {
--       "email_daily": boolean,
--       "email_time":  "HH:MM",      -- heure locale pour l'envoi quotidien
--       "email_days":  number[],      -- 0=dimanche, 1=lundi, …, 6=samedi
--       "push_daily":  boolean        -- déjà géré séparément, on duplique
--                                       ici pour avoir un point unique.
--     }
--     Défaut : email opt-in à OFF, mais time/days/push pré-remplis pour
--     éviter d'avoir des champs null à gérer côté client.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS keyboard_shortcuts JSONB
    NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_settings JSONB
    NOT NULL DEFAULT '{
      "email_daily": false,
      "email_time": "18:00",
      "email_days": [1, 2, 3, 4, 5, 6, 0],
      "push_daily": false
    }'::jsonb;

-- Index GIN pour pouvoir requêter les profils dont les notifs mail sont
-- activées et dont l'heure correspond à l'heure courante (cron quotidien).
CREATE INDEX IF NOT EXISTS profiles_notif_settings_idx
  ON public.profiles
  USING gin (notification_settings);
