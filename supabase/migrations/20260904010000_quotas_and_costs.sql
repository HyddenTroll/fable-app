-- ============================================================
-- FABLE - Migration 0002 : quotas serveur + coûts + comptabilité
-- ============================================================

-- ------------------------------------------------------------------
-- profiles : quotas mensuels Fable+
-- ------------------------------------------------------------------
alter table public.profiles
  add column if not exists premium_chapter_limit int not null default 200,
  add column if not exists chapters_this_month int not null default 0,
  add column if not exists chapter_month text; -- 'YYYY-MM'

-- ------------------------------------------------------------------
-- cost_logs : journal des coûts IA par appel (source de vérité)
-- ------------------------------------------------------------------
create table if not exists public.cost_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  kind text not null check (kind in ('story_bible','prologue','chapter','ending','summary','choices','state')),
  provider text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cached_input_tokens int not null default 0,
  cost_usd numeric(12,8) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cost_logs_user_idx on public.cost_logs (user_id);
create index if not exists cost_logs_game_idx on public.cost_logs (game_id);

alter table public.cost_logs enable row level security;
create policy "cost_logs select own" on public.cost_logs
  for select using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- credits_transactions : le SOLDE doit être la somme, pas un compteur.
-- Vue du solde réel + trigger d'init si besoin.
-- ------------------------------------------------------------------
create or replace view public.credit_balances as
  select user_id, sum(amount) as balance
  from public.credits_transactions
  group by user_id;

-- ------------------------------------------------------------------
-- Fonction serveur : compte les chapitres gratuits consommés (toutes parties)
-- ------------------------------------------------------------------
create or replace function public.free_chapters_used_total(uid uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select coalesce(sum(free_chapters_used), 0)
  from public.games
  where user_id = uid;
$$;