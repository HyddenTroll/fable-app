/**
 * THÈME CENTRAL FABLE — Direction artistique « Pierre & Lapis »
 * (charte officielle : docs/6-avant-le-code/direction-artistique.md)
 * Fond clair pierre, encre obsidienne, accent lapis (= l'IA),
 * formes carrées (radius 0). Titres Didot / texte Manrope.
 */

export const colors = {
  // Fond / surface
  background: '#E4E2DC', // --pierre
  surface: '#EFEDE7', // pierre éclaircie (cartes, blocs)
  surfaceAlt: '#D8D4CB', // --pierre-2 (zones secondaires, hover)
  border: '#B9B6AC', // bordure douce pierre foncée
  chipSelected: '#E0DED6',

  // Encre / texte
  text: '#101114', // --obsidienne
  textSecondary: '#55565C', // --gris
  textMuted: '#8E8F95', // gris clair (placeholders)
  textBody: '#1a1b1f',

  // Accent = l'IA
  primary: '#2447D6', // --lapis
  primaryDark: '#ffffff', // texte sur bouton lapis (fond lapis -> blanc)

  // Divers
  danger: '#B4442E', // erreurs (brique)
  shadow: '#6B8CFF', // --lapis-halo (halo du fil)
};

export const fonts = {
  grec: 'GFSDidot_400Regular', // Didot — titres (serif grec)
  ia: 'Manrope_400Regular', // Manrope — texte (sans)
  iaMedium: 'Manrope_500Medium',
  iaSemiBold: 'Manrope_600SemiBold',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

/** Formes carrées (DA) : radius 0 partout. */
export const radii = {
  md: 0,
  lg: 0,
  xl: 0,
};

export const typography = {
  chapterTitle: { fontFamily: fonts.grec, fontSize: 24, lineHeight: 30 },
  body: { fontFamily: fonts.ia, fontSize: 17, lineHeight: 27 },
  label: { fontFamily: fonts.iaSemiBold, fontSize: 15 },
  small: { fontFamily: fonts.ia, fontSize: 13 },
};

export const touchTarget = { minHeight: 48 };