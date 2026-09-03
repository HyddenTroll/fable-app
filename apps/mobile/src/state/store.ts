/**
 * État global de l'app (prototype) - Zustand.
 * Gère : l'âge, la session mock, la partie en cours, les crédits.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameParams } from '@fable/shared';
import type { MockGameState } from '../data/mock';

interface AppState {
  age: string | null;
  email: string | null;
  userName: string | null;
  isPremium: boolean;
  credits: number;
  currentGame: MockGameState | null;
  gameParams: GameParams | null;
  setAge: (age: string) => void;
  setEmail: (email: string) => void;
  setUserName: (name: string) => void;
  setPremium: (isPremium: boolean) => void;
  addCredits: (amount: number) => void;
  spendCredits: (amount: number) => boolean;
  setCurrentGame: (game: MockGameState | null) => void;
  setGameParams: (params: GameParams | null) => void;
  updateCurrentGame: (updates: Partial<MockGameState>) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      age: null,
      email: null,
      userName: null,
      isPremium: false,
      credits: 30,
      currentGame: null,
      gameParams: null,
      setAge: (age) => set({ age }),
      setEmail: (email) => set({ email }),
      setUserName: (userName) => set({ userName }),
      setPremium: (isPremium) => set({ isPremium }),
      addCredits: (amount) => set((s) => ({ credits: s.credits + amount })),
      spendCredits: (amount) => {
        const { credits } = get();
        if (credits < amount) return false;
        set({ credits: credits - amount });
        return true;
      },
      setCurrentGame: (currentGame) => set({ currentGame }),
      setGameParams: (gameParams) => set({ gameParams }),
      updateCurrentGame: (updates) =>
        set((state) => ({
          currentGame: state.currentGame
            ? { ...state.currentGame, ...updates }
            : state.currentGame,
        })),
      reset: () =>
        set({
          age: null, email: null, userName: null,
          isPremium: false, credits: 30,
          currentGame: null, gameParams: null,
        }),
    }),
    { name: 'fable-store' },
  ),
);

/** Helper pour connaître les choix possibles du chapitre courant. */
export function useCurrentChapter() {
  const game = useAppStore((s) => s.currentGame);
  if (!game) return null;
  return game.chapters[game.currentIndex] ?? null;
}