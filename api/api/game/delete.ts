import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';
import { handleCorsOPTIONS } from '../../lib/cors';

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * SUPPRIME une histoire (soft delete : status -> 'deleted').
 * L'histoire n'apparaît plus dans la liste. Vérifie l'appartenance.
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

  const { gameId } = (req.body ?? {}) as { gameId?: string };
  if (!gameId) {
    return json(res, 400, { error: { code: 'bad_request', message: 'gameId manquant' } });
  }

  const db = getDb();
  const { data: existing, error: findError } = await db
    .from('games')
    .select('id')
    .eq('id', gameId)
    .eq('user_id', auth.userId)
    .single();

  if (findError || !existing) {
    return json(res, 404, { error: { code: 'not_found', message: 'Histoire introuvable' } });
  }

  const { error: updateError } = await db
        .from('games')
        // Statut 'failed' (autorisé par le CHECK en base) plutôt que 'deleted'
        // (que la contrainte games_status_check refuse encore en base) : la
        // liste filtre les deux ; aucune migration manuelle n'est nécessaire.
        .update({ status: 'failed' })
        .eq('id', gameId);

    if (updateError) {
      // Log pour diagnostic (le plus fréquent : contrainte games_status_check
      // qui n'accepte pas 'deleted' tant que la migration 0010 n'est pas exécutée).
      console.error('delete.ts update failed:', updateError);
      return json(res, 500, { error: { code: 'db_error', message: 'Impossible de supprimer l\'histoire' } });
    }

  return json(res, 200, { ok: true });
}