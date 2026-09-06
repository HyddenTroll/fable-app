/**
 * Bouton principal — DA « Pierre & Lapis ».
 * Formes carrées, encre obsidienne, accent lapis (IA).
 * Variantes : primary (fond lapis, texte blanc) / secondary
 * (transparent, bordure obsidienne, texte obsidienne).
 */

import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.labelSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.lg, // 0 — formes carrées
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: colors.text,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: { color: '#fff', fontFamily: fonts.iaSemiBold, fontSize: 15 },
  labelSecondary: { color: colors.text },
});