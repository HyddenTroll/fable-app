-- ============================================================
-- FABLE - Migration 0001 : schéma initial (auth + RLS)
-- Base : docs/6-avant-le-code/architecture-technique.txt §6
-- ============================================================

-- ------------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------
-- profiles : un profil par utilisateur auth
-- ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  age text,                        -- tranche d'âge (AgeGroup)
  age_confirmed_at timestamptz,
  preferences jsonb default '{}'::jsonb, -- genre fav, style, longueur
  credits_balance int not null default 30,
  is_premium boolean not null default false,
  premium_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------
-- games : parties / romans générés
-- ------------------------------------------------------------------
create table public.games (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  genre text not null,
  sous_genre text,
  title text,
  story_bible jsonb,
  resume text,
  status text not null default 'active' check (status in ('active', 'finished', 'failed')),
  chapter_count int not null default 0,
  free_chapters_used int not null default 0,
  hero_name text,
  hero_trait text,
  params jsonb,
  ending_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_user_id_idx on public.games (user_id);

-- ------------------------------------------------------------------
-- chapters : chapitres d'une partie
-- ------------------------------------------------------------------
create table public.chapters (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games (id) on delete cascade,
  chapter_number int not null default 0, -- 0 = prologue
  title text,
  content text,
  choices jsonb,                    -- [ {libelle, consequenceResumee} ]
  player_choice int,
  cover_image_url text,
  created_at timestamptz not null default now(),
  unique (game_id, chapter_number)
);

create index chapters_game_id_idx on public.chapters (game_id);

-- ------------------------------------------------------------------
-- credits_transactions : journal des crédits
-- ------------------------------------------------------------------
create table public.credits_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,              -- + ou -
  type text not null check (type in ('purchase', 'image_use', 'free', 'bonus', 'refund')),
  reference text,
  created_at timestamptz not null default now()
);

create index credits_transactions_user_id_idx on public.credits_transactions (user_id);

-- ------------------------------------------------------------------
-- purchases : achats in-app (V1)
-- ------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store text not null check (store in ('apple', 'google')),
  product_id text not null,
  transaction_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'verified', 'refunded')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- ROW LEVEL SECURITY (activé + policies)
-- ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.chapters enable row level security;
alter table public.credits_transactions enable row level security;
alter table public.purchases enable row level security;

-- profiles : chacun voit et modifie son propre profil
create policy "profiles select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

-- games : lecture/écriture par le propriétaire
create policy "games select own" on public.games
  for select using (auth.uid() = user_id);
create policy "games insert own" on public.games
  for insert with check (auth.uid() = user_id);
create policy "games update own" on public.games
  for update using (auth.uid() = user_id);

-- chapters : lecture/écriture par le propriétaire de la partie
create policy "chapters select own" on public.chapters
  for select using (exists (
    select 1 from public.games g
    where g.id = chapters.game_id and g.user_id = auth.uid()
  ));
create policy "chapters insert own" on public.chapters
  for insert with check (exists (
    select 1 from public.games g
    where g.id = chapters.game_id and g.user_id = auth.uid()
  ));

-- credits_transactions : lecture par le propriétaire
create policy "credits select own" on public.credits_transactions
  for select using (auth.uid() = user_id);

-- purchases : lecture par le propriétaire
create policy "purchases select own" on public.purchases
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Fonction utilitaire : lire son profil (côté app)
-- ------------------------------------------------------------------
create or replace function public.get_my_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;