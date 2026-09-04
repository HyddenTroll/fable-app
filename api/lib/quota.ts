/**
 * Quotas serveur (source de vérité, jamais côté client).
 * - 5 chapitres gratuits par utilisateur (toutes parties confondues)
 * - Fable+ : plafond mensuel (premium_chapter_limit)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface QuotaState {
  freeUsed: number;
  isPremium: boolean;
  premiumLimit: number;
  premiumUsedThisMonth: number;
}

const FREE_CHAPTER_LIMIT = 5;

/** Lit l'état de quota actuel de l'utilisateur. */
export async function getQuota(db: SupabaseClient, userId: string): Promise<QuotaState> {
  const { data, error } = await db
    .from('profiles')
    .select('is_premium, premium_chapter_limit, chapters_this_month, chapter_month')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('Profil introuvable pour le quota');
  }

  // Reset mensuel si le mois a changé
  const now = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (data.chapter_month !== now) {
    await db
      .from('profiles')
      .update({ chapters_this_month: 0, chapter_month: now })
      .eq('id', userId);
    return { freeUsed: 0, isPremium: data.is_premium, premiumLimit: data.premium_chapter_limit, premiumUsedThisMonth: 0 };
  }

  // freeUsed = somme des chapitres gratuits déjà consommés (toutes parties)
  const { data: games, error: gamesError } = await db
    .from('games')
    .select('free_chapters_used')
    .eq('user_id', userId);

  const freeUsed = gamesError ? 0 : (games ?? []).reduce((s, g) => s + (g.free_chapters_used ?? 0), 0);

  return {
    freeUsed,
    isPremium: data.is_premium,
    premiumLimit: data.premium_chapter_limit,
    premiumUsedThisMonth: data.chapters_this_month,
  };
}

export type ChapterAccess =
  | { allowed: true }
  | { allowed: false; reason: 'free_limit' | 'premium_limit'; message: string };

/**
 * Autorise la CRÉATION d'une nouvelle partie.
 * Chaque création génère une bible + prologue (coût IA fixe), donc elle
 * consomme un créneau du quota : on bloque si l'essai gratuit est épuisé
 * (sinon spam de bibles gratuites) ou si le plafond Fable+ est atteint.
 */
export function canCreateGame(q: QuotaState): ChapterAccess {
  if (!q.isPremium && q.freeUsed >= FREE_CHAPTER_LIMIT) {
    return {
      allowed: false,
      reason: 'free_limit',
      message: 'Essai gratuit terminé : abonne-toi à Fable+ pour continuer.',
    };
  }
  if (q.isPremium && q.premiumUsedThisMonth >= q.premiumLimit) {
    return {
      allowed: false,
      reason: 'premium_limit',
      message: 'Quota mensuel Fable+ atteint.',
    };
  }
  return { allowed: true };
}

/**
 * Décide si l'utilisateur peut générer un nouveau chapitre.
 * Les chapitres gratuits (ch.1-5) sont offerts ; au-delà il faut Fable+.
 */
export function canGenerateChapter(q: QuotaState, chapterNumber: number): ChapterAccess {
  // ch.0 = prologue = toujours gratuit (déjà consommé à la création)
  if (chapterNumber === 0) return { allowed: true };

  // Le 6e chapitre marque la fin de l'essai gratuit
  if (!q.isPremium && q.freeUsed >= FREE_CHAPTER_LIMIT) {
    return {
      allowed: false,
      reason: 'free_limit',
      message: 'Essai gratuit terminé : abonne-toi à Fable+ pour continuer.',
    };
  }

  if (q.isPremium && q.premiumUsedThisMonth >= q.premiumLimit) {
    return {
      allowed: false,
      reason: 'premium_limit',
      message: 'Quota mensuel Fable+ atteint.',
    };
  }

  return { allowed: true };
}

/** Incrémente le compteur mensuel après génération d'un chapitre (Fable+). */
export async function recordPremiumChapter(db: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await db
    .from('profiles')
    .select('chapters_this_month, chapter_month')
    .eq('id', userId)
    .single();
  if (error || !data) return;

  const now = new Date().toISOString().slice(0, 7);
  const count = data.chapter_month === now ? (data.chapters_this_month ?? 0) + 1 : 1;
  await db
    .from('profiles')
    .update({ chapters_this_month: count, chapter_month: now })
    .eq('id', userId);
}

export { FREE_CHAPTER_LIMIT };