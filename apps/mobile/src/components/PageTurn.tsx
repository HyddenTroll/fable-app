/**
 * PageTurn — pli de page « livre », avant ET retour, fond toujours plein.
 *
 * Mécanique (fold 2 faces, 60 fps, uniquement des transforms) :
 * - le pli se forme à la position du doigt, la partie droite de la page
 *   pivote en rotateY autour de son bord gauche (perspective) ;
 * - le volet a DEUX faces : recto = la page courante (deuxième moitié),
 *   verso (pré-rotaté 180°) = la page vers laquelle on va ;
 * - z0 (dessous) = la page qui sera révélée, PLEINE écran → jamais de trou ;
 * - snap : pli < 45 % → la page revient, sinon rabat complet (withSpring).
 *
 * DIRECTION = état React (rendu toujours cohérent, jamais de « page qui
 * reste » après une annulation) : le geste met à jour dir.value (thread UI)
 * pour le volet et dirS (React) pour le contenu des faces ; l'annulation
 * remet les deux à « avant ».
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { COURBE } from '@/theme/motion';

interface PageTurnProps<T = string> {
  pages: T[];
  /** Même contrat que FlatList renderItem : reçoit {item, index}. */
  renderPage: (info: { item: T; index: number }) => ReactNode;
  onPageChange?: (index: number) => void;
  /** Reset de l'animation quand le chapitre change. */
  chapterKey?: string | number;
  width: number;
  /** Fond derrière le pli (le « livre ») : papier blanc par défaut. */
  backgroundColor?: string;
}

const ROBOT = 1500;

