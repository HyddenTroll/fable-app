/**
 * LISTE DE CHOIX — « le choix pris » : la carte touchée s'emplit (140 ms),
 * les autres s'effacent (260 ms), la décision reste seule ~900 ms avant
 * l'appel. C'est la SEULE confirmation — pas de toast, pas de message.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, fonts } from '@/theme';
import { DUREE, COURBE } from '@/theme/motion';

export function ListeDeChoix({ choix, onChoisir }: { choix: string[]; onChoisir: (i: number) => void }) {
  const [pris, setPris] = useState<number | null>(null);
  const reduit = useReducedMotion();

  function choisir(i: number) {
    if (pris !== null) return;
    setPris(i);
    setTimeout(() => onChoisir(i), reduit ? 0 : 900);
  }

  return (
    <>
      {choix.map((c, i) => (
        <CarteChoix key={i} texte={c} index={i} pris={pris} onPress={() => choisir(i)} />
      ))}
    </>
  );
}

function CarteChoix({
  texte,
  index,
  pris,
  onPress,
}: {
  texte: string;
  index: number;
  pris: number | null;
  onPress: () => void;
}) {
  const estPris = pris === index;
  const retire = pris !== null && !estPris;

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(retire ? 0 : 1, { duration: DUREE.moyen, easing: COURBE.sortie }),
    transform: [
      { translateY: withTiming(retire ? -4 : 0, { duration: DUREE.moyen, easing: COURBE.sortie }) },
    ],
    backgroundColor: withTiming(estPris ? colors.text : 'transparent', {
      duration: DUREE.court,
      easing: COURBE.doux,
    }),
  }));

  return (
    <Pressable onPress={onPress} disabled={pris !== null} accessibilityRole="button" accessibilityLabel={texte}>
      <Animated.View style={[styles.carte, style]}>
        <Text style={[styles.texte, estPris && styles.textePris]}>{texte}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderWidth: 1,
    borderColor: colors.text,
    padding: 12,
    marginBottom: 8,
  },
  texte: { color: colors.text, fontSize: 12.5, lineHeight: 18, fontFamily: fonts.ia },
  textePris: { color: colors.background },
});