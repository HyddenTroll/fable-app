import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { getLLM } from '../../lib/llm/provider';
import { buildStoryBiblePrompt, buildProloguePrompt, buildSystemPrompt, ageLabel } from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import { getQuota, canCreateGame, recordPremiumChapter, FREE_CHAPTER_LIMIT } from '../../lib/quota';
import type { AgeGroup, GameParams, StoryBible } from '@fable/shared';

interface PrologueJson {
  titre?: string;
  texte?: string;
  descriptionCouverture?: string;
  choix?: unknown[];
}

interface CreateBody {
  genre: string;
  subGenre?: string;
  difficulty: string;
  chapterLength: string;
  style: string;
  maxChoices: number;
  age: AgeGroup;
  heroName?: string;
  heroTrait?: string;
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

  const body = (req.body ?? {}) as Partial<CreateBody>;
  if (!body.genre || !body.age || !body.difficulty || !body.chapterLength || !body.style || !body.maxChoices) {
    return json(res, 400, { error: { code: 'bad_request', message: 'Paramètres incomplets' } });
  }

  const maxChoices = [2, 3, 4].includes(Number(body.maxChoices))
    ? (Number(body.maxChoices) as GameParams['maxChoices'])
    : 2;

  const params: GameParams = {
    genre: body.genre as GameParams['genre'],
    subGenre: body.subGenre,
    difficulty: body.difficulty as GameParams['difficulty'],
    chapterLength: body.chapterLength as GameParams['chapterLength'],
    style: body.style as GameParams['style'],
    maxChoices,
  };

  const db = getDb();
  const system = buildSystemPrompt();

  // Vérification du quota : chaque création = bible + prologue (coût fixe),
  // donc elle consomme un créneau du quota (bloque si essai gratuit épuisé).
  const quota = await getQuota(db, auth.userId);
  const access = canCreateGame(quota);
  if (!access.allowed) {
    return json(res, 402, { error: { code: access.reason, message: access.message }, paywall: true });
  }

  // 1) Story bible
  let bible: StoryBible;
  let bibleResult;
  try {
    const llm = getLLM();
    const gen = await llm.generateJson<StoryBible>({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildStoryBiblePrompt(params, body.age, { heroName: body.heroName, heroTrait: body.heroTrait }) },
      ],
      kind: 'story_bible',
      maxTokens: 6000,
    });
    bible = gen.json;
    bibleResult = gen.result;
    await logLLMResult(db, auth.userId, null, 'story_bible', bibleResult);
  } catch (e) {
    return json(res, 502, {
      error: { code: 'llm_error', message: e instanceof Error ? e.message : 'Erreur IA' },
    });
  }

  // 2) Prologue
  let prologue;
  try {
    const llm = getLLM();
    const gen = await llm.generateJson<PrologueJson>({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: buildProloguePrompt(bible, params, body.age) },
      ],
      kind: 'prologue',
      maxTokens: 6000,
    });
    prologue = gen.json;
    await logLLMResult(db, auth.userId, null, 'prologue', gen.result);
  } catch (e) {
    return json(res, 502, {
      error: { code: 'llm_error', message: e instanceof Error ? e.message : 'Erreur IA (prologue)' },
    });
  }

  // 3) Création de la partie (bible + prologue stockés, ch.0 consommé)
  const heroName = body.heroName ?? bible.heros?.nom ?? 'Héros';
  const { data: game, error: gameError } = await db
    .from('games')
    .insert({
      user_id: auth.userId,
      genre: params.genre,
      sous_genre: params.subGenre,
      title: bible.titre,
      story_bible: bible,
      bible_text: bibleResult.text, // JSON figé verbatim (préfixe de prompt stable -> cache)
      resume: bible.resumeGeneral ?? '',
      status: 'active',
      chapter_count: 1, // prologue
      free_chapters_used: 1, // le prologue compte comme 1 (gratuit)
      hero_name: heroName,
      hero_trait: body.heroTrait,
      params,
    })
    .select()
    .single();

  if (gameError || !game) {
    return json(res, 500, { error: { code: 'db_error', message: 'Impossible de créer la partie' } });
  }

  const { data: chapter, error: chapterError } = await db
    .from('chapters')
    .insert({
      game_id: game.id,
      chapter_number: 0,
      title: prologue.titre ?? 'Prologue',
      content: prologue.texte ?? '',
      choices: prologue.choix ?? [],
      cover_image_url: null,
    })
    .select()
    .single();

  if (chapterError) {
    return json(res, 500, { error: { code: 'db_error', message: 'Impossible de stocker le prologue' } });
  }

  // Une création = bible + prologue = 1 créneau consommé du quota Fable+
  if (quota.isPremium) {
    await recordPremiumChapter(db, auth.userId);
  }

  return json(res, 201, {
    gameId: game.id,
    game: {
      id: game.id,
      title: game.title,
      genre: game.genre,
      heroName: game.hero_name,
      chapterCount: game.chapter_count,
      status: game.status,
    },
    chapter: {
      chapterNumber: chapter.chapter_number,
      title: chapter.title,
      content: chapter.content,
      choices: chapter.choices,
      coverImageUrl: chapter.cover_image_url,
    },
    freeChaptersRemaining: Math.max(0, FREE_CHAPTER_LIMIT - quota.freeUsed - 1),
    coverPrompt: prologue.descriptionCouverture,
  });
}