export function PageTurn<T>({
  pages,
  renderPage,
  onPageChange,
  chapterKey,
  width,
  backgroundColor = '#FFFFFF',
}: PageTurnProps<T>) {
  const index = useSharedValue(0);
  const dir = useSharedValue(1); // 1 = avant ; -1 = retour (thread UI)
  const [dirS, setDirS] = useState<1 | -1>(1); // direction vue par le rendu
  const fold = useSharedValue(0); // 0 = fermé ; 1 = rabattu

  const setDirBoth = (s: 1 | -1) => {
    dir.value = s;
    setDirS(s);
  };

  // Reset au changement de chapitre.
  useEffect(() => {
    index.value = 0;
    fold.value = 0;
    dir.value = 1;
    setDirS(1);
    onPageChange?.(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

  // Commit du tournage — exécuté en JS (pas dans un worklet) : le callback de
  // fin d'animation n'est pas fiable partout (web) → on déclenche le commit
  // par un simple délai après le début du rabat.
  const commitJS = (page: number) => {
    index.value = page;
    fold.value = 0;
    dir.value = 1;
    setDirS(1);
    onPageChange?.(page);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart((e) => {
      const canBack = index.value > 0;
      const canForward = index.value < pages.length - 1;
      if (e.x < width * 0.5 ? canBack : canForward) {
        // Le pli se forme À L'ENDROIT DU DOIGT, dans la direction possible.
        const s: 1 | -1 = e.x < width * 0.5 && canBack ? -1 : 1;
        if (s !== dir.value) runOnJS(setDirS)(s);
        dir.value = s;
        const raw = 1 - e.x / width;
        fold.value = Math.max(0.05, Math.min(0.95, raw));
      }
    })
    .onUpdate((e) => {
      const raw = 1 - e.x / width;
      fold.value = Math.max(0.02, Math.min(0.98, raw));
    })
    .onEnd(() => {
      const f = fold.value;
      const avant = dir.value === 1;
      // AVANT : valide quand le pli est déployé > 45 %.
      // RETOUR : valide quand le pli s'est refermé < 45 % (le geste retour
      // referme le volet vers la droite — l'ancienne logique exigeait
      // toujours > 45 %, le retour était donc systématiquement annulé).
      const cible = avant
        ? Math.min(index.value + 1, pages.length - 1)
        : Math.max(index.value - 1, 0);
      const valide = avant ? f > 0.45 : f < 0.45;
      if (valide && cible !== index.value) {
        fold.value = withSpring(avant ? 1 : 0, { damping: 18, stiffness: 200 });
        setTimeout(() => commitJS(cible), 340);
        return;
      }
      // Annulation : la page revient ET la direction repasse à « avant ».
      fold.value = withSpring(0, { damping: 18, stiffness: 220 });
      setTimeout(() => {
        if (dir.value === -1) {
          dir.value = 1;
          setDirS(1);
        }
      }, 300);
    });

  const curIdx = index.value;
  const current = pages[curIdx];
  // La page qui plie est TOUJOURS la courante ; ce qui change c'est la page
  // révélée (z0) et le verso du volet.
  const revealed = pages[dirS === 1 ? curIdx + 1 : curIdx]; // dessous
  const verso = pages[dirS === 1 ? curIdx + 1 : curIdx - 1]; // verso du volet
  const revealIdx = dirS === 1 ? curIdx + 1 : curIdx;
  const versoIdx = dirS === 1 ? curIdx + 1 : curIdx - 1;

  // z0 : la page révélée, PLEINE — le fond ne peut jamais être vide.
  const revealedStyle = useAnimatedStyle(() => ({
    opacity: fold.value > 0.01 ? 1 : 0,
  }));

  // Volet : LA PAGE ENTIÈRE, pivotée AUTOUR DU MORS placé TOUT À GAUCHE
  // (la reliure du livre) — la page se lève comme une porte et sort par la
  // gauche quand on la tourne ; le texte n'est jamais scindé.
  const flapStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: 0 },
        { perspective: ROBOT },
        { rotateY: `${-180 * fold.value}deg` },
      ],
    };
  });

  // Recto (la courante) : visible tant que le pli n'a pas dépassé 50 %.
  const rectoStyle = useAnimatedStyle(() => ({
    opacity: fold.value < 0.5 ? 1 : 0,
  }));

  // Verso (la page vers laquelle on va) : apparaît après mi-course.
  const versoStyle = useAnimatedStyle(() => ({
    opacity: fold.value > 0.5 ? 1 : 0,
  }));

  // Ombrage du pli : fondu sur le bord du volet qui soulève.
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: 0.05 + 0.1 * fold.value,
  }));

  // OMBRE DU MORS : cannelure verticale au centre (la charnière de reliure).
  // Presque invisible au repos, elle s'accentue quand la page pivote.
  const morsStyle = useAnimatedStyle(() => ({
    opacity: 0.06 + 0.22 * fold.value,
  }));

  if (pages.length === 0) return null;
  if (pages.length === 1) {
    return <View style={[styles.container, { backgroundColor }]}>{renderPage({ item: pages[0], index: 0 })}</View>;
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.container, { backgroundColor, width }]}>
        {/* z0 : la page révélée (dessous) — toujours pleine écran */}
        {revealed !== undefined && (
          <Animated.View style={[styles.absolute, revealedStyle]}>
            {renderPage({ item: revealed, index: revealIdx })}
          </Animated.View>
        )}

        {/* z1 : la page courante, pleine largeur (à gauche du pli, à plat) */}
        <View style={styles.absolute}>{renderPage({ item: current, index: curIdx })}</View>

        {/* z2 : le VOLET — la partie droite de la courante, pivot au pli */}
        {verso !== undefined && (
          <Animated.View
            style={[styles.absolute, flapStyle, { overflow: 'hidden', transformOrigin: 'left center' }]}
          >
            {/* Recto du volet : la page COURANTE en entier — sa face arrière est
                CACHÉE : au-delà de 90°, seul le verso (la page suivante)
                est visible. */}
            <Animated.View style={[styles.absolute, { backfaceVisibility: 'hidden' }, rectoStyle]}>
              <View style={{ width }}>{renderPage({ item: current, index: curIdx })}</View>
            </Animated.View>
            {/* Verso du volet : la page vers laquelle on va, pré-rotatée 180°
                (visible quand le volet passe au-delà de 90°) */}
            <Animated.View
              style={[
                styles.absolute,
                {
                  transformOrigin: 'left center',
                  backfaceVisibility: 'hidden',
                  transform: [{ rotateY: '180deg' }],
                },
                versoStyle,
              ]}
            >
              <View style={{ width }}>{renderPage({ item: verso, index: versoIdx })}</View>
            </Animated.View>
            {/* Ombrage du pli */}
            <Animated.View style={[styles.shade, shadeStyle, { width: 28 }]} />
          </Animated.View>
        )}

        {/* Ombre du mors : la charnière de reliure TOUT À GAUCHE, discrète au
            repos, marquée quand la page pivote autour. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.mors,
            morsStyle,
            { left: 0 },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#101114',
  },
  mors: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#101114',
  },
});