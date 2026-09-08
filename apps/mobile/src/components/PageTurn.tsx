/**
 * PageTurn — pagination « livre » : la page suit le doigt de l'utilisateur.
 * - AVANT : la page courante pivote autour de son bord gauche (rotateY +
 *   perspective) et révèle la page suivante dessous.
 * - RETOUR : la page précédente se déplie dans l'autre sens (elle part
 *   « rabattue » à -180° et revient à plat), la courante est dessous.
 * - Snap au relâchement : avant 50 % la page revient, après elle finit
 *   de tourner (withSpring, 60 fps sur l'UI thread — le texte ne se
 *   re-layout pas pendant le geste).
 * - Le ScrollView vertical INTERNE des pages coexiste : le pan ne
 *   s'active qu'après 10 px horizontaux et échoue si le geste part en
 *   vertical (failOffsetY) ; les boutons de choix restent cliquables.
 *
 * Structure : 4 couches TOUJOURS rendues, visibilité pilotée sur l'UI
 * thread par (dir, progress) — évite de dépendre d'une sharedValue au
 * moment du rendu React.
 *   L3 (z3) : page courante ....................... tourne vers l'AVANT
 *   L2 (z2) : page précédente (candidate RETOUR) .. se déplie
 *   L1 (z1) : page suivante (candidate AVANT) ..... révélée dessous
 *   L0 (z0) : page courante (sous-couche RETOUR) .. dessous pendant retour
 */
import { useEffect } from 'react';
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

interface PageTurnProps<T = string> {
  pages: T[];
  /** Même contrat que FlatList renderItem : reçoit {item, index}. */
  renderPage: (info: { item: T; index: number }) => ReactNode;
  onPageChange?: (index: number) => void;
  /** Reset de l'animation quand le chapitre change. */
  chapterKey?: string | number;
  width: number;
}

const ROBOT = 1600; // perspective
const SNAP = 0.35; // seuil de bascule au relâchement

export function PageTurn<T>({ pages, renderPage, onPageChange, chapterKey, width }: PageTurnProps<T>) {
  const index = useSharedValue(0);
  const progress = useSharedValue(0); // 0..1 dans la direction courante
  const dir = useSharedValue(1); // 1 = avant ; -1 = retour

  // Reset au changement de chapitre.
  useEffect(() => {
    index.value = 0;
    progress.value = 0;
    dir.value = 1;
    onPageChange?.(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

  const commit = (page: number) => {
    'worklet';
    index.value = page;
    progress.value = 0;
    if (dir.value === -1) dir.value = 1;
    runOnJS(onPageChange ?? (() => {}))(page);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const canBack = index.value > 0;
      const canForward = index.value < pages.length - 1;
      if (e.translationX <= -8 && canForward && (dir.value === 1 || progress.value < 0.4)) {
        dir.value = 1;
        progress.value = Math.max(0, Math.min(1, -e.translationX / width));
      } else if (e.translationX >= 8 && canBack) {
        dir.value = -1;
        progress.value = Math.max(0, Math.min(1, e.translationX / width));
      }
    })
    .onEnd(() => {
      const p = progress.value;
      const forward = dir.value === 1;
      if ((forward && p > SNAP) || (!forward && p > SNAP)) {
        const target = forward ? Math.min(index.value + 1, pages.length - 1) : Math.max(index.value - 1, 0);
        if (target !== index.value) {
          progress.value = withSpring(1, { damping: 17, stiffness: 200 }, (finished) => {
            'worklet';
            if (finished) commit(target);
          });
          return;
        }
      }
      progress.value = withSpring(0, { damping: 17, stiffness: 220 });
    });

  // ---- Couches (rendues à chaque rendu React ; opacités sur UI thread) ----
  const current = pages[index.value];
  const prev = pages[index.value - 1];
  const next = pages[index.value + 1];
  const curIdx = index.value;

  // L3 : la courante (tourne vers l'avant)
  const currentStyle = useAnimatedStyle(() => ({
    opacity: dir.value === 1 ? 1 : 0,
    transform: [{ perspective: ROBOT }, { rotateY: `${-180 * progress.value}deg` }],
  }));

  // L2 : la précédente (se déplie lors du retour) : angle -180 -> 0
  const prevStyle = useAnimatedStyle(() => ({
    opacity: dir.value === -1 ? 1 : 0,
    transform: [{ perspective: ROBOT }, { rotateY: `${-180 + 180 * progress.value}deg` }],
  }));

  // L1 : la suivante (révélée dessous pendant l'avant)
  const nextStyle = useAnimatedStyle(() => ({
    opacity: dir.value === 1 && progress.value > 0.02 ? withTiming(1, { duration: 80 }) : 0,
  }));

  // L0 : la courante (dessous pendant le retour)
  const underCurrentStyle = useAnimatedStyle(() => ({
    opacity: dir.value === -1 ? 1 : 0,
  }));

  if (pages.length === 0) return null;
  if (pages.length === 1) {
    return <View style={styles.container}>{renderPage({ item: pages[0], index: 0 })}</View>;
  }

  const BODY = [{ width }, styles.container];

  return (
    <GestureDetector gesture={pan}>
      <View style={BODY}>
        {/* L1 : suivante (dessous, avant) */}
        {next !== undefined && (
          <Animated.View style={[styles.absolute, nextStyle]}>
            {renderPage({ item: next, index: curIdx + 1 })}
          </Animated.View>
        )}
        {/* L0 : courante sous-couche (dessous, retour) */}
        <Animated.View style={[styles.absolute, underCurrentStyle]}>
          {renderPage({ item: current, index: curIdx })}
        </Animated.View>
        {/* L2 : précédente (candidate retour) */}
        {prev !== undefined && (
          <Animated.View
            style={[styles.absolute, prevStyle, { transformOrigin: 'left center', backfaceVisibility: 'hidden' }]}
          >
            {renderPage({ item: prev, index: curIdx - 1 })}
          </Animated.View>
        )}
        {/* L3 : courante (page qui tourne vers l'avant) */}
        <Animated.View
          style={[styles.absolute, currentStyle, { transformOrigin: 'left center', backfaceVisibility: 'hidden' }]}
        >
          {renderPage({ item: current, index: curIdx })}
        </Animated.View>
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
});