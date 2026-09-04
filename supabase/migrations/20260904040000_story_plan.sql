-- ============================================================
-- FABLE - Migration 0005 : plan de l'histoire (grandes lignes)
-- story_plan : mémoire évolutive du plan narratif, réécrite par
--   l'IA à chaque tournant important du lecteur. La bible
--   (planDirecteur) reste la référence fixe ; story_plan est la
--   route recalibrée (situation, objectif, scènes clés à venir,
--   fin visée). Injecté dans les prompts des chapitres suivants.
-- Ajoute aussi le kind 'plan' aux cost_logs (journal des coûts).
-- ============================================================

alter table public.games
  add column if not exists story_plan jsonb;

alter table public.cost_logs
  drop constraint if exists cost_logs_kind_check;

alter table public.cost_logs
  add constraint cost_logs_kind_check
  check (kind in ('story_bible','prologue','chapter','ending','summary','choices','state','plan'));