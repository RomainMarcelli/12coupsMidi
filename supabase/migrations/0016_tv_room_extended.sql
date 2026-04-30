-- =============================================================================
-- Vague P (TV refactor) — extensions de tv_rooms et tv_room_players
-- =============================================================================
-- P4.1 — Mode "télécommande unique" : un seul téléphone régie commande pour
--        tous les joueurs (pas de QR par joueur).
-- P5.1 — Face-à-face avec présentateur humain : 2 finalistes s'affrontent,
--        l'un d'eux est présentateur (vote majoritaire).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tv_rooms.mode : "scan" (défaut, joueurs rejoignent par QR) ou "remote"
-- (un seul téléphone régie qui répond pour tous).
-- -----------------------------------------------------------------------------
alter table public.tv_rooms
  add column if not exists mode text not null default 'scan'
    check (mode in ('scan', 'remote'));

-- -----------------------------------------------------------------------------
-- tv_rooms.face_a_face_state : état JSONB pour la phase finale (vote
-- présentateur, joueur en face, timer figé, question courante, élimination).
-- Null tant que la phase n'est pas atteinte.
-- -----------------------------------------------------------------------------
alter table public.tv_rooms
  add column if not exists face_a_face_state jsonb;

-- -----------------------------------------------------------------------------
-- tv_room_players.is_remote : marque les joueurs créés depuis le téléphone
-- régie (mode "remote"). Ces joueurs n'ont PAS de player_token utilisable
-- depuis un autre device — le contrôle se fait par le téléphone régie qui
-- les a créés (qui détient les tokens dans son localStorage).
-- -----------------------------------------------------------------------------
alter table public.tv_room_players
  add column if not exists is_remote boolean not null default false;

comment on column public.tv_rooms.mode is
  'P4.1 — "scan" = joueurs rejoignent via QR (défaut), "remote" = 1 téléphone régie commande pour tous.';
comment on column public.tv_rooms.face_a_face_state is
  'P5.1 — État JSONB de la phase finale face-à-face (vote, finalistes, timer, etc.). NULL tant que non atteinte.';
comment on column public.tv_room_players.is_remote is
  'P4.1 — true si ce joueur a été créé depuis un téléphone régie (mode "remote").';
