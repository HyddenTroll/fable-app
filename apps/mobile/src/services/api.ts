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

function apiBase(): string {
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
  state: HeroState;
  freeChaptersRemaining: number | null;
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------

export async function createGame(body: {
  genre: string;
  subGenre?: string;
  difficulty: string;
  chapterLength: string;
  style: string;
  maxChoices: number;
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

// ---------------------------------------------------------------------------
// Streaming SSE (expo/fetch -> ReadableStream)
// ---------------------------------------------------------------------------

export interface ChapterStreamHandlers {
  onText: (delta: string) => void;
  onDone: (done: ChapterDone) => void;
  onError: (err: Error) => void;
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
): Promise<void> {
  const res = await httpFetch(`${apiBase()}/api/game/chapter`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ gameId, playerChoiceIndex, playerChoiceLabel }),
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
        }
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    handlers.onError(e instanceof Error ? e : new Error('Stream interrompu'));
  }
}