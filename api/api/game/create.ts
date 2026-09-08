import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { handleCorsOPTIONS } from '../../lib/cors';
import { getLLM } from '../../lib/llm/provider';
import { buildProloguePrompt, buildQuickBiblePrompt, buildSystemPrompt, buildInitialResume, ageLabel, NARRATIVE_VOICES } from '../../lib/prompts';
import { BRIQUES, BRIQUES_PAR_GENRE, RYTHMES_PAR_GENRE, piocher } from '../../lib/narrative-elements';
import { tirerVecteur, titreTropProche } from '../../lib/variety';
import { logLLMResult } from '../../lib/cost';
import { cleanText } from '../../lib/text';
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
  if (req.method === 'OPTIONS') return handleCorsOPTIONS(req, res);
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
    rythme: undefined, // rempli après le tirage ci-dessous
  };

  // Profil de rythme pioché dans les 8 du genre choisi (étude best-sellers)
  const rythmesGenre = RYTHMES_PAR_GENRE[params.genre] ?? [];
  const rythme = rythmesGenre.length
    ? rythmesGenre[Math.floor(Math.random() * rythmesGenre.length)]
    : undefined;
  if (rythme) params.rythme = { nom: rythme.nom, consigne: rythme.consigne };

  const db = getDb();
  const system = buildSystemPrompt();

  // Vérification du quota : chaque création = bible + prologue (coût fixe),
  // donc elle consomme un créneau du quota (bloque si essai gratuit épuisé).
  const quota = await getQuota(db, auth.userId);
  const access = canCreateGame(quota);
  if (!access.allowed) {
    return json(res, 402, { error: { code: access.reason, message: access.message }, paywall: true });
  }

  // VARIÉTÉ : tirage d'axes + mémoire anti-répétition (la variété se joue
  // dans les contraintes injectées, jamais dans la température).
  const variety = tirerVecteur(params.genre);
  const { data: titresRows } = await db
    .from('games')
    .select('title')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(15);
  const titresConnus = (titresRows ?? [])
    .map((r) => String((r as { title?: unknown }).title ?? ''))
    .filter(Boolean);

  // 1) Story bible LÉGÈRE (démarrage rapide) : charpente minimale générée
  // très vite (~15-25 s) pour ne pas faire attendre le lecteur. La bible
  // COMPLÈTE est enrichie ensuite en arrière-plan par /api/game/enrich.
  const voix = NARRATIVE_VOICES[Math.floor(Math.random() * NARRATIVE_VOICES.length)];
  const briques = [
    { label: 'Lieu de départ', valeur: piocher(BRIQUES.lieux, 1)[0] },
    { label: 'Événement qui déclenche tout', valeur: piocher(BRIQUES.evenements, 1)[0] },
    { label: 'Énigme centrale', valeur: piocher(BRIQUES.mysteres, 1)[0] },
    { label: 'Secret ou faille du héros', valeur: piocher(BRIQUES.secrets, 1)[0] },
    { label: 'Antagoniste ou menace', valeur: piocher(BRIQUES.antagonistes, 1)[0] },
    { label: 'Objet-signal', valeur: piocher(BRIQUES.objets, 1)[0] },
    { label: 'Destination du roman', valeur: piocher(BRIQUES.destinations, 1)[0] },
    ...(BRIQUES_PAR_GENRE[params.genre] ?? []).map((cat) => ({
      label: cat.categorie,
      valeur: piocher(cat.elements, 1)[0],
    })),
    ...(rythme ? [{ label: 'Rythme du roman', valeur: `${rythme.nom} (inspiré de ${rythme.inspirePar}) : ${rythme.consigne}` }] : []),
  ];
  let bible: StoryBible = {} as StoryBible;
  let bibleResult: import('../../lib/llm/provider').LLMResult | null = null;
  try {
    const llm = getLLM();
    const makePrompt = (rappel?: string) =>
      buildQuickBiblePrompt(params, body.age ?? 'adult', {
        heroName: body.heroName,
        heroTrait: body.heroTrait,
        voix,
        briques,
        variety,
        titresConnus,
        rappelAntiDoublon: rappel,
      });
    // ANTI-DOUBLON : le titre est vérifié contre les titres déjà générés
    // pour ce lecteur (égalité ou trop proche en mots-clés) → régénération
    // bornée (max 2) avec rappel explicite. La mémoire inter-livres empêche
    // le doublon « Les Voix sous la marée ».
    let attempt = 0;
    while (attempt < 3) {
      const gen = await llm.generateJson<StoryBible>({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: makePrompt(
              attempt > 0
                ? `Le titre généré (« ${bible.titre} ») est trop proche d'un titre déjà généré pour ce lecteur (${titresConnus.join(' · ')}). Recommence : NOUVEAU titre radicalement différent (autre gabarit, autre univers si nécessaire), tout en gardant les axes imposés.`
                : undefined,
            ),
          },
        ],
        kind: 'story_bible',
        maxTokens: 1800,
      });
      bible = gen.json;
      bibleResult = gen.result;
      if (attempt === 0 || !titreTropProche(String(bible.titre ?? ''), titresConnus)) break;
      attempt++;
    }
    if (!bibleResult) throw new Error('Génération de la bible vide');
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
      maxTokens: 3500,
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
      // Résumé initial SANS le dénouement (la mémoire interdit la fin) :
      // bible.resumeGeneral est un synopsis complet qui révélerait le
      // cap, le résumeur le recopierait comme un passé (hallucination).
      resume: buildInitialResume(bible),
      status: 'active',
      chapter_count: 1, // prologue
      free_chapters_used: 1, // le prologue compte comme 1 (gratuit)
      hero_name: heroName,
      hero_trait: body.heroTrait,
      params: { ...params, variety } as GameParams & { variety: unknown },
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
      content: cleanText(prologue.texte ?? ''),
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