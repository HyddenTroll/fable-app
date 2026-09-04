import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUserId, getDb } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireUserId(req);
  if ('error' in auth) {
    return res.status(401).json({ error: { code: 'unauthorized', message: auth.error } });
  }

  if (req.method === 'GET') {
    const db = getDb();
    const { data, error } = await db
      .from('profiles')
      .select('id, email, display_name, age, preferences, credits_balance, is_premium, premium_expires_at')
      .eq('id', auth.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: { code: 'profile_not_found', message: 'Profil introuvable' } });
    }

    return res.status(200).json({
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
      return res.status(400).json({ error: { code: 'bad_request', message: 'Aucun champ à mettre à jour' } });
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', auth.userId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: { code: 'update_failed', message: error.message } });
    }

    return res.status(200).json({
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      age: data.age,
      preferences: data.preferences,
      creditsBalance: data.credits_balance,
      isPremium: data.is_premium,
    });
  }

  return res.status(405).json({ error: { code: 'method_not_allowed', message: 'Méthode non supportée' } });
}