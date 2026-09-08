/**
 * Composants de réglage — carrés, jamais de pilules (DA).
 * Interrupteur 38×20, pion 16×14 décalé de 2px : inactif (veine, gauche) /
 * actif (obsidienne, droite). Bascule 140 ms courbe douce.
 * Segments : cadre 1px obsidienne, le bloc actif SE DÉPLACE (140 ms, aucun
 * fondu). Ligne de réglage : filet veine, libellé + sous-ligne, contrôle à
 * droite.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, spacing } from '@/theme';
import { DUREE, COURBE } from '@/theme/motion';

export function Interrupteur({ actif, onToggle }: { actif: boolean; onToggle: () => void }) {
  const p = useSharedValue(actif ? 1 : 0);
  p.value = withTiming(actif ? 1 : 0, { duration: DUREE.court, easing: COURBE.doux });

  const pionStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(actif ? colors.background : colors.surfaceAlt, {
      duration: DUREE.court,
      easing: COURBE.doux,
    }),
    transform: [{ translateX: withTiming(actif ? 18 : 0, { duration: DUREE.court, easing: COURBE.doux }) }],
  }));
  const fondStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(actif ? colors.text : 'transparent', {
      duration: DUREE.court,
      easing: COURBE.doux,
    }),
  }));

  return (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: actif }}
      style={styles.switchZone}
    >
      <Animated.View style={[styles.switch, fondStyle]}>
        <Animated.View style={[styles.pion, pionStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function Segments<T extends string>({
  options, valeur, onChoisir,
}: {
  options: { cle: T; label: string }[];
  valeur: T;
  onChoisir: (cle: T) => void;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.cle === valeur));
  const n = options.length;
  const blocStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(idx * 100, { duration: DUREE.court, easing: COURBE.doux }) },
    ],
  }));
  return (
    <View style={styles.segCadre}>
      <Animated.View
        style={[styles.segBloc, { width: `${100 / n}%` }, blocStyle]}
      />
      {options.map((o) => (
        <TouchableOpacity
          key={o.cle}
          style={[styles.seg, { width: `${100 / n}%` }]}
          onPress={() => onChoisir(o.cle)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.cle === valeur }}
        >
          <Text style={[styles.segTexte, o.cle === valeur && styles.segTexteOn]} numberOfLines={1}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function LigneReglage({
  label, sousLigne, droite, onPress, accessLabel,
}: {
  label: string;
  sousLigne?: string;
  droite?: React.ReactNode;
  onPress?: () => void;
  accessLabel?: string;
}) {
  const contenu = (
    <>
      <View style={styles.ligneG}>
        <Text style={styles.ligneLabel}>{label}</Text>
        {sousLigne ? <Text style={styles.ligneSous} numberOfLines={2}>{sousLigne}</Text> : null}
      </View>
      {droite != null ? <View style={styles.ligneD}>{droite}</View> : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.ligne}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessLabel ?? label}
      >
        {contenu}
      </TouchableOpacity>
    );
  }
  return <View style={styles.ligne}>{contenu}</View>;
}

const styles = StyleSheet.create({
  switchZone: { paddingVertical: 4, paddingLeft: 6 },
  switch: {
    width: 38,
    height: 20,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 0,
    justifyContent: 'center',
  },
  pion: { width: 16, height: 14, marginLeft: 2, marginRight: 0 },
  segCadre: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.text,
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 1,
  },
  segBloc: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.text,
  },
  seg: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segTexte: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.iaMedium },
  segTexteOn: { color: colors.background },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    minHeight: 46,
  },
  ligneG: { flex: 1, minWidth: 0, gap: 2 },
  ligneLabel: { color: colors.text, fontSize: 12.5, fontFamily: fonts.ia },
  ligneSous: { color: colors.textSecondary, fontSize: 10, fontFamily: fonts.ia, lineHeight: 13 },
  ligneD: { flex: 0, alignItems: 'flex-end' },
});