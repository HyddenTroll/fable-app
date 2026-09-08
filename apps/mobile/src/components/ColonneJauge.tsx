/**
 * COLONNE-JAUGE — avancement d'un livre (accueil).
 * Le fût cannelé se remplit PAR LE BAS : la pierre monte à mesure qu'on
 * lit. Les colonnes côte à côte rendent les livres comparables d'un seul
 * regard. Chapiteau + fût (cannelures) + base + titre abrégé.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

interface Props {
  /** Nombre de chapitres lus (détermine la hauteur de remplissage). */
  chapters: number;
  /** Nombre de chapitres cible (référence pour la proportion) — défaut 24. */
  total?: number;
  label: string;
}

export function ColonneJauge({ chapters, total = 24, label }: Props) {
  const ratio = Math.max(0.06, Math.min(1, total > 0 ? chapters / total : 1));
  return (
    <View style={styles.cj} accessibilityLabel={`${label}, chapitre ${chapters} sur ${total}`} accessible>
      <View style={styles.cap} />
      <View style={styles.fut}>
        {[...Array.from({ length: 13 }).map((_, i) => (
          <View key={i} style={[styles.cannelure, { left: 3 + i * 4 }]} />
        ))]}
        <View style={[styles.remplissage, { height: `${Math.round(ratio * 100)}%` }]} />
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