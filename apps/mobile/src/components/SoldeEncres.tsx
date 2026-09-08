/**
 * SOLDE D'ENCRES — le chiffre décrémente unité par unité et les denticules
 * s'éteignent de droite à gauche : on VOIT les encres partir. La pièce ne
 * s'anime JAMAIS (une monnaie, pas une récompense de jeu mobile).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, fonts } from '@/theme';
import { DUREE, COURBE } from '@/theme/motion';
import { PieceEncre } from '@/components/PieceEncre';

export function SoldeEncres({ solde, denticules = 8 }: { solde: number; denticules?: number }) {
  const [affiche, setAffiche] = useState(solde);
  const saut = useSharedValue(0);
  const reduit = useReducedMotion();

  useEffect(() => {
    if (affiche === solde) return;
    if (reduit) {
      setAffiche(solde);
      return;
    }
    const pas = solde < affiche ? -1 : 1;
    const t = setInterval(() => {
      setAffiche((v) => {
        const suivant = v + pas;
        saut.value = withSequence(
          withTiming(-3, { duration: 70, easing: COURBE.doux }),
          withTiming(0, { duration: 70, easing: COURBE.doux }),
        );
        if (suivant === solde) clearInterval(t);
        return suivant;
      });
    }, 90);
    return () => clearInterval(t);
  }, [solde, reduit]); // eslint-disable-line react-hooks/exhaustive-deps

  const styleChiffre = useAnimatedStyle(() => ({ transform: [{ translateY: saut.value }] }));
  const pleines = Math.min(affiche, denticules);

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${affiche} encres sur ${denticules}`}
      accessible
    >
      <PieceEncre size={13} />
      <Animated.Text style={[styles.chiffre, styleChiffre]}>{affiche}</Animated.Text>
      <View style={styles.dents}>
        {Array.from({ length: denticules }, (_, i) => (
          <Denticule key={i} allumee={i < pleines} />
        ))}
      </View>
    </View>
  );
}

function Denticule({ allumee }: { allumee: boolean }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: withTiming(allumee ? colors.bronze : colors.surfaceAlt, {
      duration: DUREE.moyen,
      easing: COURBE.sortie,
    }),
    transform: [
      { scaleY: withTiming(allumee ? 1 : 0.82, { duration: DUREE.moyen, easing: COURBE.sortie }) },
    ],
  }));
  return <Animated.View style={[styles.dent, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chiffre: { color: colors.bronze, fontWeight: '600', fontSize: 15, fontFamily: fonts.ia },
  dents: { flexDirection: 'row', gap: 4 },
  dent: { width: 9, height: 14, backgroundColor: colors.surfaceAlt },
});