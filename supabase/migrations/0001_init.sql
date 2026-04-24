-- =============================================================================
-- Midi Master — Migration initiale
-- =============================================================================
-- Crée le schéma complet (profiles, categories, subcategories, questions,
-- game_sessions, answers_log, wrong_answers, badges, user_badges), active RLS
-- et les policies, et pose un trigger d'auto-création de profil à l'inscription.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Profils utilisateurs (auth géré par Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  pseudo text unique not null,
  role text check (role in ('user', 'admin')) default 'user',
  xp int default 0,
  niveau int default 1,
  created_at timestamptz default now()
);

-- Catégories
create table if not exists public.categories (
  id serial primary key,
  nom text unique not null,
  slug text unique not null,
  emoji text,
  couleur text
);

-- Sous-catégories
create table if not exists public.subcategories (
  id serial primary key,
  category_id int references public.categories on delete cascade,
  nom text not null,
  slug text not null,
  unique (category_id, slug)
);

-- Questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('quizz_2', 'quizz_4', 'etoile', 'face_a_face', 'coup_maitre')) not null,
  category_id int references public.categories,
  subcategory_id int references public.subcategories,
  difficulte int check (difficulte between 1 and 5) default 2,
  enonce text not null,
  reponses jsonb not null,           -- [{text: "...", correct: bool}, ...]
  bonne_reponse text,                -- pour face_a_face / etoile (réponse libre)
  alias jsonb,                       -- variantes acceptées
  indices jsonb,                     -- pour etoile/coup_maitre
  image_url text,
  explication text,
  author_id uuid references public.profiles,
  created_at timestamptz default now()
);

-- Historique de parties
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade,
  mode text not null,                -- 'jeu1', 'jeu2', 'face_a_face', 'coup_maitre', 'parcours', 'revision'
  score int default 0,
  correct_count int default 0,
  total_count int default 0,
  duration_seconds int,
  xp_gained int default 0,
  created_at timestamptz default now()
);

-- Réponses individuelles (pour stats et mode révision)
create table if not exists public.answers_log (
  id bigserial primary key,
  session_id uuid references public.game_sessions on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  question_id uuid references public.questions on delete cascade,
  is_correct boolean not null,
  time_taken_ms int,
  created_at timestamptz default now()
);

-- Questions ratées (mode révision)
create table if not exists public.wrong_answers (
  id bigserial primary key,
  user_id uuid references public.profiles on delete cascade,
  question_id uuid references public.questions on delete cascade,
  fail_count int default 1,
  success_streak int default 0,
  last_seen_at timestamptz default now(),
  unique (user_id, question_id)
);

-- Badges
create table if not exists public.badges (
  id serial primary key,
  code text unique not null,
  nom text not null,
  description text,
  icone text
);

create table if not exists public.user_badges (
  user_id uuid references public.profiles on delete cascade,
  badge_id int references public.badges on delete cascade,
  obtained_at timestamptz default now(),
  primary key (user_id, badge_id)
);

-- -----------------------------------------------------------------------------
-- Trigger : auto-création du profil à l'inscription
-- -----------------------------------------------------------------------------
-- Quand Supabase Auth crée une entrée dans auth.users, on crée automatiquement
-- une ligne dans public.profiles avec un pseudo dérivé de l'email + un suffixe
-- court pour garantir l'unicité (le user pourra le modifier plus tard).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    split_part(new.email, '@', 1) || '-' || substr(md5(new.id::text), 1, 4)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.questions enable row level security;
alter table public.game_sessions enable row level security;
alter table public.answers_log enable row level security;
alter table public.wrong_answers enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- profiles : chacun voit son profil ; tous les users authentifiés peuvent lire
-- les pseudos (utile pour les leaderboards futurs).
drop policy if exists "profiles_select_all_auth" on public.profiles;
create policy "profiles_select_all_auth"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- categories / subcategories / badges : lecture publique (authentifié)
drop policy if exists "categories_select_auth" on public.categories;
create policy "categories_select_auth"
  on public.categories for select using (auth.role() = 'authenticated');

drop policy if exists "subcategories_select_auth" on public.subcategories;
create policy "subcategories_select_auth"
  on public.subcategories for select using (auth.role() = 'authenticated');

drop policy if exists "badges_select_auth" on public.badges;
create policy "badges_select_auth"
  on public.badges for select using (auth.role() = 'authenticated');

-- questions : lecture pour tous les authentifiés, écriture pour admin uniquement
drop policy if exists "questions_select_auth" on public.questions;
create policy "questions_select_auth"
  on public.questions for select using (auth.role() = 'authenticated');

drop policy if exists "questions_insert_admin" on public.questions;
create policy "questions_insert_admin"
  on public.questions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "questions_update_admin" on public.questions;
create policy "questions_update_admin"
  on public.questions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "questions_delete_admin" on public.questions;
create policy "questions_delete_admin"
  on public.questions for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- game_sessions : chaque user voit et crée les siennes
drop policy if exists "sessions_select_own" on public.game_sessions;
create policy "sessions_select_own"
  on public.game_sessions for select using (user_id = auth.uid());

drop policy if exists "sessions_insert_own" on public.game_sessions;
create policy "sessions_insert_own"
  on public.game_sessions for insert with check (user_id = auth.uid());

-- answers_log : idem
drop policy if exists "answers_select_own" on public.answers_log;
create policy "answers_select_own"
  on public.answers_log for select using (user_id = auth.uid());

drop policy if exists "answers_insert_own" on public.answers_log;
create policy "answers_insert_own"
  on public.answers_log for insert with check (user_id = auth.uid());

-- wrong_answers : idem + update pour incrémenter success_streak
drop policy if exists "wrong_select_own" on public.wrong_answers;
create policy "wrong_select_own"
  on public.wrong_answers for select using (user_id = auth.uid());

drop policy if exists "wrong_insert_own" on public.wrong_answers;
create policy "wrong_insert_own"
  on public.wrong_answers for insert with check (user_id = auth.uid());

drop policy if exists "wrong_update_own" on public.wrong_answers;
create policy "wrong_update_own"
  on public.wrong_answers for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "wrong_delete_own" on public.wrong_answers;
create policy "wrong_delete_own"
  on public.wrong_answers for delete using (user_id = auth.uid());

-- user_badges : chacun voit les siens ; l'insertion se fait via RPC server-side
-- (rôle service_role ou fonction security definer) — pas de policy insert côté user.
drop policy if exists "user_badges_select_own" on public.user_badges;
create policy "user_badges_select_own"
  on public.user_badges for select using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Index recommandés
-- -----------------------------------------------------------------------------

create index if not exists idx_questions_type on public.questions(type);
create index if not exists idx_questions_category on public.questions(category_id);
create index if not exists idx_answers_user on public.answers_log(user_id);
create index if not exists idx_answers_session on public.answers_log(session_id);
create index if not exists idx_sessions_user on public.game_sessions(user_id);
create index if not exists idx_wrong_user on public.wrong_answers(user_id);
