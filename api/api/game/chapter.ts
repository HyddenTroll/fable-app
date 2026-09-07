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
  buildPlanReconsiderPrompt,
  ageLabel,
} from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import { getQuota, canGenerateChapter, recordPremiumChapter } from '../../lib/quota';
import { emptyState, applyStateDelta, parseStateDelta, serializeState, type HeroState, type StateDelta } from '../../lib/state';
import type { AgeGroup, StoryBible, StoryChoice, StoryPlan } from '@fable/shared';

/**
 * PILOTAGE DU RÉCIT : la longueur (nb de chapitres) dépend de la
 * difficulté, et la fin n'est autorisée qu'à partir de 75 % — le code
 * l'impose, pas seulement le prompt (le modèle a tendance à conclure
 * trop tôt).
 */
const NIVEAUX = {
  facile: { chapitres: 12, mortalite: 'faible' },
  moyenne: { chapitres: 24, mortalite: 'moyenne' },
  difficile: { chapitres: 40, mortalite: 'élevée' },
} as const;

/** Seuil sous lequel la fin de l'histoire est INTERDITE (%). */
const SEUIL_FIN_POURCENT = 75;

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

  // PILOTAGE DU RÉCIT : longueur selon la difficulté + fin interdite
  // avant 75 %. Le code impose l'interdit ; le prompt gère le rythme.
  const totalChapters = NIVEAUX[params.difficulty as keyof typeof NIVEAUX]?.chapitres ?? 24;
  const pourcent = (nextNumber / totalChapters) * 100;
  const finAutorisee = pourcent >= SEUIL_FIN_POURCENT;
  const mortalite = NIVEAUX[params.difficulty as keyof typeof NIVEAUX]?.mortalite ?? 'moyenne';
  const restants = Math.max(totalChapters - nextNumber, 0);
  const act = pourcent <= 25 ? 'Acte 1 (mise en place)' : pourcent <= 75 ? 'Acte 2 (complications)' : 'Acte 3 (résolution)';
  const phase = actPhase(nextNumber, totalChapters);
  const pilotage = `PILOTAGE DU RÉCIT — ces chiffres sont exacts, respecte-les.
- Difficulté : ${params.difficulty}
- Chapitre actuel : ${nextNumber} sur ${totalChapters} (${Math.round(pourcent)} % du livre)
- Acte en cours : ${act}
- Autorisation de fin : ${finAutorisee ? 'OUI' : `NON avant ${SEUIL_FIN_POURCENT} %`}
- Mortalité attendue : ${mortalite}
- Chapitres restants : ${restants}
RÈGLES DE RYTHME :
- Acte 1 (0-25 %) : installe le monde, le désir du héros, la menace. AUCUNE révélation majeure, AUCUNE confrontation finale. Ouvre des questions.
- Acte 2 (25-75 %) : complications, alliés, fausses pistes, aggravation. Le milieu (~50 %) apporte une révélation qui change la compréhension de l'enjeu. L'antagoniste reprend la main vers 70 %.
- Acte 3 (75-100 %) : convergence puis climax. La fin n'est possible qu'ici.
- Tant que l'autorisation de fin est NON : ne conclus rien, n'épuise pas les révélations — ouvre une nouvelle complication. Tu as ${restants} chapitres devant toi, utilise-les.`;
  const rule = nextNumber === FREE_CHAPTER_COUNT + 1 ? 'Finis ce chapitre sur un cliffhanger maximal - c\'est la fin de l\'essai gratuit.' : undefined;

  const system = buildSystemPrompt();
  const llm = getLLM();

  // État structuré (source de vérité pour blessures/inventaire/pnj/engagements)
  const state: HeroState = { ...emptyState(), ...(game.state ?? {}) } as HeroState;
  const stateText = serializeState(state);

  // Plan de l'histoire (grandes lignes évolutives, mémoire du cap)
  // Ne s'active que si la colonne story_plan existe en base (migration 0005).
  const hasStoryPlanColumn = 'story_plan' in (game as Record<string, unknown>);
  const storyPlan = hasStoryPlanColumn ? ((game as { story_plan: StoryPlan | null }).story_plan ?? null) : null;

  // Messages SÉPARÉS pour le cache : bible verbatim (stable) + contexte (volatile)
  const msgs = buildChapterMessages({
    bible,
    bibleText: game.bible_text ?? undefined,
    state: stateText,
    plan: storyPlan?.grandesLignes ?? undefined,
    rythme: params?.rythme?.consigne,
    resume: `${game.resume ?? ''}\n\nDerniers chapitres :\n${recentContext}`,
    playerChoice: playerChoiceLabel ?? undefined,
    chapterNumber: nextNumber,
    totalChapters,
    act,
    phase,
    params,
    age,
    rule,
    pilotage,
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
        maxTokens: 4000,
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
          { role: 'user', content: buildChoicesPrompt({ bible, chapterText, chapterNumber: nextNumber, maxChoices: params.maxChoices, age, finAutorisee }) },
        ],
        kind: 'choices',
        maxTokens: 800,
      });
      title = choicesGen.json.titre ?? title;
      choices = choicesGen.json.choix ?? [];
      choicesResult = choicesGen.result;

      // GARDE SERVEUR : le modèle a tenté de conclure avant la fin
      // autorisée (zéro choix) -> on refuse et on régénère en interdisant
      // explicitement la conclusion.
      if (choices.length === 0 && !finAutorisee) {
        const retryGen = await llm.generateJson<{ titre?: string; choix?: StoryChoice[] }>({
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: buildChoicesPrompt({ bible, chapterText, chapterNumber: nextNumber, maxChoices: params.maxChoices, age, finAutorisee: false })
                + '\n\nRAPPEL DU RÉDACTEUR EN CHEF : ta première réponse a conclu l\'histoire au chapitre '
                + `${nextNumber} sur ${totalChapters} (${Math.round(pourcent)} %). La fin est INTERDITE avant ${SEUIL_FIN_POURCENT} % du livre. `
                + 'Réécris UNIQUEMENT les choix : 2-3 options courtes qui font CONTINUER l\'histoire et ouvrent une nouvelle complication.',
            },
          ],
          kind: 'choices',
          maxTokens: 800,
        });
        choices = retryGen.json.choix ?? [];
        choicesResult = retryGen.result; // coût réel : le dernier appel gagne (log unique)
      }

      // Dernière garde : si le modèle persiste à ne donner aucun choix,
      // on force deux options génériques plutôt que de terminer l'histoire.
      if (choices.length === 0 && !finAutorisee) {
        choices = [
          { libelle: 'Continuer coûte que coûte', consequenceResumee: 'Le héros ne renonce pas et suit son instinct.' },
          { libelle: 'Temporiser et observer', consequenceResumee: 'Le héros prend le temps de comprendre ce qui se joue.' },
        ];
      }
    } catch {
      // si l'IA casse le format, on garde les choix vides (fin possible
      // seulement si autorisée - sinon le fallback ci-dessus s'applique
      // aussi via b [...] )
      if (choices.length === 0 && !finAutorisee) {
        choices = [
          { libelle: 'Continuer coûte que coûte', consequenceResumee: 'Le héros ne renonce pas et suit son instinct.' },
          { libelle: 'Temporiser et observer', consequenceResumee: 'Le héros prend le temps de comprendre ce qui se joue.' },
        ];
      }
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

    // PLAN (mémoire des grandes lignes) : après le choix du lecteur,
    // l'IA juge si c'est un tournant et réécrit la route si besoin.
    let planResult = EMPTY_RESULT;
    let newPlan = storyPlan;
    const planDirecteur = (bible as StoryBible & { planDirecteur?: unknown }).planDirecteur;
    if (hasStoryPlanColumn && playerChoiceLabel && planDirecteur) {
      try {
        const planGen = await llm.generateJson<{
          important?: boolean;
          grandesLignes?: string;
          versQuelleFin?: string;
        }>({
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: buildPlanReconsiderPrompt({
                planDirecteur: JSON.stringify(planDirecteur, null, 2),
                currentPlan: newPlan?.grandesLignes ?? null,
                resume: summaryResult.text,
                playerChoice: playerChoiceLabel,
              }),
            },
          ],
          kind: 'plan',
          maxTokens: 700,
        });
        planResult = planGen.result;
        if (planGen.json.important && planGen.json.grandesLignes?.trim()) {
          newPlan = {
            grandesLignes: planGen.json.grandesLignes.trim(),
            derniereMiseAJourChapitre: nextNumber,
            versQuelleFin: planGen.json.versQuelleFin ?? newPlan?.versQuelleFin ?? '',
          };
        }
      } catch {
        // on garde le plan précédent (la route n'a pas besoin de changer)
      }
    }

    // Stockage
    // Fin de partie : uniquement si la fin est autorisée (>= 75 %) OU si le
    // plafond de la difficulté est atteint. Le code décide, pas le modèle.
    const isEnd = (choices.length === 0 && finAutorisee) || nextNumber >= totalChapters;
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
        story_plan: newPlan ?? undefined,
      })
      .eq('id', gameId);

    if (gameUpdateError) throw new Error(gameUpdateError.message);
    if (quota.isPremium) await recordPremiumChapter(db, auth.userId);

    // Coûts
    await logLLMResult(db, auth.userId, gameId, 'chapter', chapterResult);
    await logLLMResult(db, auth.userId, gameId, 'choices', choicesResult);
    await logLLMResult(db, auth.userId, gameId, 'summary', summaryResult);
    await logLLMResult(db, auth.userId, gameId, 'state', stateResult);
    if (planResult !== EMPTY_RESULT) {
      await logLLMResult(db, auth.userId, gameId, 'plan', planResult);
    }

    const totalCost = chapterResult.costUsd + choicesResult.costUsd + summaryResult.costUsd + stateResult.costUsd + planResult.costUsd;

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

