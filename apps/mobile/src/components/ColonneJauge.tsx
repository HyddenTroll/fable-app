/**
 * COLONNE-JAUGE — avancement d'un livre (accueil).
 * Le fût cannelé se remplit PAR LE BAS : la pierre monte à mesure qu'on lit.
 * À l'ouverture de l'accueil, les colonnes montent en cascade (décalage de
 * 80 ms) — UNE SEULE fois par session (flag module) : au retour sur l'écran
 * elles sont déjà pleines, sinon l'animation rejouerait à chaque navigation.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, fonts } from '@/theme';
import { DUREE, COURBE } from '@/theme/motion';

let colonnesAnimees = false; // une seule orchestration par session

interface Props {
  /** Nombre de chapitres lus (détermine la proportion du remplissage). */
  chapters: number;
  /** Nombre de chapitres cible (référence) — défaut 24. */
  total?: number;
  label: string;
  /** Index dans la rangée : décale la montée en cascade. */
  index?: number;
}

export function ColonneJauge({ chapters, total = 24, label, index = 0 }: Props) {
  const ratio = Math.max(0.06, Math.min(1, total > 0 ? chapters / total : 1));
  const reduit = useReducedMotion();
  const h = useSharedValue(colonnesAnimees ? ratio : 0);

  useEffect(() => {
    if (colonnesAnimees) {
      h.value = ratio;
      return;
    }
    colonnesAnimees = true;
    h.value = withDelay(
      reduit ? 0 : 60 + index * 80,
      withTiming(ratio, { duration: reduit ? 0 : DUREE.long, easing: COURBE.sortie }),
    );
  }, [ratio, index, reduit]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));

  return (
    <View style={styles.cj} accessibilityLabel={`${label}, chapitre ${chapters} sur ${total}`} accessible>
      <View style={styles.cap} />
      <View style={styles.fut}>
        {Array.from({ length: 13 }).map((_, i) => (
          <View key={i} style={[styles.cannelure, { left: 3 + i * 4 }]} />
        ))}
        <Animated.View style={[styles.remplissage, style]} />
      </View>
      <View style={styles.base} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cj: { width: 54 },
  cap: { height: 5, backgroundColor: colors.text },
  fut: {
    height: 92,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  cannelure: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(16,17,20,0.12)',
  },
  remplissage: { width: '100%', backgroundColor: colors.text, opacity: 0.82 },
  base: { height: 4, backgroundColor: colors.text, marginTop: 2 },
  label: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 6, fontFamily: fonts.ia },
});