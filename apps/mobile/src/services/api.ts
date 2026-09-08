/**
 * Client API Fable (app mobile).
 * - auth : session Supabase (token) déjà gérée par @/lib/supabase
 * - streaming SSE : expo/fetch (ReadableStream natif) / fetch web
 * - état structuré : reçu du serveur, AFFICHÉ seulement (jamais fusionné
 *   comme source de vérité côté client).
 */

import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
// fetch WHATWG d'Expo : ReadableStream natif sur mobile, standard sur web
import { fetch as expoFetch } from 'expo/fetch';

const isWeb = Platform.OS === 'web';
const httpFetch = isWeb ? globalThis.fetch.bind(globalThis) : expoFetch;

export function apiBase(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'https://fable-app-three.vercel.app';
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  paywall?: boolean;
  constructor(status: number, message: string, code?: string, paywall?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    this.paywall = paywall;
  }
}

// ---------------------------------------------------------------------------
// Types (du serveur)
// ---------------------------------------------------------------------------

export interface ApiGame {
  id: string;
  title: string;
  genre: string;
  sousGenre?: string;
  heroName: string;
  heroTrait?: string;
  status: string;
  chapterCount: number;
  resume: string;
  params: unknown;
}

export interface ApiChapter {
  chapterNumber: number;
  title: string;
  content: string;
  choices: { libelle: string; consequenceResumee: string }[];
  playerChoice?: number | null;
  coverImageUrl?: string | null;
}

export interface ApiCreateResponse {
  gameId: string;
  game: ApiGame;
  chapter: ApiChapter;
  freeChaptersRemaining: number;
  coverPrompt?: string;
}

export interface HeroState {
  blessures: { id: string; quoi: string; depuis: number; grave: boolean; soigne?: boolean }[];
  inventaire: { id: string; objet: string; depuis: number }[];
  pnj: { id: string; nom: string; statut: string; relation: string; depuis: number }[];
  engagements: { id: string; envers: string; quoi: string; depuis: number }[];
  lieu: string;
}

export interface ChapterDone {
  chapter: ApiChapter;
  isEnd: boolean;
  resume: string;
  /** null tant que /finalize n'a pas post-traité le chapitre (le state
   *  courant reste affiché ; le frais arrive avec le chapitre suivant). */
  state: HeroState | null;
  freeChaptersRemaining: number | null;
  costUsd: number;
  /** Télémétrie serveur : T1 réel (début requête → 1er token diffusé). */
  ttftMs?: number | null;
  totalMs?: number | null;
  tokensPerSec?: number | null;
}

// ---------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------

/**
 * POST-TRAITEMENT en arrière-plan d'un chapitre (résumé/état/plan).
 * Fire-and-forget : appelé dès réception du done, sans bloquer l'UI.
 * Idempotent côté serveur (déjà post-traité = no-op) — aucun coût
 * d'appel supplémentaire n'est ajouté par un double déclenchement, le
 * serveur skip avant tout LLM pour un chapitre déjà finalisé.
 */
export async function finalizeGame(gameId: string): Promise<void> {
  try {
    await httpFetch(`${apiBase()}/api/game/finalize`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ gameId }),
      // timeout global (comportement par défaut du fetch)
    });
  } catch (e) {
    // silencieux : le chapitre suivant attendra (poll borné) puis
    // continuera avec l'état précédent (repli dégradé assumé)
    console.warn('[finalize] échec silencieux', gameId, e);
  }
}

/**
 * AMORÇAGE DU CACHE pendant la lecture (fire-and-forget) : rejoue le
 * préfixe stable (system + bible) — cache TTL 5 min maintenu chaud et
 * fonction Vercel chaude entre deux chapitres (le cold start est le cas
 * NOMINAL d'un lecteur lent).
 */
export async function warmGame(gameId: string): Promise<void> {
  try {
    await httpFetch(`${apiBase()}/api/game/warm`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ gameId }),
    });
  } catch {
    // silencieux : un warm raté n'a pas de conséquence visible
  }
}

