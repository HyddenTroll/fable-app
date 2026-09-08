/**
 * PIÈCE D'ENCRE — le token. Une seule prop : la taille. Aucun état, aucune
 * variante de couleur : le composant rend toujours la même pièce.
 * Hiérarchie tonale : listel clair, gorge sombre, champ creusé, goutte en
 * relief cernée d'une contre-taille.
 */
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop, ClipPath } from 'react-native-svg';

const HAUT = '#E8C794'; // arête éclairée
const CLAIR = '#C79C61'; // listel
const BASE = '#9A7742'; // demi-teinte
const FONCE = '#5E4623'; // champ
const CREUX = '#3B2B12'; // gorge, contre-taille

const GOUTTE = 'M32 12 C32 12 45 27 45 37 A13 13 0 0 1 19 37 ' + 'C19 27 32 12 32 12 Z';

const PERLES = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2 - Math.PI / 2;
  return { x: 32 + 26.9 * Math.cos(a), y: 32 + 26.9 * Math.sin(a) };
});

export function PieceEncre({ size = 24 }: { size?: number }) {
  const petit = size < 22; // ajustements optiques, même silhouette
  const cerne = petit ? 3 : 2.1;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="encre">
      <Defs>
        <LinearGradient id="lis" x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={HAUT} />
          <Stop offset="0.5" stopColor={CLAIR} />
          <Stop offset="1" stopColor={BASE} />
        </LinearGradient>
        <LinearGradient id="cha" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={FONCE} />
          <Stop offset="1" stopColor={CREUX} />
        </LinearGradient>
        <ClipPath id="cg">
          <Path d={GOUTTE} />
        </ClipPath>
      </Defs>

      {/* tranche : le flan a une épaisseur */}
      <Circle cx="32" cy="33.2" r="30" fill={CREUX} />
      {/* listel : bourrelet de bord, en relief */}
      <Circle cx="32" cy="32" r="30" fill="url(#lis)" />
      <Circle cx="32" cy="32" r="30" fill="none" stroke={CREUX} strokeWidth="1.1" opacity="0.55" />

      {!petit && (
        <G>
          {PERLES.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x + 0.3} cy={p.y + 0.3} r="1.35" fill={CREUX} opacity="0.75" />
              <Circle cx={p.x} cy={p.y} r="1.15" fill={HAUT} opacity="0.9" />
            </G>
          ))}
        </G>
      )}

      {/* gorge : la rainure la plus sombre */}
      <Circle cx="32" cy="32" r="23.4" fill="none" stroke={CREUX} strokeWidth="2.6" />
      {/* champ : creusé, sombre, uniforme */}
      <Circle cx="32" cy="32" r="22.4" fill="url(#cha)" />

      {/* goutte : en relief, cernée */}
      <Path d={GOUTTE} fill={HAUT} stroke={CREUX} strokeWidth={cerne} strokeLinejoin="round" />
      <G clipPath="url(#cg)">
        <Path d={GOUTTE} transform="translate(3.4,3.6)" fill={BASE} opacity="0.62" />
      </G>
    </Svg>
  );
}