/**
 * État global de l'app (prototype) - Zustand.
 * Gère : l'âge, la session mock, la partie en cours.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameParams } from '@fable/shared';
import type { MockGameState } from '../data/mock';

interface AppState {
  age: string | null;
  userName: string | null;
  currentGame: MockGameState | null;
  gameParams: GameParams | null;
  setAge: (age: string) => void;
  setUserName: (name: string) => void;
  setCurrentGame: (game: MockGameState | null) => void;
  setGameParams: (params: GameParams | null) => void;
  updateCurrentGame: (updates: Partial<MockGameState>) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      age: null,
      userName: null,
      currentGame: null,
      gameParams: null,
      setAge: (age) => set({ age }),
      setUserName: (userName) => set({ userName }),
      setCurrentGame: (currentGame) => set({ currentGame }),
      setGameParams: (gameParams) => set({ gameParams }),
      updateCurrentGame: (updates) =>
        set((state) => ({
          currentGame: state.currentGame
            ? { ...state.currentGame, ...updates }
            : state.currentGame,
        })),
      reset: () => set({ age: null, userName: null, currentGame: null, gameParams: null }),
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