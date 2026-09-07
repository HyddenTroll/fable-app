/**
 * LOGOTYPE « Fable » — DA Pierre & Lapis (spécification exacte).
 * - Mot en obsidienne #101114 (Didot 400), SEUL le « b » en lapis #2447D6.
 * - Fil vertical 1px lapis avec halo, centré sur le mot, dépasse en haut
 *   (-30) et en bas (-14) — il traverse le « b ».
 * - Aucune ombre sur le texte, aucun dégradé, aucun arrondi.
 */

import { View, Text, StyleSheet } from 'react-native';
import { fonts } from '@/theme';

export function Logo({ size = 72 }: { size?: number }) {
  return (
    <View style={[styles.logo, { height: size }]} pointerEvents="none">
      <View style={styles.fil} />
      <Text style={[styles.word, { fontSize: size, lineHeight: size, letterSpacing: size * -0.02 }]}>
        Fa<Text style={styles.phi}>b</Text>le
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  word: {
    fontFamily: fonts.grec, // GFS Didot 400
    fontWeight: '400',
    color: '#101114', // obsidienne — F, a, l, e
  },
  phi: {
    color: '#2447D6', // lapis — uniquement le « b »
  },
  fil: {
    position: 'absolute',
    top: -20,
    bottom: -8,
    left: '50%',
    marginLeft: -0.5,
    width: 1,
    backgroundColor: '#2447D6', // lapis
    shadowColor: '#6B8CFF', // halo
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});