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
      { code: 'high', label: 'Haute fantasy', description: 'Mondes imaginaires, épopées de grande ampleur' },
      { code: 'dark', label: 'Fantasy sombre', description: 'Morale sombre, violence, mythologie noire' },
      { code: 'urban', label: 'Fantasy urbaine', description: 'Magie injectée dans un monde moderne' },
      { code: 'low', label: 'Fantasy réaliste', description: 'Une seule touche de magie, le reste réel' },
      { code: 'portal', label: 'Portails', description: 'Un passage vers un autre monde' },
      { code: 'grimdark', label: 'Monde impitoyable', description: 'Un monde cruel, des héros cabossés' },
    ],
  },
  {
    code: 'science_fiction',
    label: 'Science-fiction',
    description: 'Futur, technologie, voyages spatiaux.',
    subGenres: [
      { code: 'space_opera', label: 'Space opéra', description: 'Épopées intergalactiques, grands destins' },
      { code: 'cyberpunk', label: 'Cyberpunk', description: 'Mégalopoles high tech / low life' },
      { code: 'post_apo', label: 'Post-apocalyptique', description: 'Survie après l’effondrement' },
      { code: 'hard_sf', label: 'SF scientifique', description: 'Science rigoureuse, physique réelle' },
      { code: 'dystopie', label: 'Dystopie', description: 'Un futur sous contrôle' },
      { code: 'first_contact', label: 'Premier contact', description: 'La rencontre avec l’autre' },
      { code: 'solarpunk', label: 'Futur soutenable', description: 'Un futur crédible, vivable, sobre' },
    ],
  },
  {
    code: 'policier',
    label: 'Policier / Thriller',
    description: 'Mystère, enquête, suspense.',
    subGenres: [
      { code: 'whodunit', label: 'Enquête', description: 'Qui a commis le crime ?' },
      { code: 'psy', label: 'Thriller psychologique', description: 'Les méandres de l’esprit' },
      { code: 'neo_noir', label: 'Néo-noir', description: 'Ville, amoralité, lumière crue' },
      { code: 'espionnage', label: 'Espionnage', description: 'Réseaux, trahisons, fausses identités' },
      { code: 'juridique', label: 'Judiciaire', description: 'La justice comme terrain de jeu' },
      { code: 'huis_clos', label: 'Huis clos', description: 'Une enquête sans sortie' },
    ],
  },
  {
    code: 'horreur',
    label: 'Horreur',
    description: 'Peur, atmosphère, surnaturel.',
    subGenres: [
      { code: 'paranormal', label: 'Paranormal', description: 'Esprits, possessions, signes' },
      { code: 'psy_horreur', label: 'Psychologique', description: 'La peur vient de l’intérieur' },
      { code: 'survival', label: 'Survie', description: 'Traqué, seul, sans ressource' },
      { code: 'cosmique', label: 'Cosmique', description: 'Horreur indicible et ancienne', adultOnly: true },
      { code: 'slasher', label: 'Traque', description: 'Une menace qui poursuit sans relâche' },
      { code: 'body', label: 'Horreur corporelle', description: 'Le corps qui trahit' },
    ],
  },
  {
    code: 'historique',
    label: 'Historique',
    description: 'Immersions dans une époque passée.',
    subGenres: [
      { code: 'medieval', label: 'Médiéval', description: 'Châteaux, chevaliers, complots' },
      { code: 'renaissance', label: 'Renaissance', description: 'Intrigues et arts italiens' },
      { code: 'antiquite', label: 'Antiquité', description: 'Empires, temples, limes' },
      { code: 'xxe', label: 'XXe siècle', description: 'Guerres, révolutions, mémoire' },
      { code: 'lumieres', label: 'XVIIIe-XIXe siècle', description: 'Salons, révolutions, machines' },
    ],
  },
  {
    code: 'romance',
    label: 'Romance',
    description: 'Rencontres, émotion, connexions.',
    subGenres: [
      { code: 'contemporaine', label: 'Contemporaine', description: 'Amour aujourd’hui' },
      { code: 'historique', label: 'Historique', description: 'Amour dans le passé' },
      { code: 'slow_burn', label: 'À petits feux', description: 'L’amour qui prend son temps' },
      { code: 'enemies_lovers', label: 'De rivaux à amants', description: 'Se détester puis s’aimer' },
      { code: 'second_chance', label: 'Seconde chance', description: 'Se retrouver après la rupture' },
      { code: 'dark_romance', label: 'Romance sombre', description: 'Amour et danger', adultOnly: true },
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
  'curieux',
  'têtu',
  'impulsif',
  'cynique',
  'naïf',
  'méticuleux',
  'charmeur',
  'protecteur',
  'rêveur',
  'franc',
  'méfiant',
  'doux',
  'ambitieux',
  'insouciant',
  'discret',
  'généreux',
  'obstiné',
  'optimiste',
  'anxieux',
  'débrouillard',
  'sensible',
  'joueur',
  'autoritaire',
  'pacifiste',
  'bavard',
  'réservé',
  'orgueilleux',
  'ironique',
] as const;

export const NARRATIVE_STYLES: { code: NarrativeStyle; label: string }[] = [
  { code: 'classique', label: 'Classique' },
  { code: 'sombre', label: 'Sombre' },
  { code: 'humoristique', label: 'Humoristique' },
  { code: 'lyrique', label: 'Lyrique' },
  { code: 'cinematographique', label: 'Cinématographique' },
  { code: 'sobre', label: 'Sobre' },
  { code: 'incisif', label: 'Incisif' },
  { code: 'atmospherique', label: 'Atmosphérique' },
  { code: 'epistolaire', label: 'Épistolaire' },
  { code: 'onirique', label: 'Onirique' },
  { code: 'oral', label: 'Oral' },
  { code: 'epure', label: 'Épuré' },
  { code: 'poetique', label: 'Poétique' },
  { code: 'vif', label: 'Vif' },
];

export const CHAPTER_LENGTHS: { code: ChapterLength; label: string; words: number }[] = [
  { code: 'court', label: 'Court (~1500 mots)', words: 1500 },
  { code: 'moyen', label: 'Moyen (~3000 mots)', words: 3000 },
  { code: 'long', label: 'Long (~5000 mots)', words: 5000 },
];

/** La difficulté règle le VOCABULAIRE, pas le défi : les noms le disent. */
export const DIFFICULTIES = [
  { code: 'facile', label: 'Vocabulaire essentiel', hint: 'Mots simples et directs, phrases courtes' },
  { code: 'moyenne', label: 'Vocabulaire courant', hint: 'Le français de tous les jours, précis' },
  { code: 'difficile', label: 'Vocabulaire riche', hint: 'Mots rares et choisis, phrases amples' },
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