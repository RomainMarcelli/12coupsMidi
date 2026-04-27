-- =============================================================================
-- Les 12 coups de Mahylan — Mode TV Soirée (rooms multi-joueurs Realtime)
-- =============================================================================
-- Hôte (TV/PC, compte connecté) crée une room avec un code à 4 chiffres.
-- Jusqu'à 8 téléphones rejoignent via QR code ou code, sans login.
-- Synchro via Supabase Realtime (channel `room:{code}`).
--
-- Anti-cheat : l'état complet du jeu est stocké dans `tv_rooms.state` mais
-- les téléphones n'y accèdent pas en lecture directe — l'hôte broadcast
-- uniquement les payloads non-sensibles (cf. lib/realtime/tv-channel.ts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- tv_rooms : un salon = une partie en cours (ou en attente)
-- -----------------------------------------------------------------------------
create table if not exists public.tv_rooms (
  id uuid primary key default gen_random_uuid(),
  -- Code à 4 chiffres unique parmi les rooms NON terminées (cf. index ci-dessous)
  code text not null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'paused', 'ended')),
  game_mode text not null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Unicité du code SEULEMENT sur les rooms actives. Une fois "ended", le
-- code peut être réattribué.
create unique index if not exists tv_rooms_active_code_idx
  on public.tv_rooms (code) where status <> 'ended';

create index if not exists tv_rooms_host_idx on public.tv_rooms (host_id);

comment on table public.tv_rooms is
  'Salons de partie TV Mahylan (mode soirée). 1 hôte + 2-8 téléphones.';

alter table public.tv_rooms enable row level security;

-- Lecture publique : nécessaire pour qu'un téléphone non authentifié
-- vérifie l'existence d'un code avant d'INSERT dans tv_room_players.
create policy "tv_rooms readable" on public.tv_rooms
  for select using (true);

create policy "host can create room" on public.tv_rooms
  for insert with check (auth.uid() = host_id);

create policy "host can update own room" on public.tv_rooms
  for update using (auth.uid() = host_id);

create policy "host can delete own room" on public.tv_rooms
  for delete using (auth.uid() = host_id);

-- -----------------------------------------------------------------------------
-- tv_room_players : joueurs (téléphones) connectés à une room
-- -----------------------------------------------------------------------------
create table if not exists public.tv_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.tv_rooms(id) on delete cascade,
  -- Token UUID stocké en localStorage du téléphone pour la reconnexion.
  -- Sert de "preuve d'identité" sans login : sans le token, impossible de
  -- modifier la ligne. Doit être un UUID v4 généré côté client.
  player_token text not null unique,
  pseudo text not null,
  avatar_url text,
  position int,
  is_connected boolean not null default true,
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now()
);

create index if not exists tv_room_players_room_idx
  on public.tv_room_players (room_id);

alter table public.tv_room_players enable row level security;

-- Lecture publique : la TV ET les téléphones ont besoin de voir tous les
-- joueurs de la room (liste d'attente, scores, etc.).
create policy "tv_room_players readable" on public.tv_room_players
  for select using (true);

-- INSERT public : un téléphone non authentifié doit pouvoir rejoindre.
-- La sécurité repose sur le code à 4 chiffres + le room_id à connaître.
-- Pas idéal mais nécessaire pour le mode "join sans compte".
create policy "anyone can join a room" on public.tv_room_players
  for insert with check (true);

-- UPDATE/DELETE public : protégé par le `player_token` côté client (qui
-- doit être stocké en localStorage et envoyé dans la requête WHERE).
-- En l'absence de token, impossible de cibler la bonne ligne.
create policy "anyone can update own row by token" on public.tv_room_players
  for update using (true);

create policy "anyone can delete own row by token" on public.tv_room_players
  for delete using (true);

-- -----------------------------------------------------------------------------
-- Realtime : activer la diffusion de changements sur les 2 tables
-- -----------------------------------------------------------------------------
-- Permet aux clients (TV + téléphones) de recevoir des events en live
-- sur les changements (joueurs qui rejoignent, status de la room, etc.).
-- Nécessite que la publication `supabase_realtime` existe (créée par
-- défaut sur les nouveaux projets Supabase).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.tv_rooms';
    execute 'alter publication supabase_realtime add table public.tv_room_players';
  end if;
exception when duplicate_object then
  -- Déjà ajouté à la publication, no-op
  null;
end $$;
