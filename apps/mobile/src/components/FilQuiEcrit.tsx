/**
 * FIL QUI ÉCRIT — répond à « est-ce que ça travaille ? » pendant la
 * génération. Se place sous la dernière ligne reçue ; s'arrête net à la fin
 * (pas de fondu de sortie, sinon on croit que ça continue).
 */
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
  cancelAnimation,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/theme';
import { COURBE } from '@/theme/motion';

export function FilQuiEcrit({ actif }: { actif: boolean }) {
  const p = useSharedValue(0);
  const reduit = useReducedMotion();

  useEffect(() => {
    if (!actif || reduit) {
      cancelAnimation(p);
      p.value = 0;
      return;
    }
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 1900, easing: COURBE.doux }), -1, false);
    return () => cancelAnimation(p);
  }, [actif, reduit]);

  const style = useAnimatedStyle(() => ({
    width: `${Math.min(p.value / 0.7, 1) * 100}%`,
    // s'efface sur les 30 derniers pour cent du cycle
    opacity: p.value < 0.7 ? 1 : 1 - (p.value - 0.7) / 0.3,
  }));

  if (!actif) return null;
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[
        {
          height: 1,
          backgroundColor: colors.primary,
          shadowColor: colors.shadow,
          shadowOpacity: 0.9,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}