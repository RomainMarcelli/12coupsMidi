-- =============================================================================
-- Les 12 coups de Mahylan — Saved players (mode local) + bucket avatars
-- =============================================================================
-- Permet à un compte de **mémoriser les joueurs locaux** (pseudo + photo)
-- pour les retrouver d'une partie sur l'autre, avec des stats agrégées
-- (parties jouées, victoires, dernière utilisation).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- saved_players
-- -----------------------------------------------------------------------------
create table if not exists public.saved_players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  pseudo text not null,
  avatar_url text,
  games_played int not null default 0,
  games_won int not null default 0,
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Unicité par compte ET par pseudo (insensible à la casse via index ci-dessous)
  unique (owner_id, pseudo)
);

-- Index pour matcher rapidement par pseudo lower-case lors des autocomplétions
create unique index if not exists saved_players_owner_pseudo_lower_idx
  on public.saved_players (owner_id, lower(pseudo));

create index if not exists saved_players_owner_last_played_idx
  on public.saved_players (owner_id, last_played_at desc);

comment on table public.saved_players is
  'Joueurs locaux mémorisés par un compte (mode local 12 Coups, etc.).';
comment on column public.saved_players.last_played_at is
  'Mis à jour à chaque démarrage de partie où ce joueur participe.';

alter table public.saved_players enable row level security;

create policy "user can read own saved players"
  on public.saved_players
  for select
  using (auth.uid() = owner_id);

create policy "user can insert own saved players"
  on public.saved_players
  for insert
  with check (auth.uid() = owner_id);

create policy "user can update own saved players"
  on public.saved_players
  for update
  using (auth.uid() = owner_id);

create policy "user can delete own saved players"
  on public.saved_players
  for delete
  using (auth.uid() = owner_id);

-- -----------------------------------------------------------------------------
-- Storage bucket pour les avatars des joueurs sauvegardés
-- -----------------------------------------------------------------------------
-- Bucket distinct du bucket `avatars` (qui sert au profil principal) pour
-- isoler les permissions et les quotas. Public en lecture car affiché
-- partout dans l'UI.
insert into storage.buckets (id, name, public)
values ('saved-players-avatars', 'saved-players-avatars', true)
on conflict (id) do nothing;

create policy "Saved players avatars publicly readable"
  on storage.objects for select
  using (bucket_id = 'saved-players-avatars');

create policy "Users can upload saved-players avatars in their folder"
  on storage.objects for insert
  with check (
    bucket_id = 'saved-players-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their saved-players avatars"
  on storage.objects for update
  using (
    bucket_id = 'saved-players-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their saved-players avatars"
  on storage.objects for delete
  using (
    bucket_id = 'saved-players-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
