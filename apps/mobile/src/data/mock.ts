/**
 * Données MOCK pour le prototype fonctionnel.
 * Remplace l'API + l'IA tant que le backend n'est pas branché.
 */

import type { Genre, StoryChoice, ChapterLength, NarrativeStyle } from '@fable/shared';

export const GENRES: Genre[] = [
  {
    code: 'fantasy',
    label: 'Fantasy',
    description: 'Magie, créatures mythiques, quêtes épiques.',
    popular: true,
    subGenres: [
      { code: 'high', label: 'High fantasy', description: 'Mondes imaginaires épiques' },
      { code: 'dark', label: 'Dark fantasy', description: 'Morale sombre, violence' },
      { code: 'urban', label: 'Urban fantasy', description: 'Magie dans un monde moderne' },
    ],
  },
  {
    code: 'science_fiction',
    label: 'Science-fiction',
    description: 'Futur, technologie, voyages spatiaux.',
    subGenres: [
      { code: 'space_opera', label: 'Space opera', description: 'Épopées intergalactiques' },
      { code: 'cyberpunk', label: 'Cyberpunk', description: 'Mégalopoles high tech / low life' },
      { code: 'post_apo', label: 'Post-apocalyptique', description: 'Survie après l’effondrement' },
    ],
  },
  {
    code: 'policier',
    label: 'Policier / Thriller',
    description: 'Mystère, enquête, suspense.',
    subGenres: [
      { code: 'whodunit', label: 'Enquête', description: 'Qui a commis le crime ?' },
      { code: 'psy', label: 'Thriller psychologique', description: 'Les méandres de l’esprit' },
    ],
  },
  {
    code: 'horreur',
    label: 'Horreur',
    description: 'Peur, atmosphère, surnaturel.',
    subGenres: [
      { code: 'gothique', label: 'Gothique', description: 'Manoirs et secrets de famille' },
      { code: 'cosmique', label: 'Cosmique', description: 'Horreur indicible et ancienne', adultOnly: true },
    ],
  },
  {
    code: 'historique',
    label: 'Historique',
    description: 'Immersions dans une époque passée.',
    subGenres: [
      { code: 'medieval', label: 'Médiéval', description: 'Châteaux, chevaliers, complots' },
      { code: 'renaissance', label: 'Renaissance', description: 'Intrigues et arts italiens' },
    ],
  },
  {
    code: 'romance',
    label: 'Romance',
    description: 'Rencontres, émotion, connexions.',
    subGenres: [
      { code: 'contemporaine', label: 'Contemporaine', description: 'Amour aujourd’hui' },
      { code: 'historique', label: 'Historique', description: 'Amour dans le passé' },
      { code: 'dark_romance', label: 'Dark romance', description: 'Amour et danger', adultOnly: true },
    ],
  },
];

export const HERO_TRAITS = [
  'courageux',
  'rusé',
  'prudent',
  'audacieux',
  'sarcastique',
  'loyal',
  'solitaire',
] as const;

export const NARRATIVE_STYLES: { code: NarrativeStyle; label: string }[] = [
  { code: 'classique', label: 'Classique' },
  { code: 'sombre', label: 'Sombre' },
  { code: 'humoristique', label: 'Humoristique' },
  { code: 'lyrique', label: 'Lyrique' },
  { code: 'cinematographique', label: 'Cinématographique' },
  { code: 'sobre', label: 'Sobre' },
];

export const CHAPTER_LENGTHS: { code: ChapterLength; label: string; words: number }[] = [
  { code: 'court', label: 'Court (~1500 mots)', words: 1500 },
  { code: 'moyen', label: 'Moyen (~3000 mots)', words: 3000 },
  { code: 'long', label: 'Long (~5000 mots)', words: 5000 },
];

export const DIFFICULTIES = [
  { code: 'facile', label: 'Facile' },
  { code: 'moyenne', label: 'Moyenne' },
  { code: 'difficile', label: 'Difficile' },
];

export const AGE_GROUPS_MOCK = [
  { code: 'under10', label: 'Moins de 10 ans' },
  { code: '10to15', label: '10-15 ans' },
  { code: '16to18', label: '16-18 ans' },
  { code: 'adult', label: '18 ans et plus' },
] as const;

export const ADULT_ONLY_CODES = ['dark', 'cosmique', 'dark_romance'] as const;

export interface MockChapter {
  number: number;
  title: string;
  text: string;
  choices: StoryChoice[];
  isEnd?: boolean;
  endingType?: string;
}

export interface MockGameState {
  gameId: string;
  title: string;
  genreLabel: string;
  heroName: string;
  chapters: MockChapter[];
  currentIndex: number;
  resume: string;
  finished: boolean;
  endingType?: string;
}