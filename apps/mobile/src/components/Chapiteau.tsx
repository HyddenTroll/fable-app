/**
 * CHAPITEAU dorique — ouverture de chapitre (abaque + échine + collier).
 * Encodage : « ce qui porte le texte ». Une seule occurrence : la PREMIÈRE
 * page d'un chapitre ; les pages suivantes n'ont rien au-dessus du texte.
 * Décoratif (accessibilityElementsHidden) ; l'information reste dans le
 * titre de chapitre.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '@/theme';

export function Chapiteau() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Abaque plein */}
      <View style={styles.abaque} />
      {/* Échine évasée (trapèze) */}
      <Svg width="100%" height={12} style={styles.echine}>
        <Polygon points="6,0 94,0 100,100 0,100" fill={colors.surfaceAlt} />
      </Svg>
      {/* Collier */}
      <View style={styles.collier} />
    </View>
  );
}

const styles = StyleSheet.create({
  abaque: { height: 7, backgroundColor: colors.text },
  echine: { marginTop: 0 },
  collier: { height: 2, backgroundColor: colors.text, marginHorizontal: '8%', marginTop: 2 },
});