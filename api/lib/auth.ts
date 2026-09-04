/**
 * Vérification de la session JWT côté API.
 * Décode le JWT Supabase et retourne l'uid de l'utilisateur.
 * Utilise la clé JWT_SECRET (JWT secret du projet Supabase).
 */

import type { VercelRequest } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Extrait le Bearer token de la requête. */
export function getAuthToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer (.+)$/i.exec(header);
  return match ? match[1] : null;
}

/** Décode le payload d'un JWT sans vérifier la signature (l'appelant vérifie via Supabase). */
function decodePayload(token: string): { sub?: string; exp?: number; role?: string } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Récupère l'uid de l'utilisateur authentifié.
 * Vérifie la session via l'API auth de Supabase (getUser valide la signature JWT).
 */
export async function requireUserId(req: VercelRequest): Promise<{ userId: string } | { error: string }> {
  const token = getAuthToken(req);
  if (!token) {
    return { error: 'Authentification requise' };
  }

  const db = getDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return { error: 'Session invalide ou expirée' };
  }

  const payload = decodePayload(token);
  if (!payload?.sub || payload.sub !== data.user.id) {
    return { error: 'Session invalide' };
  }

  return { userId: data.user.id };
}

export type AuthResult = ReturnType<typeof requireUserId> extends Promise<infer T> ? T : never;