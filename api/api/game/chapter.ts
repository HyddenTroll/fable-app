import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { getLLM } from '../../lib/llm/provider';
import {
  buildChapterMessages,
  buildChapterPrompt,
  buildChoicesPrompt,
  buildSummaryPrompt,
  buildStatePrompt,
  buildSystemPrompt,
  ageLabel,
} from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import { getQuota, canGenerateChapter, recordPremiumChapter } from '../../lib/quota';
import { emptyState, applyStateDelta, parseStateDelta, serializeState, type HeroState, type StateDelta } from '../../lib/state';
import type { AgeGroup, StoryBible, StoryChoice } from '@fable/shared';

const TOTAL_CHAPTERS = 50;
const MAX_CONTEXT_CHAPTERS = 3; // N derniers chapitres réinjectés

interface ChapterBody {
  gameId: string;
  playerChoiceIndex?: number | null;
  playerChoiceLabel?: string | null;
}

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: { code: 'method_not_allowed', message: 'POST requis' } });
  }

  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }

  const { gameId, playerChoiceIndex, playerChoiceLabel } = (req.body ?? {}) as ChapterBody;
  if (!gameId) {
    return json(res, 400, { error: { code: 'bad_request', message: 'gameId requis' } });
  }

  const db = getDb();

  // Charger la partie (doit appartenir à l'utilisateur)
  const { data: game, error: gameError } = await db
    .from('games')
    .select('*')
    .eq('id', gameId)
    .eq('user_id', auth.userId)
    .single();

  if (gameError || !game) {
    return json(res, 404, { error: { code: 'not_found', message: 'Partie introuvable' } });
  }
  if (game.status === 'finished') {
    return json(res, 400, { error: { code: 'finished', message: 'Partie terminée' } });
  }

  const params = game.params as NonNullable<typeof game.params>;
  const age = (params?.age ?? 'adult') as AgeGroup;
  const bible = game.story_bible as StoryBible;
  const nextNumber = game.chapter_count;

  // Quota serveur (source de vérité)
  const quota = await getQuota(db, auth.userId);
  const access = canGenerateChapter(quota, nextNumber);
  if (!access.allowed) {
    return json(res, 402, { error: { code: access.reason, message: access.message }, paywall: true, quota });
  }

  // Contexte : résumé + N derniers chapitres (jamais l'historique complet)
  const { data: recentChapters } = await db
    .from('chapters')
    .select('chapter_number, title, content, player_choice, choices')
    .eq('game_id', gameId)
    .order('chapter_number', { ascending: false })
    .limit(MAX_CONTEXT_CHAPTERS);

  const recent = (recentChapters ?? []).sort((a, b) => a.chapter_number - b.chapter_number);
  const recentContext = recent
    .map((c) => `--- Chapitre ${c.chapter_number}${c.title ? ` : ${c.title}` : ''} ---\n${c.content}`)
    .join('\n\n');

  const act = nextNumber <= 4 ? 'Acte 1 (exposition)' : nextNumber <= 8 ? 'Acte 2 (confrontation)' : nextNumber <= 12 ? 'Acte 3 (résolution)' : 'Dénouement prolongé';
  const phase = actPhase(nextNumber);
  const rule = nextNumber === FREE_CHAPTER_COUNT + 1 ? 'Finis ce chapitre sur un cliffhanger maximal - c\'est la fin de l\'essai gratuit.' : undefined;

  const system = buildSystemPrompt();
  const llm = getLLM();

  // État structuré (source de vérité pour blessures/inventaire/pnj/engagements)
  const state: HeroState = { ...emptyState(), ...(game.state ?? {}) } as HeroState;
  const stateText = serializeState(state);

  // Messages SÉPARÉS pour le cache : bible verbatim (stable) + contexte (volatile)
  const msgs = buildChapterMessages({
    bible,
    bibleText: game.bible_text ?? undefined,
    state: stateText,
    resume: `${game.resume ?? ''}\n\nDerniers chapitres :\n${recentContext}`,
    playerChoice: playerChoiceLabel ?? undefined,
    chapterNumber: nextNumber,
    totalChapters: TOTAL_CHAPTERS,
    act,
    phase,
    params,
    age,
    rule,
  });
  const chapterMessages = [
    { role: 'system' as const, content: msgs.system },
    { role: 'user' as const, content: msgs.stable },
    { role: 'user' as const, content: msgs.volatile },
  ];

  // Réponse en streaming SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Écrire le chapitre en streaming (texte brut)
    let chapterText = '';
    const chapterResult = await (async (): Promise<LLMResult> => {
      const gen = llm.stream({
        messages: chapterMessages,
        kind: 'chapter',
        maxTokens: 8000,
      });
      let result: LLMResult = EMPTY_RESULT;
      for (;;) {
        const { value, done } = await gen.next();
        if (done) {
          // Le générateur retourne le LLMResult final
          result = (value ?? EMPTY_RESULT) as LLMResult;
          break;
        }
        chapterText += value;
        send('text', { delta: value });
      }
      return result;
    })();

    // Choix (appel séparé, petit, JSON forcé)
    let choices: StoryChoice[] = [];
    let title = `Chapitre ${nextNumber}`;
    let choicesResult = EMPTY_RESULT;
    try {
      const choicesGen = await llm.generateJson<{ titre?: string; choix?: StoryChoice[] }>({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: buildChoicesPrompt({ bible, chapterText, chapterNumber: nextNumber, maxChoices: params.maxChoices, age }) },
        ],
        kind: 'choices',
        maxTokens: 800,
      });
      title = choicesGen.json.titre ?? title;
      choices = choicesGen.json.choix ?? [];
      choicesResult = choicesGen.result;
    } catch {
      // si l'IA casse le format, on garde les choix vides (fin possible)
    }

    // Résumé glissant (petit appel - intrigue/ton)
    const summaryResult = await llm.generate({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildSummaryPrompt(game.resume ?? '', chapterText, playerChoiceLabel ?? undefined) },
      ],
      kind: 'summary',
      maxTokens: 600,
    });

    // État structuré (deltas) - source de vérité pour blessures/inventaire/pnj
    let stateResult = EMPTY_RESULT;
    let newState = state;
    try {
      const stateGen = await llm.generateJson<StateDelta>({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: buildStatePrompt({ state: stateText, chapterText }) },
        ],
        kind: 'state',
        maxTokens: 800,
      });
      stateResult = stateGen.result;
      newState = applyStateDelta(state, stateGen.json, nextNumber);
    } catch {
      // si l'IA casse le format, on garde l'état précédent (rien ne s'efface)
    }

    // Stockage
    const isEnd = choices.length === 0 || nextNumber >= TOTAL_CHAPTERS;
    const { data: chapter, error: chapterInsertError } = await db
      .from('chapters')
      .insert({
        game_id: gameId,
        chapter_number: nextNumber,
        title,
        content: chapterText,
        choices,
        player_choice: playerChoiceIndex ?? null,
      })
      .select()
      .single();

    if (chapterInsertError) throw new Error(chapterInsertError.message);

    const newChapterCount = nextNumber + 1;
    const { error: gameUpdateError } = await db
      .from('games')
      .update({
        chapter_count: newChapterCount,
        resume: summaryResult.text,
        status: isEnd ? 'finished' : 'active',
        free_chapters_used: game.free_chapters_used + (quota.isPremium ? 0 : 1),
        state: newState,
      })
      .eq('id', gameId);

    if (gameUpdateError) throw new Error(gameUpdateError.message);
    if (quota.isPremium) await recordPremiumChapter(db, auth.userId);

    // Coûts
    await logLLMResult(db, auth.userId, gameId, 'chapter', chapterResult);
    await logLLMResult(db, auth.userId, gameId, 'choices', choicesResult);
    await logLLMResult(db, auth.userId, gameId, 'summary', summaryResult);
    await logLLMResult(db, auth.userId, gameId, 'state', stateResult);

    const totalCost = chapterResult.costUsd + choicesResult.costUsd + summaryResult.costUsd + stateResult.costUsd;

    send('done', {
      chapter: {
        chapterNumber: chapter.chapter_number,
        title: chapter.title,
        content: chapter.content,
        choices: chapter.choices,
      },
      isEnd,
      resume: summaryResult.text,
      state: newState,
      freeChaptersRemaining: quota.isPremium ? null : Math.max(0, 5 - (game.free_chapters_used + 1)),
      costUsd: totalCost,
    });
    res.end();
  } catch (e) {
    send('error', { message: e instanceof Error ? e.message : 'Erreur de génération' });
    res.end();
  }
}

