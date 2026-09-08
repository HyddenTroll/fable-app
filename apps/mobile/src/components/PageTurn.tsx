/**
 * PageTurn — vrai pli de page « livre » qui suit le doigt.
 *
 * Modèle « fold 2 faces » (comme les flipbooks) :
 * - le pli vertical se forme À LA POSITION DU DOIGT (onStart + onUpdate) :
 *   la partie droite de la page se soulève en pivotant autour du pli ;
 * - le volet a DEUX faces : son recto = la partie droite de la page
 *   courante, son verso (pré-rotaté à 180°) = la page suivante/retour —
 *   quand le volet se rabat au-delà de 90°, le verso apparaît ;
 * - le dessous (z0) = la page révélée PLEINE ÉCRAN : jamais de trou ;
 * - snap au relâchement : pli < 45 % → retour, sinon rabat complet
 *   (withSpring, 60 fps : purement des transforms, aucun re-layout).
 *
 * Contrat identique à l'ancienne version : pages, renderPage({item,index}),
 * onPageChange, chapterKey, width. Uniquement du JS/TS — marche natif et web.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface PageTurnProps<T = string> {
  pages: T[];
  /** Même contrat que FlatList renderItem : reçoit {item, index}. */
  renderPage: (info: { item: T; index: number }) => ReactNode;
  onPageChange?: (index: number) => void;
  /** Reset de l'animation quand le chapitre change. */
  chapterKey?: string | number;
  width: number;
  /** Fond derrière le pli (le « livre ») : couleur pierre par défaut. */
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
  const dir = useSharedValue(1); // 1 = avant ; -1 = retour
  const fold = useSharedValue(0); // 0 = fermé (pli au bord droit) ; 1 = rabattu

  // Reset au changement de chapitre.
  useEffect(() => {
    index.value = 0;
    fold.value = 0;
    dir.value = 1;
    onPageChange?.(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

  const commit = (page: number) => {
    'worklet';
    index.value = page;
    fold.value = 0;
    if (dir.value === -1) dir.value = 1;
    runOnJS(onPageChange ?? (() => {}))(page);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onStart((e) => {
      const canBack = index.value > 0;
      const canForward = index.value < pages.length - 1;
      if (e.x < width * 0.5 ? canBack : canForward) {
        // Le pli se forme À L'ENDROIT DU DOIGT, dans la direction possible.
        dir.value = e.x < width * 0.5 && canBack ? -1 : 1;
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
      if (f > 0.45) {
        const target =
          dir.value === 1 ? Math.min(index.value + 1, pages.length - 1) : Math.max(index.value - 1, 0);
        if (target !== index.value) {
          fold.value = withSpring(1, { damping: 18, stiffness: 200 }, (finished) => {
            'worklet';
            if (finished) commit(target);
          });
          return;
        }
      }
      fold.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const curIdx = index.value;
  const current = pages[curIdx];
  const turning = pages[dir.value === 1 ? curIdx : curIdx - 1]; // page qui plie
  const revealed = pages[dir.value === 1 ? curIdx + 1 : curIdx]; // dessous/verso
  const turnIdx = dir.value === 1 ? curIdx : curIdx - 1;
  const revealIdx = dir.value === 1 ? curIdx + 1 : curIdx;

  // z0 : la page révélée, PLEINE — le fond ne peut jamais être vide.
  const revealedStyle = useAnimatedStyle(() => ({
    opacity: fold.value > 0.01 ? 1 : 0,
  }));

  // Volet (partie droite de la page qui plie) : translateX + rotateY.
  const flapStyle = useAnimatedStyle(() => {
    const flapX = width * (1 - fold.value); // bord gauche du volet = pli
    const angle = -180 * fold.value;
    return {
      transform: [
        { translateX: flapX },
        { perspective: ROBOT },
        { rotateY: `${angle}deg` },
      ],
    };
  });

  // Ombrage du pli : fondu sur le bord du volet qui soulève.
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: 0.05 + 0.1 * fold.value,
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

        {/* z1 : la page qui plie — partie gauche fixe, pleine largeur */}
        {turning !== undefined && (
          <View style={styles.absolute}>{renderPage({ item: turning, index: turnIdx })}</View>
        )}

        {/* z2 : le VELET — la partie droite de « turning », pivot au pli */}
        {turning !== undefined && revealed !== undefined && (
          <Animated.View
            style={[styles.absolute, flapStyle, { overflow: 'hidden', transformOrigin: 'left center' }]}
          >
            {/* Recto du volet : turning, aligné à droite */}
            <View style={[styles.absolute, { alignItems: 'flex-end' }]}>
              <View style={{ width }}>{renderPage({ item: turning, index: turnIdx })}</View>
            </View>
            {/* Verso du volet : revealed, pré-rotaté 180° (visible > 90°) */}
            <View
              style={[
                styles.absolute,
                { transformOrigin: 'left center', backfaceVisibility: 'hidden', transform: [{ rotateY: '180deg' }] },
              ]}
            >
              <View style={{ width }}>{renderPage({ item: revealed, index: revealIdx })}</View>
            </View>
            {/* Ombrage du pli */}
            <Animated.View style={[styles.shade, shadeStyle, { width: 28 }]} />
          </Animated.View>
        )}
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
});