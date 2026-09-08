import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { handleCorsOPTIONS } from '../../lib/cors';

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * SIGNALEMENT d'un contenu problématique (exigence App Store / confiance).
 * Insère une ligne dans reports ; le texte signalé est laissé à la
 * modération manuelle.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return handleCorsOPTIONS(req, res);
  if (req.method !== 'POST') {
    return json(res, 405, { error: { code: 'method_not_allowed', message: 'POST requis' } });
  }

  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }

  const { gameId, message } = (req.body ?? {}) as { gameId?: string; message?: string };
  if (!gameId) {
    return json(res, 400, { error: { code: 'bad_request', message: 'gameId manquant' } });
  }

  const db = getDb();
  const { error } = await db.from('reports').insert({
    user_id: auth.userId,
    game_id: gameId,
    message: (message ?? '').slice(0, 2000),
  });

  if (error) {
    // La table peut manquer si la migration n'est pas appliquée : ne pas
    // casser le flux pour un signalement.
    return json(res, 200, { ok: true, degraded: true });
  }

  return json(res, 200, { ok: true });
}