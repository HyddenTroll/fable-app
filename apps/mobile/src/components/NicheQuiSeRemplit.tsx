/**
 * NICHE QUI SE REMPLIT — avancement d'une génération d'image SANS pourcentage.
 * Le balayage (fil de lapis) boucle tant que ça génère ; l'image ne monte
 * qu'À L'ARRIVÉE RÉELLE (jamais sur une durée devinée).
 */
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '@/theme';
import { DUREE, COURBE } from '@/theme/motion';

export function NicheQuiSeRemplit({
  image,
  enCours,
  largeur = 240,
}: {
  image?: string;
  enCours: boolean;
  largeur?: number;
}) {
  const hauteur = (largeur * 4) / 3;
  const remplissage = useSharedValue(0); // 0 → 1 : l'image monte
  const balayage = useSharedValue(1); // 1 → 0 : le fil monte
  const reduit = useReducedMotion();

  useEffect(() => {
    if (!enCours) return;
    balayage.value = withRepeat(
      withTiming(0, { duration: reduit ? 0 : 2400, easing: COURBE.doux }),
      -1,
      false,
    );
  }, [enCours, reduit]);

  useEffect(() => {
    if (!image) return;
    cancelAnimation(balayage);
    remplissage.value = withTiming(1, {
      duration: reduit ? 0 : DUREE.long,
      easing: COURBE.sortie,
    });
  }, [image, reduit]);

  const styleImage = useAnimatedStyle(() => ({ height: hauteur * remplissage.value }));
  const styleFil = useAnimatedStyle(() => ({
    top: hauteur * balayage.value,
    opacity: enCours ? 1 : 0,
  }));

  return (
    <View
      style={[styles.niche, { width: largeur, height: hauteur }]}
      accessibilityLabel={image ? 'Image obtenue' : 'Image en cours de génération'}
      accessible
    >
      {/* Hachures : visibles tant que l'image n'est pas là */}
      <Hachures />
      {/* L'image monte depuis le bas à l'arrivée réelle */}
      {image && (
        <Animated.View style={[styles.imageMask, styleImage]}>
          <Image source={{ uri: image }} style={{ width: largeur, height: hauteur }} resizeMode="cover" />
        </Animated.View>
      )}
      <Animated.View pointerEvents="none" style={[styles.fil, styleFil]} />
    </View>
  );
}

const styles = StyleSheet.create({
  niche: {
    overflow: 'hidden',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.background,
  },
  imageMask: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fil: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});

/** Hachures en vues (pas de repeating-linear-gradient en RN) : bandes fines. */
function Hachures() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 14 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: 2,
            height: 280,
            backgroundColor: colors.surfaceAlt,
            left: i * 14 - 90,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}