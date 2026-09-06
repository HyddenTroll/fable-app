/**
 * Client Supabase pour l'app mobile.
 * URL + clé anon exposées (publiques par design).
 * La clé service_role reste uniquement côté API.
 */

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquantes dans .env');
}

const isWeb = Platform.OS === 'web';

/**
 * Stockage de session : AsyncStorage (natif) sinon localStorage (web).
 * AsyncStorage est un stockage fichier standard : il fonctionne sur
 * simulateur iOS et simulateurs distants (Appetize), là où le keychain
 * (SecureStore) est indisponible ou lent - ce qui bloquait le splash et
 * rendait le code verifier PKCE "introuvable" au retour de Google.
 */
const storage = isWeb
  ? localStorage
  : {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isWeb,
    // PKCE pour tous les flux OAuth : Google/Supabase reviennent avec
    // ?code= (échangé ensuite) au lieu de tokens dans le #hash.
    flowType: 'pkce',
  },
});