/**
 * OVES — séparateur de second rang (l'ove et le dard).
 * À n'utiliser QUE si le méandre est déjà pris sur l'écran. Décoratif.
 */
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export function Oves() {
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 9 }).map((_, i) => (
        <View key={i} style={styles.unit}>
          <View style={styles.ove} />
          <View style={styles.dard} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 8 },
  unit: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  ove: {
    width: 10,
    height: 14,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: colors.text,
  },
  dard: { width: 1.2, height: 16, backgroundColor: colors.text, marginLeft: 4 },
});