/**
 * Couverture d'un livre : l'image IA (couverture générée à la création) quand
 * elle existe, sinon la couverture frappée (déterministe) en attendant.
 * Cadre obsidienne 1px, ratio 3/4 — l'objet, jamais la machine.
 */
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

/**
 * Couverture d'un livre : l'image IA (réservée Fable+, générée à la création)
 * quand elle existe ; SINON une couverture blanche au titre imprimé — le livre
 * nu, avant sa jaquette.
 */
export function CouvertureLivre({
  titre, coverImageUrl, largeur = 52,
}: { titre: string; coverImageUrl?: string | null; largeur?: number }) {
  const hauteur = Math.round((largeur * 4) / 3);

  if (coverImageUrl) {
    return (
      <View style={[styles.cadre, styles.imageCadre, { width: largeur, height: hauteur }]} accessible={false}>
        <Image source={{ uri: coverImageUrl }} style={styles.image} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={[styles.cadre, styles.blanche, { width: largeur, height: hauteur }]} accessible={false}>
      <Text
        style={[styles.titre, { fontSize: Math.max(6.5, largeur * 0.115) }]}
        numberOfLines={5}
      >
        {titre}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    borderWidth: 1,
    borderColor: colors.text,
    overflow: 'hidden',
  },
  imageCadre: { backgroundColor: colors.background },
  image: { width: '100%', height: '100%' },
  blanche: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '8%',
  },
  titre: {
    fontFamily: fonts.grec,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 1.25,
  },
});