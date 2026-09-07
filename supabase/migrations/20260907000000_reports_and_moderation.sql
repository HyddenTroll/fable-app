-- 20260907000000_reports_and_moderation.sql
-- À EXÉCUTER dans le SQL Editor Supabase (2 statements, l'utilisateur les applique).

-- 1) Table des signalements utilisateurs (exigence App Store : « Signaler »).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  message text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
-- L'insertion est faite par l'API avec la clé de service ; les clients ne
-- lisent pas les signalements des autres.

-- 2) Drapeaux de modération automatique (publics jeunes), un par chapitre.
alter table public.games add column if not exists moderation_flags jsonb default '[]'::jsonb;