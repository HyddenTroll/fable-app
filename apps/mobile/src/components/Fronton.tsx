/**
 * FRONTON — la façade d'un livre (tympan triangulaire sur corniche).
 * Emploi UNIQUE : couverture et écran de fin. Une fois par livre, jamais
 * dans la lecture courante. Décoratif ; le titre reste du texte.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors, fonts } from '@/theme';

interface Props {
  title: string;
}

export function Fronton({ title }: Props) {
  return (
    <View accessibilityElementsHidden={false}>
      <Svg width="100%" height={44} viewBox="0 0 200 44">
        <Polygon points="100,0 200,44 0,44" fill={colors.surfaceAlt} />
      </Svg>
      <View style={styles.corniche} />
      <Text style={styles.titre}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  corniche: { height: 3, backgroundColor: colors.text, marginTop: 3 },
  titre: {
    fontFamily: fonts.grec,
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
    paddingTop: 11,
    paddingHorizontal: 6,
  },
});