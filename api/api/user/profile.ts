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

  if (req.method === 'GET') {
    const db = getDb();
    const { data, error } = await db
      .from('profiles')
      .select('id, email, display_name, age, preferences, credits_balance, is_premium, premium_expires_at')
      .eq('id', auth.userId)
      .single();

    if (error || !data) {
      return json(res, 404, { error: { code: 'profile_not_found', message: 'Profil introuvable' } });
    }

    return json(res, 200, {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      age: data.age,
      preferences: data.preferences,
      creditsBalance: data.credits_balance,
      isPremium: data.is_premium,
      premiumExpiresAt: data.premium_expires_at,
    });
  }

  if (req.method === 'PUT') {
    const { age, displayName, preferences } = req.body ?? {};
    const db = getDb();

    const updates: Record<string, unknown> = {};
    if (typeof age === 'string') updates.age = age;
    if (typeof displayName === 'string') updates.display_name = displayName;
    if (preferences && typeof preferences === 'object') updates.preferences = preferences;
    if (Object.keys(updates).length === 0) {
      return json(res, 400, { error: { code: 'bad_request', message: 'Aucun champ à mettre à jour' } });
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', auth.userId)
      .select()
      .single();

    if (error) {
      return json(res, 400, { error: { code: 'update_failed', message: error.message } });
    }

    return json(res, 200, {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      age: data.age,
      preferences: data.preferences,
      creditsBalance: data.credits_balance,
      isPremium: data.is_premium,
    });
  }

  return json(res, 405, { error: { code: 'method_not_allowed', message: 'Méthode non supportée' } });
}