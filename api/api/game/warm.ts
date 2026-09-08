import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { getLLM } from '../../lib/llm/provider';
import { buildSystemPrompt, buildChapterMessages } from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import type { GameParams, StoryBible } from '@fable/shared';

/**
 * POST /api/game/warm — AMORÇAGE DU CACHE (piste utilisateur, audit perf).
 *
 * Pendant qu'il lit un chapitre (5-7 min), le client appelle cette route
 * toutes les ~4 min (fire-and-forget). Elle rejoue le PRÉFIXE STABLE
 * (system + bible) avec max_tokens=1 :
 *  - le cache OpenAI/Anthropic reste chaud (TTL ~5 min < durée de lecture
 *    → sinon cached_input_tokens = 0 au chapitre suivant) ;
 *  - la fonction Vercel reste chaude (le cold start de 0,3-2,5 s disparaît
 *    du T1 du chapitre suivant — c'est le cas NOMINAL d'un lecteur).
 *
 * Coût : ~0,001 $ par warm (input ~5 000 tokens), 1-2 par chapitre lu.
 * Le préfixe rejoué est identique à celui du chapitre : system + bible
 * (msgs.stable ne dépend que de bible_text — vérifié dans prompts.ts).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'method_not_allowed' } });
  }
  try {
    const auth = await requireUserId(req);
    if ('error' in auth) {
      return res.status(401).json({ error: { code: 'unauthorized' } });
    }
    const db = getDb();
    const { gameId } = (req.body ?? {}) as { gameId?: string };
    if (!gameId) {
      return res.status(400).json({ error: { code: 'missing_game_id' } });
    }
    const { data: game, error: gameError } = await db
      .from('games')
      .select('id, user_id, story_bible, bible_text, params')
      .eq('id', gameId)
      .single();
    if (gameError || !game) {
      return res.status(404).json({ error: { code: 'not_found' } });
    }
    if (game.user_id !== auth.userId) {
      return res.status(403).json({ error: { code: 'forbidden' } });
    }

    const params = (game.params ?? {}) as GameParams;
    const bible = game.story_bible as StoryBible;
    const msgs = buildChapterMessages({
      bible,
      bibleText: game.bible_text ?? undefined,
      state: '',
      resume: '',
      chapterNumber: 1,
      totalChapters: 24, // seule la partie volatile dépend de ce nombre
      act: '',
      phase: '',
      params,
      age: 'adult',
    });

    const llm = getLLM();
    const result = await llm.generate({
      messages: [
        { role: 'system', content: msgs.system },
        { role: 'user', content: msgs.stable },
      ],
      kind: 'warm',
      maxTokens: 1,
    });
    await logLLMResult(db, auth.userId, gameId, 'warm', result);
    return res.json({ ok: true, model: result.model });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: { code: 'internal_error', message } });
  }
}