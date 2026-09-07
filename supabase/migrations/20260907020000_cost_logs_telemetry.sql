-- ============================================================
-- FABLE - Migration 0008 : télémétrie des appels LLM
-- (model + cached_input_tokens existent déjà depuis 0002)
-- stop_reason : 'stop' | 'max_tokens' (troncature) | 'content_filter'...
--   -> l'alerte serveur [TRONCATURE] s'appuie dessus.
-- latency_ms : durée RÉELLE de l'appel LLM (les created_at des
--   cost_logs ne mesurent que l'écriture en base, en fin de pipeline).
-- ============================================================

alter table public.cost_logs
  add column if not exists stop_reason text,
  add column if not exists latency_ms integer;