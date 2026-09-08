import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { handleCorsOPTIONS } from '../../lib/cors';
import { generateCoverImage } from '../../lib/cover';
import { getQuota } from '../../lib/quota';

/** Quota mensuel de couvertures IA (même pour Fable+) — décision produit. */
const COVER_QUOTA_PER_MONTH = 5;

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** POST /api/game/cover — génère la couverture IA du livre (chap. 0).
 *  Idempotent : si une couverture existe déjà, elle est renvoyée telle quelle
 *  (aucun coût de régénération — une couverture par livre. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return handleCorsOPTIONS(req, res);
  if (req.method !== 'POST') return json(res, 405, { error: { code: 'method_not_allowed' } });

  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }

  const gameId = (req.body?.gameId ?? req.query.gameId) as string | undefined;
  if (!gameId) return json(res, 400, { error: { code: 'bad_request', message: 'gameId requis' } });

  const db = getDb();

  // Fable+ UNIQUEMENT : la génération d'images a un coût réel — les comptes
  // gratuits reçoivent la couverture blanche au titre imprimé.
  const q = await getQuota(db, auth.userId);
  if (!q.isPremium) {
    return json(res, 402, {
      error: { code: 'premium_required', message: 'Fable+ est requis pour générer les couvertures.', paywall: true },
    });
  }
  // Quota mensuel : 5 couvertures par abonné (Decision produit : « même pour
  // fable+ ça génère que 5 couvertures »). Comptées sur les chapitres 0 dont
  // la couverture a été posée ce mois-ci (updated_at).
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const { data: mesJeux } = await db.from('games').select('id').eq('user_id', auth.userId);
  const ids = (mesJeux ?? []).map((j: { id: string }) => j.id);
  const { count: coversThisMonth } = ids.length
    ? await db
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .in('game_id', ids)
        .eq('chapter_number', 0)
        .not('cover_image_url', 'is', null)
        .gte('updated_at', debutMois.toISOString())
    : { count: 0 };
  if ((coversThisMonth ?? 0) >= COVER_QUOTA_PER_MONTH) {
    return json(res, 402, {
      error: {
        code: 'cover_quota',
        message: `Limite mensuelle atteinte (${COVER_QUOTA_PER_MONTH} couvertures).`,
        paywall: true,
      },
    });
  }

  const { data: game, error: gameError } = await db
    .from('games')
    .select('title, genre, resume')
    .eq('id', gameId)
    .eq('user_id', auth.userId)
    .single();
  if (gameError || !game) {
    return json(res, 404, { error: { code: 'not_found', message: 'Partie introuvable' } });
  }

  // Idempotence : pas de double génération (coût), on renvoie l'existante.
  const { data: prologue } = await db
    .from('chapters')
    .select('cover_image_url')
    .eq('game_id', gameId)
    .eq('chapter_number', 0)
    .maybeSingle();
  if (prologue?.cover_image_url) {
    return json(res, 200, { coverImageUrl: prologue.cover_image_url });
  }

  try {
    const coverImageUrl = await generateCoverImage({
      title: game.title,
      genre: game.genre,
      resume: (game.resume as string | null) ?? '',
    });
    await db
      .from('chapters')
      .update({ cover_image_url: coverImageUrl })
      .eq('game_id', gameId)
      .eq('chapter_number', 0);
    return json(res, 200, { coverImageUrl });
  } catch (e) {
    console.error('[cover]', e instanceof Error ? e.message : e);
    return json(res, 500, {
      error: { code: 'cover_failed', message: "La couverture n'a pas pu être générée." },
    });
  }
}