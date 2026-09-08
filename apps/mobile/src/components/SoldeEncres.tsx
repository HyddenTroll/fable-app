/**
 * SOLDE D'ENCRES — la DA est formelle : « Supprime les denticules de toute
 * l'application. Le solde s'écrit PARTOUT de la même façon : la pièce + le
 * nombre. Rien d'autre. »
 * Le nombre décrémente unité par unité et saute légèrement quand il change.
 * LA PIÈCE NE BOUGE JAMAIS : c'est une monnaie, pas une récompense de jeu.
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

export function SoldeEncres({ solde }: { solde: number }) {
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

  return (
    <View
      style={styles.row}
      accessibilityLabel={`${affiche} encres`}
      accessible
    >
      <PieceEncre size={15} />
      <Animated.Text style={[styles.chiffre, styleChiffre]}>{affiche}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chiffre: { color: colors.bronze, fontWeight: '600', fontSize: 12, fontFamily: fonts.ia },
});