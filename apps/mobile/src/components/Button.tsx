/**
 * Bouton principal réutilisable avec retour tactile (pressed).
 * Taille tactile >= 44px (accessibilité). Styles extraits
 * (perf). Couvre les cas : primaire, secondaire, disabled.
 */

import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme';

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
    minHeight: 48,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.4 },
  label: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  labelSecondary: { color: colors.textBody },
});