/**
 * MEANDRE — motif signature « l'antique qui devient donnée ».
 * Bande de 16px : le méandre grec au trait (obsidienne) s'efface en dégradé
 * vers la droite et se pixelise en carrés de 2×2 px lapis. Une occurrence
 * MAXIMUM par écran (elle marque une bascule).
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

const MOTIF = '╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗ ╔═╗';

interface Props {
  /** 0 → 1 : le fragment « lu » grave le motif en obsidienne (défaut 1). */
  progress?: number;
  height?: number;
}

export function Meander({ progress = 1, height = 16 }: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const segOk: number[] = [];
  for (let i = 0; i < 16; i++) segOk.push(i / 16 < p ? 1 : 0);
  return (
    <View style={[styles.band, { height }]} pointerEvents="none">
      {/* Couche 1 : le motif en veine (fond) */}
      <Text style={[styles.motif, { color: colors.surfaceAlt }]} numberOfLines={1}>
        {MOTIF}
      </Text>
      {/* Couche 2 : le motif en obsidienne, masqué selon progress */}
      <View style={styles.row}>
        {segOk.map((on, i) => (
          <View key={i} style={styles.seg}>
            <Text style={[styles.motif, { color: colors.text, opacity: on }]} numberOfLines={1}>
              {MOTIF}
            </Text>
          </View>
        ))}
      </View>
      {/* Couche 3 : pixelisation lapis (carrés 2×2) vers la droite */}
      <View style={styles.pixelRow}>
        {Array.from({ length: 14 }).map((_, i) => {
          const zone = i / 14;
          const opacity = zone > 0.45 ? (1 - zone) * 1.4 + 0.15 : 0;
          return opacity > 0 ? (
            <View
              key={i}
              style={[styles.pixel, { opacity, marginLeft: i === 0 ? 0 : 9 + zone * 4 }]}
            />
          ) : null;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    marginVertical: 6,
  },
  row: { position: 'absolute', left: 0, top: 0, flexDirection: 'row' },
  seg: { width: 36, overflow: 'hidden' },
  motif: { fontFamily: fonts.ia, fontSize: 13, letterSpacing: 2 },
  pixelRow: { position: 'absolute', left: 0, top: 5, flexDirection: 'row' },
  pixel: { width: 2, height: 2, backgroundColor: colors.primary },
});