/**
 * Phase narrative PROPORTIONNELLE : chaque palier est défini par sa
 * position dans le livre (n/total), pas par un numéro absolu — cohérent
 * quel que soit le nombre de chapitres (12, 24 ou 40 selon difficulté).
 */
function actPhase(n: number, total: number): string {
  const p = n / total; // position dans le livre, 0..1
  if (p <= 0.25) {
    if (n <= 1) return 'Le monde ordinaire du héros : sa vie s\'installe, une première graine discrète apparaît (étrangeté à peine perceptible, jamais explicite).';
    if (p <= 0.1) return 'La bascule douce : l\'événement déclencheur se produit, le héros commence à s\'inquiéter, le malaise gagne du terrain.';
    return 'Acte 1 : montée - premiers obstacles sérieux, les graines des chapitres précédents prennent sens, la menace reste floue.';
  }
  if (p <= 0.75) {
    if (p <= 0.3) return 'Acte 2 : conséquences - le héros s\'engage, nouvelle quête, alliés et ennemis se précisent.';
    if (p <= 0.45) return 'Acte 2 : le héros creuse plus profond, révélations partielles, les coûts commencent à se payer.';
    if (p <= 0.55) return 'Point médian : un revers majeur ou une grande révélation change la donne - le héros ne peut plus reculer.';
    if (p <= 0.65) return 'Acte 2 : montée vers le pire, l\'antagoniste gagne du terrain, les pertes s\'accumulent.';
    return 'Fin de l\'acte 2 : la situation semble perdue - les espoirs s\'effondrent.';
  }
  if (p <= 0.88) return 'Acte 3 : dernière chance - le héros rassemble ses forces et prépare son coup.';
  if (p <= 0.96) return 'Acte 3 : avant-climax - le héros affronte ses peurs, les vérités finales éclatent.';
  return 'Climax : la question dramatique trouve sa réponse.';
}