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
      .select('id, email, display_name, age, preferences, is_premium, premium_expires_at')
      .eq('id', auth.userId)
      .single();

    if (error || !data) {
      return json(res, 404, { error: { code: 'profile_not_found', message: 'Profil introuvable' } });
    }

    // Solde = somme des transactions (vue credit_balances), jamais un compteur mutable
    const { data: balanceRows } = await db
      .from('credit_balances')
      .select('balance')
      .eq('user_id', auth.userId);

    const creditsBalance = balanceRows?.[0]?.balance ?? 0;

    return json(res, 200, {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      age: data.age,
      preferences: data.preferences,
      creditsBalance,
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
      isPremium: data.is_premium,
    });
  }

  return json(res, 405, { error: { code: 'method_not_allowed', message: 'Méthode non supportée' } });
}