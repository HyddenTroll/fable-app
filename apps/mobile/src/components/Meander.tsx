/**
 * MEANDRE — motif signature « l'antique qui devient donnée ».
 * Bande de 16px : le méandre grec au trait (obsidienne) se grave selon
 * `progress`, et se pixelise en carrés de 2×2 px lapis vers la droite.
 * Une occurrence MAXIMUM par écran (elle marque une bascule).
 *
 * La couche gravée garde sa LARGEUR TOTALE, révélée par un conteneur qui
 * grandit (pour la version animée, voir ProgressionMeandre).
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
  return (
    <View style={[styles.band, { height }]} pointerEvents="none">
      {/* Couche 1 : le motif en veine (fond) */}
      <Text style={[styles.motif, { color: colors.surfaceAlt }]} numberOfLines={1}>
        {MOTIF}
      </Text>
      {/* Couche 2 : le motif en obsidienne, gravé selon progress (largeur fixe) */}
      <View style={[styles.reveal, { width: `${p * 100}%` }]}>
        <Text style={[styles.motif, { color: colors.text }]} numberOfLines={1}>
          {MOTIF}
        </Text>
      </View>
      {/* Couche 3 : pixelisation lapis (carrés 2×2) vers la droite */}
      <View style={styles.pixelRow}>
        {Array.from({ length: 12 }).map((_, i) => {
          const zone = i / 12;
          const opacity = zone > 0.42 ? 0.5 + (1 - zone) * 0.6 : 0;
          return opacity > 0 ? (
            <View key={i} style={[styles.pixel, { opacity, marginLeft: zone * 8 }]} />
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
  motif: { fontFamily: fonts.ia, fontSize: 13, letterSpacing: 2, width: '100%' },
  reveal: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', justifyContent: 'center' },
  pixelRow: { position: 'absolute', right: 4, top: 5, flexDirection: 'row' },
  pixel: { width: 2, height: 2, backgroundColor: colors.primary },
});