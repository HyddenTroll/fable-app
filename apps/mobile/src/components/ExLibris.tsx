/**
 * EX-LIBRIS — la marque personnelle, calculée à l'inscription.
 * La TRACE DE TAILLEUR est dérivée de l'identifiant du compte (FNV-1a, tracé
 * sur une grille 4×3) et ne change JAMAIS. Le MONOGRAMME (deux lettres
 * grecques) vient du pseudo s'il existe, sinon de l'adresse.
 * C'est le seul endroit de l'app où l'ex-libris complet est affiché.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

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

/** Tracé de tailleur : segments sur une grille 4×3, marche aléatoire depuis
 *  un départ tiré — déterministe pour un identifiant donné. */
function trace(id: string): string {
  const COLS = 4, RANGS = 3;
  const r = rng(`marque:${id}`);
  const voisins = (i: number): number[] => {
    const x = i % COLS, y = Math.floor(i / COLS);
    const v: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= RANGS) continue;
        v.push(ny * COLS + nx);
      }
    }
    return v;
  };
  let cur = Math.floor(r() * (COLS * RANGS));
  const nb = 4 + Math.floor(r() * 4);
  const segs: [number, number][] = [];
  const vus = new Set<string>();
  for (let k = 0; k < nb; k++) {
    const v = voisins(cur).filter((j) => !vus.has(`${cur}-${j}`) && !vus.has(`${j}-${cur}`));
    if (!v.length) break;
    const nx = v[Math.floor(r() * v.length)];
    vus.add(`${cur}-${nx}`);
    segs.push([cur, nx]);
    cur = nx;
  }
  const P = 14, pasX = (80 - P * 2) / (COLS - 1), pasY = (102 - P * 2) / (RANGS - 1);
  const pt = (i: number) => ({ x: P + (i % COLS) * pasX, y: P + Math.floor(i / COLS) * pasY });
  return segs.map(([a, b]) => {
    const A = pt(a), B = pt(b);
    return `M${A.x.toFixed(1)} ${A.y.toFixed(1)} L${B.x.toFixed(1)} ${B.y.toFixed(1)}`;
  }).join(' ');
}

const GREG: Record<string, string> = {
  a: 'α', b: 'β', c: 'γ', d: 'δ', e: 'ε', f: 'φ', g: 'γ', h: 'η', i: 'ι', j: 'ι',
  k: 'κ', l: 'λ', m: 'μ', n: 'ν', o: 'ο', p: 'π', q: 'κ', r: 'ρ', s: 'σ', t: 'τ',
  u: 'υ', v: 'β', w: 'ω', x: 'ξ', y: 'υ', z: 'ζ',
};

/** Deux lettres grecques : le pseudo (ou l'adresse) sert de graine. */
export function monogramme(pseudo: string): string {
  const base = (pseudo || 'fable').toLowerCase().replace(/[^a-z0-9]/g, '');
  const l1 = base[0] ?? 'φ';
  const l2 = base[1] ?? base[0] ?? 'α';
  return `${GREG[l1] ?? 'φ'}${GREG[l2] ?? 'σ'}`.toUpperCase();
}

export function ExLibris({ id, pseudo, taille = 106 }: { id: string; pseudo: string; taille?: number }) {
  const hauteur = Math.round((taille * 136) / 106);
  const d = trace(id || pseudo || 'fable');
  const mono = monogramme(pseudo);
  return (
    <View
      style={[styles.cadre, { width: taille, height: hauteur }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={taille} height={hauteur} viewBox="0 0 140 180">
        <Rect x={2} y={2} width={136} height={176} fill="none" stroke={colors.text} strokeWidth={1.6} />
        <Rect x={9} y={9} width={122} height={162} fill="none" stroke={colors.text} strokeWidth={0.9} />
        {/* Ornements d'angles */}
        <Path d="M14 14 H24 V24 H18 V19" fill="none" stroke={colors.text} strokeWidth={1} />
        <Path d="M126 14 H116 V24 H122 V19" fill="none" stroke={colors.text} strokeWidth={1} />
        <Path d="M14 166 H24 V156 H18 V161" fill="none" stroke={colors.text} strokeWidth={1} />
        <Path d="M126 166 H116 V156 H122 V161" fill="none" stroke={colors.text} strokeWidth={1} />
        {/* Marque de tailleur : déterministe, ne change jamais */}
        <Path d={d} transform="translate(28,26)" fill="none" stroke={colors.text} strokeWidth={2.6} strokeLinecap="square" />
        {/* Filet de bronze */}
        <Path d="M34 152 H106" stroke={colors.bronze} strokeWidth={1.4} />
      </Svg>
      {/* Monogramme grec : plaque posée sur le cadre */}
      <Text
        style={[styles.mono, { top: hauteur - 28, maxWidth: taille - 16 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {mono}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    alignSelf: 'center',
    position: 'relative',
  },
  mono: {
    position: 'absolute',
    left: 8,
    right: 8,
    textAlign: 'center',
    color: colors.text,
    fontSize: 19,
    lineHeight: 20,
  },
});