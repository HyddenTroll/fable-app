/**
 * CORS — réponse aux préflights OPTIONS (obligatoire pour les écritures
 * depuis le web : fetch POST avec Authorization + Content-Type déclenche
 * un preflight ; sans réponse OPTIONS correcte, le navigateur bloque).
 */
import type { VercelResponse } from '@vercel/node';

export function corsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return res;
}

/** Traite une requête OPTIONS (preflight). À appeler AVANT la vérif méthode. */
export function handleCorsOPTIONS(req: { method?: string }, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') return false;
  corsHeaders(res);
  res.statusCode = 204;
  res.end();
  return true;
}