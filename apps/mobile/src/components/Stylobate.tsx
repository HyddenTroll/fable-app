/**
 * STYLOBATE — les trois marches de la création d'histoire.
 * Encodage : la progression (3 étapes). La marche atteinte est pleine
 * (obsidienne), les autres en veine. Remplace « 2 sur 3 ».
 */
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  step: number; // 1..3 (ou 0..2 selon le mode d'appel)
  total?: number;
}

export function Stylobate({ step, total = 3 }: Props) {
  const current = Math.max(1, Math.min(total, step));
  return (
    <View style={styles.stylobate} accessibilityLabel={`Étape ${current} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const atteinte = i < current;
        return <View key={i} style={[styles.marche, atteinte && styles.atteinte]} />;
      })}
      <View style={styles.assise} />
    </View>
  );
}

const styles = StyleSheet.create({
  stylobate: { width: 120 },
  marche: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: 'auto',
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16,17,20,0.18)',
  },
  atteinte: { backgroundColor: colors.text },
  assise: { height: 3, backgroundColor: colors.text },
});