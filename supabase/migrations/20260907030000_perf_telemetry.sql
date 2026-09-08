-- ============================================================
-- FABLE - Migration 0009 : télémétrie de performance
-- ttft_ms : time-to-first-token (début requête -> 1er token diffusé)
--   -> le chiffre de T1, mesure la santé du chemin critique.
-- total_ms : durée totale de la requête (fin de pipeline).
-- kind 'warm' : appels d'amorçage du cache (route /api/game/warm,
--   préfixe stable rejoué pendant la lecture : cache TTL 5 min +
--   fonction Vercel chaude entre deux chapitres).
-- ============================================================

alter table public.cost_logs
  add column if not exists ttft_ms integer,
  add column if not exists total_ms integer;

alter table public.cost_logs
  drop constraint if exists cost_logs_kind_check;

alter table public.cost_logs
  add constraint cost_logs_kind_check
  check (kind in ('story_bible','prologue','chapter','ending','summary','choices','state','plan','moderation','warm'));