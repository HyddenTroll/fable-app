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
      // « Supprimé » ET « en échec » sont invisibles dans la liste.
      .not('status', 'in', '("deleted","failed")')
      .order('created_at', { ascending: false });

    if (error) {
      return json(res, 500, { error: { code: 'db_error', message: 'Impossible de lister les histoires' } });
    }

    // Couvertures (chapitre 0 de chaque jeu) : les livres s'affichent avec leur
    // image IA quand elle existe — un seul aller-retour pour tous.
    const ids = (games ?? []).map((g: { id: string }) => g.id);
    let covers: Record<string, string | null> = {};
    if (ids.length > 0) {
      const { data: prologues } = await db
        .from('chapters')
        .select('game_id, cover_image_url')
        .in('game_id', ids)
        .eq('chapter_number', 0);
      for (const p of prologues ?? []) {
        covers[p.game_id as string] = p.cover_image_url as string | null;
      }
    }

    return json(res, 200, {
      games: (games ?? []).map((g: Record<string, unknown>) => ({
        id: String(g.id),
        title: String(g.title ?? 'Sans titre'),
        genre: String(g.genre ?? ''),
        hero_name: String(g.hero_name ?? ''),
        chapter_count: Number(g.chapter_count ?? 1),
        created_at: String(g.created_at ?? ''),
        status: String(g.status ?? 'active'),
        cover_image_url: covers[String(g.id)] ?? null,
      })),
    });
}