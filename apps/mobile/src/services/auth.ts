/**
 * Service d'authentification basé sur Supabase Auth.
 * Email/password + Google (OAuth).
 * La session est gérée par Supabase (persistée via SecureStore / localStorage).
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type AuthResult =
  | { ok: true; session: Session | null }
  | { ok: false; error: string };

WebBrowser.maybeCompleteAuthSession();

function parseAuthError(message: string | null): string {
  if (!message) return 'Une erreur est survenue.';
  if (message.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (message.includes('already registered')) return 'Un compte existe déjà avec cet email.';
  if (message.includes('Password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (message.includes('User already registered')) return 'Un compte existe déjà avec cet email.';
  return message;
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: parseAuthError(error.message) };
  return { ok: true, session: data.session };
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: parseAuthError(error.message) };
  if (!data.session) {
    // Confirmation d'email requise par défaut
    return {
      ok: true,
      session: null,
    };
  }
  return { ok: true, session: data.session };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const redirectTo = Platform.OS === 'web'
      ? window.location.origin
      : Linking.createURL('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });

    if (error) return { ok: false, error: parseAuthError(error.message) };
    if (!data.url) return { ok: false, error: 'Impossible de lancer Google.' };

    if (Platform.OS === 'web') {
      // L'utilisateur est redirigé par le navigateur
      return { ok: true, session: null };
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      return { ok: false, error: 'Connexion Google annulée.' };
    }
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
    if (sessionError) return { ok: false, error: parseAuthError(sessionError.message) };
    const { data: sessionData } = await supabase.auth.getSession();
    return { ok: true, session: sessionData.session };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inattendue.' };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/** Traite le lien de redirection OAuth (natif) après le callback. */
export async function handleAuthCallbackUrl(url: string): Promise<void> {
  await supabase.auth.exchangeCodeForSession(url);
}

export const authRedirectPath = 'auth/callback';