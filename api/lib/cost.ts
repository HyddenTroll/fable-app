/**
 * Journal des coûts IA - source de vérité sur l'économie unitaire.
 * Chaque appel est loggé dans cost_logs (jamais de coût invisible).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptKind, LLMResult } from './llm/provider';

export async function logCost(
  db: SupabaseClient,
  entry: {
    userId: string;
    gameId?: string | null;
    kind: PromptKind;
    provider: string;
    model: string;
    usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
    costUsd: number;
  },
): Promise<void> {
  await db.from('cost_logs').insert({
    user_id: entry.userId,
    game_id: entry.gameId ?? null,
    kind: entry.kind,
    provider: entry.provider,
    model: entry.model,
    input_tokens: entry.usage.inputTokens,
    output_tokens: entry.usage.outputTokens,
    cached_input_tokens: entry.usage.cachedInputTokens,
    cost_usd: entry.costUsd,
  });
}

/** Ajoute le log d'un résultat LLM. */
export async function logLLMResult(
  db: SupabaseClient,
  userId: string,
  gameId: string | null,
  kind: PromptKind,
  result: LLMResult,
): Promise<void> {
  await logCost(db, {
    userId,
    gameId,
    kind,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    costUsd: result.costUsd,
  });
}