export async function createGame(body: {
  genre: string;
  subGenre?: string;
  difficulty: string;
  chapterLength: string;
  style: string;
  maxChoices: number;
  narrateur?: 'tu' | 'je' | 'il';
  heroGender?: 'homme' | 'femme';
  age: string;
  heroName?: string;
  heroTrait?: string;
}): Promise<ApiCreateResponse> {
  const res = await httpFetch(`${apiBase()}/api/game/create`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur création', data.error?.code, data.paywall);
  return data as ApiCreateResponse;
}

export async function readGame(gameId: string): Promise<{ game: ApiGame; chapters: ApiChapter[] }> {
  const res = await httpFetch(`${apiBase()}/api/game/read?gameId=${encodeURIComponent(gameId)}`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur lecture', data.error?.code, data.paywall);
  return data;
}

/**
 * Liste les histoires de l'utilisateur (sauvegardées automatiquement).
 * Chaque génération écrit la partie + le chapitre en base.
 */
export async function listGames(): Promise<
  { id: string; title: string; genre: string; heroName: string; chapterCount: number; createdAt: string; status: string; coverImageUrl?: string | null }[]
> {
  const res = await httpFetch(`${apiBase()}/api/game/list`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur liste', data.error?.code, data.paywall);
  return (data.games ?? []).map((g: Record<string, unknown>) => ({
    id: String(g.id),
    title: String(g.title ?? 'Sans titre'),
    genre: String(g.genre ?? ''),
    heroName: String(g.hero_name ?? 'Héros'),
    chapterCount: Number(g.chapter_count ?? 1),
    createdAt: String(g.created_at ?? ''),
    status: String(g.status ?? 'active'),
    coverImageUrl: (g.cover_image_url as string | null) ?? null,
  }));
}

/** Génère la couverture IA du livre (chapitre 0) — idempotente côté serveur. */
export async function generateCover(gameId: string): Promise<string> {
  const res = await httpFetch(`${apiBase()}/api/game/cover`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ gameId }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur couverture', data.error?.code, data.paywall);
  return String(data.coverImageUrl ?? '');
}

/** Statut du compte (Fable+ ?, quotas) — lu côté serveur, jamais local. */
export async function getMe(): Promise<{
  isPremium: boolean;
  premiumLimit: number;
  premiumUsedThisMonth: number;
  freeUsed: number;
}> {
  const res = await httpFetch(`${apiBase()}/api/me`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur profil', data.error?.code);
  return {
    isPremium: Boolean(data.isPremium),
    premiumLimit: Number(data.premiumLimit ?? 0),
    premiumUsedThisMonth: Number(data.premiumUsedThisMonth ?? 0),
    freeUsed: Number(data.freeUsed ?? 0),
  };
}

/** Supprime une histoire (soft delete serveur). */
export async function deleteGame(gameId: string): Promise<void> {
  const res = await httpFetch(`${apiBase()}/api/game/delete`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ gameId }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur suppression', data.error?.code, data.paywall);
}

/** Signale un contenu problématique (obligatoire pour la validation App Store). */
export async function reportGame(gameId: string, message?: string): Promise<void> {
  const res = await httpFetch(`${apiBase()}/api/game/report`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ gameId, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error?.message ?? 'Erreur signalement', data.error?.code, data.paywall);
}

/**
 * Déclenche l'enrichissement de la bible en arrière-plan (bible légère ->
 * bible complète d'architecte). Appelé pendant que le lecteur lit le
 * prologue ; l'erreur est tolérée (la bible légère suffit à jouer).
 */
export async function enrichBible(gameId: string): Promise<void> {
  try {
    const res = await httpFetch(`${apiBase()}/api/game/enrich`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ gameId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, data?.error?.message ?? 'Erreur enrichissement', data?.error?.code, data?.paywall);
    }
  } catch (e) {
    // Silencieux : la partie reste jouable avec la bible légère.
    if (e instanceof ApiError && e.paywall) {
      // Pas de paywall attendu ici ; on ignore.
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming SSE (expo/fetch -> ReadableStream)
// ---------------------------------------------------------------------------

export interface ChapterStreamHandlers {
  onText: (delta: string) => void;
  onDone: (done: ChapterDone) => void;
  onError: (err: Error) => void;
  /** Contenu signalé par la modération (publics jeunes). */
  onModeration?: (info: { message: string }) => void;
  /** Message de préparation (l'écran de génération n'est jamais muet). */
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Lance la génération d'un chapitre en SSE et appelle les handlers.
 * - onText : chaque morceau de texte (machine à écrire)
 * - onDone : chapitre complet + résumé + état structuré
 * - onError : réseau/HTTP/402. Le partiel est JETÉ (rien décompté côté
 *   serveur) - l'app revient au choix précédent.
 */
export async function streamChapter(
  gameId: string,
  playerChoiceIndex: number | null,
  playerChoiceLabel: string | null,
  handlers: ChapterStreamHandlers,
  playerChoiceConsequence: string | null = null,
): Promise<void> {
  const res = await httpFetch(`${apiBase()}/api/game/chapter`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ gameId, playerChoiceIndex, playerChoiceLabel, playerChoiceConsequence }),
    signal: handlers.signal,
  });

  if (res.status === 402) {
    const data = await res.json().catch(() => null);
    handlers.onError(new ApiError(402, data?.error?.message ?? 'Limite atteinte', data?.error?.code, true));
    return;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    handlers.onError(new ApiError(res.status, data?.error?.message ?? `Erreur ${res.status}`, data?.error?.code, data?.paywall));
    return;
  }
  if (!res.body) {
    handlers.onError(new Error('Réponse sans corps'));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse les événements SSE (event: x\ndata: {...}\n\n)
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const eventMatch = /^event: (\w+)/m.exec(rawEvent);
        const dataMatch = /^data: (.+)$/m.exec(rawEvent);
        const event = eventMatch ? eventMatch[1] : 'message';
        const payload = dataMatch ? dataMatch[1] : '';

        if (event === 'text' && payload) {
          const parsed = JSON.parse(payload) as { delta?: string };
          if (parsed.delta) handlers.onText(parsed.delta);
        } else if (event === 'done' && payload) {
          const done = JSON.parse(payload) as ChapterDone;
          finished = true;
          handlers.onDone(done);
        } else if (event === 'error') {
          const parsed = JSON.parse(payload) as { message?: string };
          finished = true;
          handlers.onError(new Error(parsed.message ?? 'Erreur de génération'));
        } else if (event === 'progress' && payload && handlers.onProgress) {
          const parsed = JSON.parse(payload) as { message?: string };
          handlers.onProgress(parsed.message ?? 'Préparation…');
        } else if (event === 'moderation' && payload && handlers.onModeration) {
          const parsed = JSON.parse(payload) as { message?: string };
          handlers.onModeration({ message: parsed.message ?? 'Contenu signalé.' });
        }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    handlers.onError(e instanceof Error ? e : new Error('Stream interrompu'));
  }
}