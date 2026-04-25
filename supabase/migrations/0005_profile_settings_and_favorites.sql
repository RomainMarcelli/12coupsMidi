-- =============================================================================
-- Midi Master — Profile settings, avatar, favoris
-- =============================================================================
-- Étend `profiles` (avatar_url, theme, settings JSONB) et ajoute la table
-- `user_favorites` (étoiles sur questions). Bucket Storage `avatars` pour
-- les photos de profil uploadées.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles : nouvelles colonnes
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists theme text
    check (theme in ('light', 'dark', 'system'))
    default 'system',
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.profiles.avatar_url is
  'URL absolue de l''avatar/photo (Supabase Storage ou DiceBear).';
comment on column public.profiles.theme is
  'Préférence de thème : light | dark | system.';
comment on column public.profiles.settings is
  'Préférences libres en JSON : tts_auto, voice_recognition, volume, muted, daily_notif, etc.';

-- -----------------------------------------------------------------------------
-- user_favorites : étoiles sur questions
-- -----------------------------------------------------------------------------
create table if not exists public.user_favorites (
  user_id uuid not null references auth.users on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists user_favorites_user_idx
  on public.user_favorites (user_id);

alter table public.user_favorites enable row level security;

create policy "user can read own favorites"
  on public.user_favorites
  for select
  using (auth.uid() = user_id);

create policy "user can insert own favorites"
  on public.user_favorites
  for insert
  with check (auth.uid() = user_id);

create policy "user can delete own favorites"
  on public.user_favorites
  for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Storage bucket pour les avatars
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policies storage : chacun peut écrire dans son sous-dossier {user_id}/...
create policy "Avatars publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
