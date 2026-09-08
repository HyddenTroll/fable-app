import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../lib/auth';
import { handleCorsOPTIONS } from '../lib/cors';
import { getQuota } from '../lib/quota';

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** GET /api/me — statut du compte (Fable+ ?, quotas) pour l'écran Profil. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return handleCorsOPTIONS(req, res);
  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }
  const db = getDb();
  const q = await getQuota(db, auth.userId);
  return json(res, 200, q);
}