/**
 * Couverture d'un livre : l'image IA (couverture générée à la création) quand
 * elle existe, sinon la couverture frappée (déterministe) en attendant.
 * Cadre obsidienne 1px, ratio 3/4 — l'objet, jamais la machine.
 */
import { Image, StyleSheet, View } from 'react-native';
import { CouvertureFrappee } from './CouvertureFrappee';
import { colors } from '@/theme';

export function CouvertureLivre({
  titre, genre, coverImageUrl, largeur = 52,
}: { titre: string; genre?: string; coverImageUrl?: string | null; largeur?: number }) {
  const hauteur = Math.round((largeur * 4) / 3);

  if (coverImageUrl) {
    return (
      <View style={[styles.cadre, { width: largeur, height: hauteur }]} accessible={false}>
        <Image source={{ uri: coverImageUrl }} style={styles.image} resizeMode="cover" />
      </View>
    );
  }
  return <CouvertureFrappee titre={titre} genre={genre} largeur={largeur} />;
}

const styles = StyleSheet.create({
  cadre: {
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});