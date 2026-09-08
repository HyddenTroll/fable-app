import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { handleCorsOPTIONS } from '../../lib/cors';
import { getLLM, type LLMResult } from '../../lib/llm/provider';
import {
  buildSystemPrompt,
  buildSummaryPrompt,
  buildStatePrompt,
  buildPlanReconsiderPrompt,
} from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import {
  emptyState,
  applyStateDelta,
  serializeState,
  type HeroState,
  type StateDelta,
} from '../../lib/state';
import type { GameParams, StoryBible, StoryPlan } from '@fable/shared';

/**
 * POST /api/game/finalize
 *
 * POST-TRAITEMENT en arrière-plan d'un chapitre : résumé glissant,
 * état structuré (deltas) et plan recalibré — exécutés SÉPARÉMENT du
 * flux de lecture pour que les choix s'affichent dès la fin du texte.
 *
 * Le client appelle cette route dès réception du `done` (fire-and-forget,
 * il n'attend pas la réponse). /api/game/chapter, au tour suivant, POLL
 * `games.params.post.chapter` et attend (borné) que ce post soit terminé
 * avant de générer — l'état lu est donc toujours frais.
 *
 * Idempotente : un post déjà fait pour le dernier chapitre est un no-op
 * ({ok: true, skipped: true}).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return handleCorsOPTIONS(req, res);
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
      .select('*')
      .eq('id', gameId)
      .eq('user_id', auth.userId)
      .single();
    if (gameError || !game) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Partie introuvable' } });
    }

    const chapterCount = Number(game.chapter_count ?? 1);
    if (chapterCount <= 1) {
      // Rien à finaliser : le prologue n'a pas de post-traitement.
      return res.json({ ok: true, skipped: true, chapter: 0 });
    }
    const lastNumber = chapterCount - 1;
    const params = (game.params ?? {}) as GameParams & { post?: { chapter?: number } };
    if ((params.post?.chapter ?? -1) >= lastNumber) {
      return res.json({ ok: true, skipped: true, chapter: lastNumber });
    }

    const { data: lastChapter, error: lastChapterError } = await db
      .from('chapters')
      .select('chapter_number, content, player_choice, choices')
      .eq('game_id', gameId)
      .order('chapter_number', { ascending: false })
      .limit(1)
      .single();

    if (lastChapterError || !lastChapter) {
      return res.status(404).json({ error: { code: 'no_chapter', message: 'Chapitre introuvable' } });
    }

    // Marque le post comme EN COURS dès maintenant (avant les appels LLM) :
    // /api/game/chapter poll ce drapeau (status 'running' -> continuer
    // d'attendre ; absent -> ne JAMAIS attendre, finalize jamais lancé).
    const { error: startError } = await db
      .from('games')
      .update({
        params: {
          ...params,
          post: { chapter: lastNumber, startedAt: new Date().toISOString(), status: 'running' },
        },
      })
      .eq('id', gameId);
    if (startError) {
      console.warn('[finalize] marquage running impossible', gameId, startError.message);
    }

    // Choix pris par le lecteur au dernier tour (source de la conséquence).
    const choices = (lastChapter.choices ?? []) as { libelle?: string; consequenceResumee?: string }[];
    const pickedIndex = lastChapter.player_choice as number | null;
    const picked = pickedIndex != null ? choices[pickedIndex] : undefined;
    const playerChoiceLabel = picked?.libelle;
    const playerChoiceConsequence = picked?.consequenceResumee;

    const bible = game.story_bible as StoryBible;
    const storyPlan = (game.story_plan as StoryPlan | null) ?? null;
    const state: HeroState = {
      ...emptyState(),
      ...((game.state ?? {}) as Record<string, unknown>),
    } as HeroState;
    const stateText = serializeState(state);
    const hasStoryPlanColumn = 'story_plan' in game;
    const system = buildSystemPrompt();
    const llm = getLLM();

    // IMPORTANT — le résumeur ne voit PAS la bible : la fuite d'hallucination
    // (le dénouement recopié comme un passé) est fermée par construction.
    // Il ne reçoit que : résumé précédent + texte du chapitre + choix.
    const stateMessages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: buildStatePrompt({ state: stateText, chapterText: lastChapter.content }) },
    ];
    const planDirecteur = (bible as StoryBible & { planDirecteur?: unknown }).planDirecteur;
    const planMessages =
      hasStoryPlanColumn && playerChoiceLabel && planDirecteur
        ? [
            { role: 'system' as const, content: system },
            {
              role: 'user' as const,
              content: buildPlanReconsiderPrompt({
                planDirecteur: JSON.stringify(planDirecteur, null, 2),
                currentPlan: storyPlan?.grandesLignes ?? null,
                resume: game.resume ?? '',
                playerChoice: playerChoiceLabel,
              }),
            },
          ]
        : null;

    const tasks: Promise<unknown>[] = [
      llm.generate({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: buildSummaryPrompt(
              game.resume ?? '',
              lastChapter.content,
              playerChoiceLabel ?? undefined,
              playerChoiceConsequence ?? undefined,
            ),
          },
        ],
        kind: 'summary',
        maxTokens: 600,
      }),
      (async () => {
        try {
          const stateGen = await llm.generateJson<StateDelta>({
            messages: stateMessages,
            kind: 'state',
            maxTokens: 800,
          });
          return { result: stateGen.result, state: applyStateDelta(state, stateGen.json, lastNumber) };
        } catch {
          // UN retry — une fois : si les deux échouent, on garde l'état
          // précédent et on signale (divergence potentielle, loggée).
          const retryStateGen = await llm.generateJson<StateDelta>({
            messages: stateMessages,
            kind: 'state',
            maxTokens: 800,
          });
          return {
            result: retryStateGen.result,
            state: applyStateDelta(state, retryStateGen.json, lastNumber),
          };
        }
      })(),
      planMessages
        ? (async () => {
            try {
              const planGen = await llm.generateJson<{
                important?: boolean;
                grandesLignes?: string;
                versQuelleFin?: string;
              }>({
                messages: planMessages,
                kind: 'plan',
                maxTokens: 700,
              });
              return {
                result: planGen.result,
                plan:
                  planGen.json.important && planGen.json.grandesLignes?.trim()
                    ? {
                        grandesLignes: planGen.json.grandesLignes.trim(),
                        derniereMiseAJourChapitre: lastNumber,
                        versQuelleFin: planGen.json.versQuelleFin ?? storyPlan?.versQuelleFin ?? '',
                      }
                    : storyPlan,
              };
            } catch {
              return { result: null, plan: storyPlan };
            }
          })()
        : Promise.resolve({ result: null, plan: storyPlan }),
    ];

    const outcomes = await Promise.allSettled(tasks);
    const summaryResult =
      outcomes[0]?.status === 'fulfilled' ? (outcomes[0].value as LLMResult) : null;
    if (outcomes[0]?.status === 'rejected') {
      console.warn('[finalize] résumé invalide - conservé', gameId);
    }
    let newState = state;
    let stateResult: LLMResult | null = null;
    if (outcomes[1]?.status === 'fulfilled') {
      const v = outcomes[1].value as { result: LLMResult; state: HeroState };
      stateResult = v.result;
      newState = v.state;
    } else {
      console.warn('[finalize] delta état invalide après retry - état conservé', gameId);
    }
    const planOutcome = outcomes[2];
    const newPlan =
      planOutcome?.status === 'fulfilled'
        ? (planOutcome.value as { plan: StoryPlan | null }).plan
        : storyPlan;

    const { error: gameUpdateError } = await db
      .from('games')
      .update({
        resume: summaryResult?.text || game.resume,
        state: newState,
        story_plan: newPlan ?? undefined,
        params: {
          ...params,
          post: {
            chapter: lastNumber,
            doneAt: new Date().toISOString(),
            status: 'done' as const,
          },
        },
      })
      .eq('id', gameId);
    if (gameUpdateError) {
      throw new Error(gameUpdateError.message);
    }

    if (summaryResult) {
      await logLLMResult(db, auth.userId, gameId, 'summary', summaryResult);
    }
    if (stateResult) {
      await logLLMResult(db, auth.userId, gameId, 'state', stateResult);
    }
    const planResult =
      planOutcome?.status === 'fulfilled'
        ? (planOutcome.value as { result: LLMResult }).result
        : null;
    if (planResult) {
      await logLLMResult(db, auth.userId, gameId, 'plan', planResult);
    }

    return res.json({ ok: true, skipped: false, chapter: lastNumber, state: newState });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[finalize]', message);
    return res.status(500).json({ error: { code: 'internal_error', message } });
  }
}