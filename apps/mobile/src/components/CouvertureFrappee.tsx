/**
 * COUVERTURE FRAPPÉE — composée de façon DÉTERMINISTE à partir de
 * (titre + genre) : même livre, même dessin, sur tous les appareils.
 * Aucun asset, aucun stockage, aucune IA : une graine FNV-1a, 3 à 5 bandes
 * tirées parmi cannelures · méandre · denticules · arcades · triglyphes ·
 * vide. UNE seule bande en bronze #8A6A3D, les autres en obsidienne à 70 %.
 * Densité selon le genre. Le lapis est INTERDIT (la couverture est l'objet,
 * pas la machine). L'unique courbe autorisée : les arcades (la niche).
 */
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme';

/** Graine déterministe (FNV-1a) : retourne un générateur pseudo-aléatoire. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1e6) / 1e6;
  };
}

const DENSITE: Record<string, number> = {
  horreur: 1.5, thriller: 1.35, fantastique: 1.2, 'science-fiction': 1.1,
  drame: 1, western: 0.9, romance: 0.85, comédie: 0.7,
};

type Bande = 'can' | 'mea' | 'den' | 'arc' | 'tri' | 'vide';
const TYPES: Bande[] = ['can', 'mea', 'den', 'arc', 'tri', 'vide'];

function BandeFr({
  type, hauteur, accent, r, densite, ech,
}: {
  type: Bande; hauteur: number; accent: boolean; r: () => number; densite: number; ech: number;
}) {
  const c = accent ? colors.bronze : colors.text;
  const o = accent ? 1 : 0.7;
  const largeur = 2 + Math.round(r() * 5 * ech); // largeur d'élément (éch.)
  switch (type) {
    case 'can': {
      const p = Math.max(2, Math.round((2 + r() * 4) * ech / densite));
      return (
        <View style={{ height: hauteur, opacity: o, flexDirection: 'row', gap: 1, overflow: 'hidden' }}>
          {Array.from({ length: 40 }, (_, i) => (
            <View key={i} style={{ width: i % p === 0 ? 1 : 3 * ((i % 3) + 1), backgroundColor: c }} />
          ))}
        </View>
      );
    }
    case 'mea': {
      const s = Math.max(8, Math.round(9 * ech));
      return (
        <Svg height={hauteur} width="100%" opacity={o}>
          <Path
            d={`M0 ${hauteur - 1} H${s * 3} V2 H${s} V${hauteur - 3} H${s * 2} V${hauteur * 0.4}`}
            stroke={c} strokeWidth={1.6} fill="none"
          />
        </Svg>
      );
    }
    case 'den': {
      const n = Math.max(2, Math.round(3 + r() * 5 * densite));
      return (
        <View style={{ height: hauteur, opacity: o, flexDirection: 'row', gap: 1 }}>
          {Array.from({ length: n }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? c : 'transparent' }} />
          ))}
        </View>
      );
    }
    case 'arc': {
      const n = Math.max(1, Math.round(2 + r() * 2 * densite));
      const arc = Math.round(20 * ech);
      return (
        <View style={{ height: hauteur, opacity: o, flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: n }, (_, i) => (
            <View key={i} style={{ flex: 1, borderWidth: 1, borderBottomWidth: 0, borderColor: c, borderTopLeftRadius: arc, borderTopRightRadius: arc }} />
          ))}
        </View>
      );
    }
    case 'tri': {
      const n = Math.max(2, Math.round(2 + r() * 3 * densite));
      return (
        <View style={{ height: hauteur, opacity: o, flexDirection: 'row', gap: 1 }}>
          {Array.from({ length: n }, (_, i) => (
            <View key={i} style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
              <View style={{ flex: 1, backgroundColor: c, opacity: 0.25 }} />
              <View style={{ width: Math.max(2, Math.round(2 * ech)), backgroundColor: c }} />
            </View>
          ))}
        </View>
      );
    }
    default:
      return null;
  }
}

/**
 * Couverture frappée. `largeur` : largeur d'affichage (la hauteur suit le
 * ratio 3/4). `genre` : densité (plus lourd = plus de motifs).
 */
export function CouvertureFrappee({
  titre, genre = 'drame', largeur = 52,
}: { titre: string; genre?: string; largeur?: number }) {
  const hauteur = Math.round((largeur * 4) / 3);
  const r = rng(`${titre}${genre}`);
  const ech = largeur / 52;
  const n = 3 + Math.floor(r() * 3); // 3 à 5 bandes
  const accent = Math.floor(r() * n);
  const densite = DENSITE[genre?.toLowerCase() ?? ''] ?? 1;

  let s: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    s.push(
      <View key={i} style={{ marginBottom: Math.round((2 + r() * 5) * ech) }}>
        <BandeFr
          type={TYPES[Math.floor(r() * TYPES.length)]}
          hauteur={Math.round((4 + r() * 13) * ech)}
          accent={i === accent}
          r={r}
          densite={densite}
          ech={ech}
        />
      </View>,
    );
  }

  return (
    <View
      style={[styles.cadre, { width: largeur, height: hauteur }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {s}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
    overflow: 'hidden',
    paddingTop: Math.round(5 * 0.92),
    paddingHorizontal: Math.round(4 * 0.92),
  },
});