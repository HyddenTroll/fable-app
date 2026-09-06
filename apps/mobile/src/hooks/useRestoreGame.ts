/**
 * Restauration de la partie en cours depuis le serveur (source de vérité).
 *
 * Se déclenche à chaque changement d'identité de la partie (gameId) :
 * - au lancement de l'app, si un currentGame persiste, on rappelle
 *   GET /api/game/read pour RETÉLÉCHARGER tous les chapitres générés.
 * - le garde lastGameIdRef évite de recharger en boucle la même partie.
 *
 * Effets : plus rien n'est perdu après un rechargement de page (web) ou
 * une réouverture (mobile) ; on garde tout ce qui a été généré
 * précédemment, et on nettoie les éventuels chapitres partiels.
 */
import { useEffect, useRef } from 'react';
import { useAppStore } from '../state/store';
import { readGame } from '../services/api';
import type { MockChapter } from '../data/mock';

export function useRestoreGame() {
  const lastGameIdRef = useRef<string | null>(null);
  const gameId = useAppStore((s) => s.currentGame?.gameId ?? null);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  useEffect(() => {
    // Pas de partie, ou déjà restaurée pour cet id : on ne fait rien.
    if (!gameId || lastGameIdRef.current === gameId) return;

    (async () => {
      try {
        const data = await readGame(gameId);
        const chapters: MockChapter[] = (data.chapters ?? [])
          .map((c) => ({
            number: c.chapterNumber,
            title: c.title,
            text: c.content,
            choices: (c.choices ?? []).map((x) => ({
              libelle: x.libelle,
              consequenceResumee: x.consequenceResumee,
            })),
            isEnd:
              (data.game.status === 'finished' && c.chapterNumber === data.game.chapterCount) ||
              (c.choices ?? []).length === 0,
          }))
          .filter((c) => c.text && c.text.length > 0);

        if (chapters.length > 0) {
          const finished = data.game.status === 'finished';
          setCurrentGame({
            gameId: data.game.id,
            title: data.game.title,
            genreLabel: data.game.genre,
            heroName: data.game.heroName || 'Le Héros',
            chapters,
            currentIndex: chapters.length - 1,
            resume: data.game.resume ?? '',
            finished,
            endingType: undefined,
          });
          // La restauration ne touche PAS à heroState : le serveur le
          // renverra avec le prochain chapitre généré.
          lastGameIdRef.current = gameId;
        }
      } catch {
        // Serveur injoignable ou partie disparue : on garde l'état local.
      }
    })();
  }, [gameId, setCurrentGame]);
}
