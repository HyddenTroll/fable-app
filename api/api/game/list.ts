import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { handleCorsOPTIONS } from '../../lib/cors';

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * LISTE les histoires de l'utilisateur (sauvegardées automatiquement à
 * chaque génération). Ordonnées de la plus récente à la plus ancienne.
 * Les histoires "supprimées" (soft delete) sont exclues.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return handleCorsOPTIONS(req, res);
  if (req.method !== 'GET') {
    return json(res, 405, { error: { code: 'method_not_allowed', message: 'GET requis' } });
  }

  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }

  const db = getDb();
  const { data: games, error } = await db
    .from('games')
    .select('id, title, genre, hero_name, chapter_count, created_at, status')
    .eq('user_id', auth.userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error) {
    return json(res, 500, { error: { code: 'db_error', message: 'Impossible de lister les histoires' } });
  }

  return json(res, 200, { games: games ?? [] });
}