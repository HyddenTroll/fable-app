/**
 * PROGRESSION MÉANDRE — confirme qu'on a tourné une page.
 * Le motif se grave à vitesse constante (courbe linéaire — une gravure ne
 * ralentit pas) ; la couche du dessus garde la LARGEUR TOTALE et est révélée
 * par un conteneur qui grandit (sinon le motif s'étire au lieu de se graver).
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, fonts } from '@/theme';
import { DUREE, COURBE } from '@/theme/motion';

const MOTIF = '╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗';

function MotifMeandre({ couleur, largeurFixe }: { couleur: string; largeurFixe?: boolean }) {
  return (
    <Text
      style={[styles.motif, { color: couleur }, largeurFixe && styles.motifFixe]}
      numberOfLines={1}
    >
      {MOTIF}
    </Text>
  );
}

export function ProgressionMeandre({ page, total }: { page: number; total: number }) {
  const p = useSharedValue(total > 0 ? page / total : 0);
  const reduit = useReducedMotion();

  useEffect(() => {
    p.value = withTiming(total > 0 ? page / total : 0, {
      duration: reduit ? 0 : DUREE.long,
      easing: COURBE.gravure,
    });
  }, [page, total, reduit]);

  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  return (
    <View style={styles.band} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* non lu, en fond (veine) */}
      <MotifMeandre couleur={colors.surfaceAlt} />
      {/* lu : révélé par le conteneur qui grandit, motif en LARGEUR TOTALE */}
      <Animated.View style={[styles.reveal, style]}>
        <MotifMeandre couleur={colors.text} largeurFixe />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { height: 12, overflow: 'hidden', justifyContent: 'center' },
  motif: { fontFamily: fonts.ia, fontSize: 12, letterSpacing: 2 },
  motifFixe: { width: '100%' },
  reveal: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', justifyContent: 'center' },
});