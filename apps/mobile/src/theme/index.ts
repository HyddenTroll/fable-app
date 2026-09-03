/**
 * Thème central de l'app - couleurs, espacements, typos.
 * Évite la duplication de styles (performance + cohérence).
 */

export const colors = {
  background: '#101024',
  surface: '#1c1c3a',
  surfaceAlt: '#181830',
  border: '#2c2c5a',
  primary: '#E8B84B',
  primaryDark: '#101024',
  text: '#ffffff',
  textSecondary: '#9a9ab0',
  textMuted: '#6a6a8a',
  textBody: '#e8e8f0',
  chipSelected: '#2a2a50',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radii = {
  md: 10,
  lg: 12,
  xl: 16,
};

export const typography = {
  chapterTitle: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  body: { fontSize: 17, lineHeight: 27 },
  label: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13 },
};

export const touchTarget = { minHeight: 48 };