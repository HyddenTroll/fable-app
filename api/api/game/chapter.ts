import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { getLLM } from '../../lib/llm/provider';
import {
  buildChapterMessages,
  buildChapterPrompt,
  buildSummaryPrompt,
  buildStatePrompt,
  buildSystemPrompt,
  buildPlanReconsiderPrompt,
  buildFactRegistry,
  buildModerationPrompt,
  ageLabel,
} from '../../lib/prompts';
import { logLLMResult } from '../../lib/cost';
import { getQuota, canGenerateChapter, recordPremiumChapter } from '../../lib/quota';
import { emptyState, serializeState, type HeroState } from '../../lib/state';
import { findFirstMarker, parseChapterMarkers } from '../../lib/chapter-markers';
import type { AgeGroup, StoryBible, StoryChoice, StoryPlan, GameParams } from '@fable/shared';

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
  /** Conséquence du choix annoncée au tour précédent (alimente le résumé). */
  playerChoiceConsequence?: string | null;
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

  const { gameId, playerChoiceIndex, playerChoiceLabel, playerChoiceConsequence } = (req.body ?? {}) as ChapterBody;
  if (!gameId) {
    return json(res, 400, { error: { code: 'bad_request', message: 'gameId requis' } });
  }

  const db = getDb();

  // Charger la partie (doit appartenir à l'utilisateur)
  let game: Record<string, unknown> | null = null;
  {
    const { data, error: gameError } = await db
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('user_id', auth.userId)
      .single();

    if (gameError || !data) {
      return json(res, 404, { error: { code: 'not_found', message: 'Partie introuvable' } });
    }
    game = data as Record<string, unknown>;
  }
  if (game.status === 'finished') {
    return json(res, 400, { error: { code: 'finished', message: 'Partie terminée' } });
  }

  // Fraîcheur du post-traitement : le chapitre précédent est finalisé en
  // ARRIÈRE-PLAN par /api/game/finalize (résumé/état/plan ne bloquent plus
  // l'affichage des choix). Ce chapitre doit attendre que CE post soit
  // terminé pour lire un état à jour (borné à 40 s, puis repli dégradé).
  const chapterCount = Number(game.chapter_count ?? 1);
  if (chapterCount > 1) {
    const lastWritten = chapterCount - 1;
    const posted = (game.params as Record<string, unknown> | null)?.post as
      | { chapter?: number }
      | undefined;
    if ((posted?.chapter ?? -1) < lastWritten) {
      let waited = 0;
      while (waited < 40_000) {
        await new Promise((r) => setTimeout(r, 2000));
        waited += 2000;
        const { data: fresh } = await db
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();
        const postedFresh = ((fresh?.params as Record<string, unknown> | null)?.post as
          | { chapter?: number }
          | undefined)?.chapter ?? -1;
        if (postedFresh >= lastWritten) {
          if (fresh) game = fresh as Record<string, unknown>;
          break;
        }
      }
      if ((game.params as Record<string, unknown> | null)?.post as { chapter?: number } | undefined) {
        // passage : le post est arrivé pendant le poll
      } else {
        console.warn('[chapter] post-traitement du chapitre précédent non terminé - état potentiellement obsolète', gameId);
      }
    }
  }

  const params = (game.params ?? {}) as GameParams;
  const age = (params?.age ?? 'adult') as AgeGroup;
  const bible = game.story_bible as StoryBible;
  const nextNumber = Number(game.chapter_count ?? 1);

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
- Tant que l'autorisation de fin est NON : ne conclus rien, n'épuise pas les révélations — ouvre une nouvelle complication. Tu as ${restants} chapitres devant toi, utilise-les.
${nextNumber >= totalChapters
    ? '- C\'EST LE DERNIER CHAPITRE : conclus MAINTENANT, obligatoirement — climax et résolution, réponds à la question dramatique, AUCUN choix [[CHOIX]].'
    : ''}`;
  const rule = nextNumber === FREE_CHAPTER_COUNT + 1 ? 'Finis ce chapitre sur un cliffhanger maximal - c\'est la fin de l\'essai gratuit.' : undefined;

  const system = buildSystemPrompt();
  const llm = getLLM();

  // État structuré (source de vérité pour blessures/inventaire/pnj/engagements)
  const state: HeroState = { ...emptyState(), ...((game.state ?? {}) as Record<string, unknown>) } as HeroState;
  const stateText = serializeState(state);

  // Plan de l'histoire (grandes lignes évolutives, mémoire du cap)
  // Ne s'active que si la colonne story_plan existe en base (migration 0005).
  const hasStoryPlanColumn = 'story_plan' in game;
  const hasModerationColumn = 'moderation_flags' in game;
  const storyPlan = hasStoryPlanColumn ? ((game.story_plan as StoryPlan | null) ?? null) : null;

  // Messages SÉPARÉS pour le cache : bible verbatim (stable) + contexte (volatile)
  const msgs = buildChapterMessages({
    bible,
    bibleText: game.bible_text as string | undefined,
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
    facts: buildFactRegistry(bible),
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
    // --- Génération du chapitre ---
    // Mineurs (under10/10to15) : génération BUFFERISÉE + vérification de
    // contenu BLOQUANTE — le texte n'est diffusé qu'après le verdict ; la
    // machine à écrire est rejouée en morceaux ensuite (le lecteur attend
    // "L'IA écrit..." pendant la génération + la vérification).
    // Adultes : streaming direct (machine à écrire en direct).
    const modBlocking = age === 'under10' || age === '10to15';
    let chapterText = '';
    let tail = ''; // queue non diffusée (titre + choix)
    let moderationFlagged = false;
    let chapterResult: LLMResult = EMPTY_RESULT;

    if (modBlocking) {
      const full = await llm.generate({
        messages: chapterMessages,
        kind: 'chapter',
        maxTokens: 4000,
      });
      chapterResult = full;
      chapterText = full.text;
      const idx = findFirstMarker(chapterText);
      if (idx >= 0) {
        tail = chapterText.slice(idx);
        chapterText = chapterText.slice(0, idx).trimEnd();
      }
      // Verdict bloquant : chapitre refusé -> ni diffusé, ni stocké.
      try {
        const mod = await llm.generate({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: buildModerationPrompt({ chapterText, age }) },
          ],
          kind: 'moderation',
          maxTokens: 10,
        });
        moderationFlagged = mod.text.trim().toLowerCase().startsWith('oui');
      } catch {
        moderationFlagged = false;
      }
      if (moderationFlagged) {
        console.warn('[chapter] MODÉRATION BLOQUANTE : chapitre refusé', gameId, 'ch', nextNumber);
        send('error', { message: 'Ce passage a été refusé par la modération. Réessaie.' });
        res.end();
        return;
      }
      // Machine à écrire rejouée (le lecteur n'a rien vu pendant l'attente).
      const CHUNK = 48;
      for (let i = 0; i < chapterText.length; i += CHUNK) {
        send('text', { delta: chapterText.slice(i, i + CHUNK) });
        await new Promise((r) => setTimeout(r, 16));
      }
    } else {
      chapterResult = await (async (): Promise<LLMResult> => {
        const gen = llm.stream({
          messages: chapterMessages,
          kind: 'chapter',
          maxTokens: 4000,
        });
        let result: LLMResult = EMPTY_RESULT;
        let streamTail = ''; // fenêtre de sécurité pour détecter un marqueur coupé
        let bodySent = false;
        for (;;) {
          const { value, done } = await gen.next();
          if (done) {
            result = (value ?? EMPTY_RESULT) as LLMResult;
            break;
          }
          const delta = value as string;
          if (bodySent) {
            tail += delta;
            continue;
          }
          streamTail += delta;
          const iTitre = streamTail.indexOf('[[TITRE]]');
          const iChoix = streamTail.indexOf('[[CHOIX]]');
          const idx = Math.min(iTitre >= 0 ? iTitre : Infinity, iChoix >= 0 ? iChoix : Infinity);
          if (idx !== Infinity) {
            // Le corps se termine ici : envoie la partie avant le marqueur.
            const pre = streamTail.slice(0, idx);
            if (pre) {
              chapterText += pre;
              send('text', { delta: pre });
            }
            tail = streamTail.slice(idx);
            bodySent = true;
            continue;
          }
          // Fenêtre de sécurité (10 chars) pour ne pas couper un marqueur
          // entre deux deltas ; le reste est diffusé immédiatement.
          const safe = Math.max(streamTail.length - 10, 0);
          const diff = streamTail.slice(0, safe);
          if (diff) {
            chapterText += diff;
            send('text', { delta: diff });
          }
          streamTail = streamTail.slice(safe);
        }
        chapterText += streamTail; // dernier reliquat du corps
        return result;
      })();
    }

    // Titre + choix : fusionnés à la fin du MÊME appel chapitre (le modèle
    // qui vient d'écrire choisit les choix — plus d'appel séparé aveugle).
    let choices: StoryChoice[] = [];
    let title = `Chapitre ${nextNumber}`;
    const meta = parseChapterMarkers(tail);
    if (meta.title) title = meta.title;
    choices = meta.choices;

    // Filet (rare) : zéro choix alors que la fin n'est PAS autorisée ->
    // rattrapage explicite, puis deux choix forcés en dernière extrémité.
    let choicesResult = EMPTY_RESULT;
    if (choices.length === 0 && !finAutorisee) {
      try {
        const retryGen = await llm.generateJson<{ choix?: StoryChoice[] }>({
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content:
                `Tu es le rédacteur en chef. L'écrivain du chapitre ${nextNumber} a oublié les choix. ` +
                `L'historie continue (fin interdite avant ${SEUIL_FIN_POURCENT} %). ` +
                `Propose ${2 <= params.maxChoices ? `de 2 à ${params.maxChoices}` : '2'} choix courts (4-9 mots, action + enjeu, 10 mots max) ` +
                `ainsi que leur conséquence en une phrase. JSON : {"choix": [{"libelle": "...", "consequenceResumee": "..."}]}`,
            },
          ],
          kind: 'choices',
          maxTokens: 500,
        });
        choices = retryGen.json.choix ?? [];
        choicesResult = retryGen.result;
      } catch {
        // ignore - fallback ci-dessous
      }
      if (choices.length === 0) {
        choices = [
          { libelle: 'Continuer coûte que coûte', consequenceResumee: 'Le héros ne renonce pas et suit son instinct.' },
          { libelle: 'Temporiser et observer', consequenceResumee: 'Le héros prend le temps de comprendre ce qui se joue.' },
        ];
      }
    }

    // POST-TRAITEMENT DÉLÉGUÉ : le résumé/état/plan du chapitre sont
    // exécutés en ARRIÈRE-PLAN par /api/game/finalize (déclenché par le
    // client dès réception du done) — ils ne retardent plus l'affichage
    // des choix. Ce chapitre ne stocke ici que le texte et les choix.
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
    const moderationFlags =
      hasModerationColumn && moderationFlagged
        ? [
            ...((game as { moderation_flags?: { chapter: number; at: string }[] }).moderation_flags ?? []),
            { chapter: nextNumber, at: new Date().toISOString() },
          ]
        : undefined;
    const { error: gameUpdateError } = await db
      .from('games')
      .update({
        chapter_count: newChapterCount,
        status: isEnd ? 'finished' : 'active',
        free_chapters_used: Number(game.free_chapters_used ?? 0) + (quota.isPremium ? 0 : 1),
        ...(moderationFlags ? { moderation_flags: moderationFlags } : {}),
      })
      .eq('id', gameId);

    if (gameUpdateError) throw new Error(gameUpdateError.message);
    if (quota.isPremium) await recordPremiumChapter(db, auth.userId);

    // Coûts : texte + éventuel filet.
    await logLLMResult(db, auth.userId, gameId, 'chapter', chapterResult);
    if (choicesResult !== EMPTY_RESULT) {
      await logLLMResult(db, auth.userId, gameId, 'choices', choicesResult);
    }

    send('done', {
      chapter: {
        chapterNumber: chapter.chapter_number,
        title: chapter.title,
        content: chapter.content,
        choices: chapter.choices,
      },
      isEnd,
      // Résumé/état du tour précédent : le frais arrive par /finalize et
      // sera fourni avec le prochain chapitre (état à jour garanti par le
      // poll de fraîcheur au début de ce handler).
      resume: game.resume ?? '',
      state: null,
      freeChaptersRemaining: quota.isPremium ? null : Math.max(0, 5 - (Number(game.free_chapters_used ?? 0) + 1)),
      costUsd: chapterResult.costUsd + (choicesResult === EMPTY_RESULT ? 0 : choicesResult.costUsd),
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