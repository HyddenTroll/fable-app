-- ============================================================
-- FABLE - Migration 0004 : état structuré du héros + cache
-- bible_text : JSON figé de la bible (préfixe de prompt STABLE
--   pour le prompt caching - jamais re-sérialisé, toujours verbatim).
-- state : état structuré du héros (blessures, inventaire, pnj,
--   engagements, lieu) - mis à jour de façon déterministe par deltas.
-- ============================================================

alter table public.games
  add column if not exists bible_text text,
  add column if not exists state jsonb not null default '{}'::jsonb;