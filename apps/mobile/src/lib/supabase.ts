/**
 * Client Supabase pour l'app mobile.
 * URL + clé anon exposées (publiques par design).
 * La clé service_role reste uniquement côté API.
 */

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquantes dans .env');
}

const isWeb = Platform.OS === 'web';

/** Stockage de session : SecureStore (natif) sinon localStorage (web).
 * Toutes les opérations sont protégées : si le keychain natif échoue ou
 * pend (cas de certains simulateurs distant comme Appetize), on retombe
 * sur "pas de session" au lieu de bloquer l'app à l'écran de chargement. */
const secureGet = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};
const secureSet = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Ignoré : la session non persistée repartira d'un login.
  }
};
const secureRemove = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignoré.
  }
};

const storage = isWeb
  ? localStorage
  : {
      getItem: secureGet,
      setItem: secureSet,
      removeItem: secureRemove,
    };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isWeb,
  },
});