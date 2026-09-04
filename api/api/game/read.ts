import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';

function json(res: VercelResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireUserId(req);
  if ('error' in auth) {
    return json(res, 401, { error: { code: 'unauthorized', message: auth.error } });
  }

  const gameId = (req.query.gameId ?? req.query.id) as string | undefined;
  if (!gameId) {
    return json(res, 400, { error: { code: 'bad_request', message: 'gameId requis' } });
  }

  const db = getDb();

  const { data: game, error: gameError } = await db
    .from('games')
    .select('*')
    .eq('id', gameId)
    .eq('user_id', auth.userId)
    .single();

  if (gameError || !game) {
    return json(res, 404, { error: { code: 'not_found', message: 'Partie introuvable' } });
  }

  const { data: chapters, error: chaptersError } = await db
    .from('chapters')
    .select('chapter_number, title, content, choices, player_choice, cover_image_url, created_at')
    .eq('game_id', gameId)
    .order('chapter_number', { ascending: true });

  if (chaptersError) {
    return json(res, 500, { error: { code: 'db_error', message: 'Impossible de lire les chapitres' } });
  }

  return json(res, 200, {
    game: {
      id: game.id,
      title: game.title,
      genre: game.genre,
      sousGenre: game.sous_genre,
      heroName: game.hero_name,
      heroTrait: game.hero_trait,
      status: game.status,
      chapterCount: game.chapter_count,
      resume: game.resume,
      params: game.params,
    },
    chapters,
  });
}