const FREE_CHAPTER_COUNT = 5;

type LLMGenerate = (opts: {
  messages: { role: string; content: string }[];
  kind: string;
  maxTokens: number;
}) => Promise<LLMResult>;

interface LLMResult {
  text: string;
  provider: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  costUsd: number;
}

const EMPTY_RESULT: LLMResult = {
  text: '',
  provider: 'unknown',
  model: 'unknown',
  usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
  costUsd: 0,
};

function actPhase(n: number): string {
  if (n === 1) return 'Début : le héros franchit le point de bascule.';
  if (n === 2) return 'Le héros découvre les règles du monde et ses alliés.';
  if (n === 3) return 'Montée de tension, premiers obstacles sérieux.';
  if (n === 4) return 'Fin de l\'acte 1 : un événement qui change tout.';
  if (n === 5) return 'Début de l\'acte 2 : conséquences, nouvelle quête.';
  if (n === 6) return 'Le héros s\'engage plus profondément, révélations.';
  if (n === 7) return 'Point médian : un revers majeur ou une grande révélation.';
  if (n === 8) return 'Montée vers le pire, alliés et ennemis se précisent.';
  if (n === 9) return 'Fin de l\'acte 2 : la situation semble perdue.';
  if (n === 10) return 'Début de l\'acte 3 : le héros prépare sa dernière chance.';
  if (n === 11) return 'Avant-climax : le héros affronte ses peurs.';
  return 'Climax : la question dramatique trouve sa réponse.';
}