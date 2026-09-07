import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { getLLM } from '../../lib/llm/provider';
import { buildEnrichBiblePrompt, buildSystemPrompt, ageLabel } from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import type { AgeGroup, GameParams, StoryBible } from '@fable/shared';

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * ENRICHIT la bible légère d'une partie en bible COMPLÈTE d'architecte.
 * Appelé en arrière-plan pendant que le lecteur lit le prologue : il
 * reçoit la bible enrichie et l'écrit dans games.story_bible / bible_text
 * quand elle est prête, pour que les chapitres suivants en profitent.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: { code: 'method_not_allowed', message: 'POST requis' } });
  }

  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }

  const { gameId } = (req.body ?? {}) as { gameId?: string };
  if (!gameId) {
    return json(res, 400, { error: { code: 'bad_request', message: 'gameId manquant' } });
  }

  const db = getDb();

  // Récupère la partie (vérifie l'appartenance + récupère la bible légère)
  const { data: game, error: gameError } = await db
    .from('games')
    .select('id, user_id, story_bible, bible_text, params')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    return json(res, 404, { error: { code: 'not_found', message: 'Partie introuvable' } });
  }
  if (game.user_id !== auth.userId) {
    return json(res, 403, { error: { code: 'forbidden', message: 'Accès refusé' } });
  }

  const quickBible = game.story_bible as StoryBible;
  const params = (game.params ?? {}) as GameParams;
  // L'âge n'est pas typé dans GameParams ; défaut raisonnable pour
  // l'enrichissement structurel (identique au fallback de chapter.ts).
  const age = 'adult' as AgeGroup;
  const system = buildSystemPrompt();

  // La voix narrative n'est pas persistée à part, on la déduit de tonStyle
  // (ou on retombe sur un défaut) - l'enrichissement conserve tonStyle.
  const voix = { nom: 'Registre du roman', consigne: quickBible.tonStyle ?? 'prose classique équilibrée' };

  try {
    const llm = getLLM();
    const gen = await llm.generateJson<StoryBible>({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildEnrichBiblePrompt(quickBible, params, age, voix) },
      ],
      kind: 'story_bible',
      // 3 500 mots français ≈ 5 500-6 500 tokens : on reste large, une
      // troncature ici = bible légère pour TOUTE la partie (bug criant).
      maxTokens: 8000,
    });

    const enriched = gen.json;
    await logLLMResult(db, auth.userId, gameId, 'story_bible', gen.result);

    // Conserve quoi qu'il arrive le nom/l'identité du héros déjà posé
    if (quickBible.heros?.nom && !enriched.heros?.nom) enriched.heros = enriched.heros ?? {};
    if (quickBible.heros?.nom) enriched.heros!.nom = quickBible.heros.nom;

    const { error: updateError } = await db
      .from('games')
      .update({
        story_bible: enriched,
        bible_text: gen.result.text, // JSON enrichi figé verbatim (cache)
      })
      .eq('id', gameId);

    if (updateError) {
      return json(res, 500, { error: { code: 'db_error', message: 'Impossible d\'enrichir la bible' } });
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 502, {
      error: { code: 'llm_error', message: e instanceof Error ? e.message : 'Erreur IA (enrichissement)' },
    });
  }
}