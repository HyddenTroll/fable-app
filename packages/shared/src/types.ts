/**
 * Types métier partagés entre l'app mobile, l'API et les prompts.
 * Référence : docs/6-avant-le-code/decisions-produit.txt
 */

// ---------------------------------------------------------------------------
// Âges & contenu
// ---------------------------------------------------------------------------

export type AgeGroup = 'under10' | '10to15' | '16to18' | 'adult';

export const AGE_GROUPS: { code: AgeGroup; label: string; min: number }[] = [
  { code: 'under10', label: 'Moins de 10 ans', min: 0 },
  { code: '10to15', label: '10-15 ans', min: 10 },
  { code: '16to18', label: '16-18 ans', min: 16 },
  { code: 'adult', label: '18 ans et plus', min: 18 },
];

/** Genres réservés aux adultes (18+) - non proposés aux mineurs */
export const ADULT_ONLY_GENRES = ['dark_fantasy', 'horreur_intense'] as const;

/** Styles réservés aux adultes */
export const ADULT_ONLY_STYLES = ['sombre_extreme'] as const;

// ---------------------------------------------------------------------------
// Genres & sous-genres
// ---------------------------------------------------------------------------

export type GenreCode =
  | 'fantasy'
  | 'science_fiction'
  | 'policier'
  | 'horreur'
  | 'historique'
  | 'romance';

export interface SubGenre {
  code: string;
  label: string;
  description: string;
  adultOnly?: boolean;
}

export interface Genre {
  code: GenreCode;
  label: string;
  description: string;
  /** 45 % des ventes de gamebooks = fantasy (étude de marché) */
  popular?: boolean;
  adultOnly?: boolean;
  subGenres: SubGenre[];
}

// ---------------------------------------------------------------------------
// Personnalisation
// ---------------------------------------------------------------------------

export type Difficulty = 'facile' | 'moyenne' | 'difficile';

export type ChapterLength = 'court' | 'moyen' | 'long';

/** Longueurs en mots (calqué sur le papier) - décisions-produit.txt */
export const CHAPTER_WORDS: Record<ChapterLength, number> = {
  court: 1500,
  moyen: 3000,
  long: 5000,
};

export type NarrativeStyle =
  | 'classique'
  | 'sombre'
  | 'humoristique'
  | 'lyrique'
  | 'cinematographique'
  | 'sobre';

export type HeroTrait =
  | 'courageux'
  | 'rusé'
  | 'prudent'
  | 'audacieux'
  | 'sarcastique'
  | 'loyal'
  | 'solitaire';

export interface GameParams {
  genre: GenreCode;
  subGenre?: string;
  difficulty: Difficulty;
  chapterLength: ChapterLength;
  style: NarrativeStyle;
  maxChoices: 2 | 3 | 4;
  /** Profil de rythme pioché à la création (48 profils informés par
   *  l'étude des best-sellers). Appliqué à tous les chapitres. */
  rythme?: { nom: string; consigne: string };
}

// ---------------------------------------------------------------------------
// Roman / partie
// ---------------------------------------------------------------------------

export interface StoryBible {
  titre: string;
  genre: string;
  sousGenre?: string;
  questionDramatique: string;
  theme: string;
  resumeGeneral: string;
  structure: {
    acte1: string;
    acte2: string;
    acte3: string;
  };
  heros: {
    nom: string;
    desir: string;
    peur: string;
    faille: string;
    /** Désir CONSCIENT vs BESOIN INCONSCIENT (arc charactériel). */
    besoinInconscient?: string;
  };
  antagoniste: {
    nom: string;
    motivation: string;
  };
  personnages: {
    nom: string;
    role: string;
    detail: string;
  }[];
  monde: {
    description: string;
    regles: string;
  };
  finsPossibles: {
    nom: string;
    condition: string;
  }[];
  tonStyle: string;
  /**
   * PLAN DIRECTEUR (v2) : le cap narratif obligatoire.
   * L'IA sait dès le départ où elle emmène le lecteur. Les choix du
   * lecteur changent le CHEMIN, pas la destination. Les vieilles
   * parties (avant la v2) n'ont pas ce champ -> gérer l'absence.
   */
  planDirecteur: PlanDirecteur;
}

/**
 * Plan directeur figé à la création du roman.
 * - destination : où l'histoire emmène le lecteur (la promesse).
 * - noyauImmuable : ce qui ne change jamais, même si le lecteur dévie.
 * - actes : objectif + scènes clés + tournant de fin d'acte.
 * - carrefours : les choix majeurs anticipés (où l'histoire peut dévier).
 * - fins : fins possibles avec LEUR condition d'accès.
 */
export interface PlanDirecteur {
  destination: string;
  noyauImmuable: string[];
  actes: {
    acte: number;
    objectif: string;
    scenesCles: string[];
    tournant: string;
  }[];
  /** Le renversement central de l'acte II (point médian du roman). */
  pointMedian?: string;
  /** UNE sous-intrigue qui se noue et se dénoue en parallèle. */
  sousIntrigue?: string;
  carrefours: {
    chapitre: number;
    enjeu: string;
    options: string;
    consequenceSiDeviation: string;
  }[];
  fins: {
    nom: string;
    condition: string;
    emotionFinale: string;
  }[];
}

/**
 * Grandes lignes évolutives (mémoire du plan) - stockées dans
 * games.story_plan et réécrites par l'IA à chaque tournant.
 * La route s'ajuste, le plan directeur (bible) reste la référence fixe.
 */
export interface StoryPlan {
  grandesLignes: string;
  derniereMiseAJourChapitre: number;
  versQuelleFin: string;
}

export interface StoryChoice {
  libelle: string;
  consequenceResumee: string;
}

export interface Chapter {
  titre: string;
  texte: string;
  choix: StoryChoice[];
}

export interface ChapterResult extends Chapter {
  /** numéro du chapitre (0 = prologue) */
  chapterNumber: number;
  /** type de fin si c'est la fin du roman */
  typeFin?: string;
  epilogue?: string;
}

export interface ChapterRequest {
  gameId: string;
  /** choix choisi par le joueur (index dans chapter.choix) */
  playerChoiceIndex?: number;
  /** "prologue" ou "chapitre" */
  type: 'prologue' | 'chapitre';
}

export interface ChapterResponse {
  chapter: ChapterResult;
  /** résumé courant mis à jour côté serveur */
  resume: string;
  /** si vrai, l'utilisateur a épuisé son quota gratuit */
  paywall?: boolean;
}

// ---------------------------------------------------------------------------
// Crédits & abonnement
// ---------------------------------------------------------------------------

export const CREDITS_PER_IMAGE = 3;

export interface CreditPack {
  credits: number;
  images: number;
  priceEur: number;
  productId: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { credits: 30, images: 10, priceEur: 0.99, productId: 'credits_30' },
  { credits: 100, images: 33, priceEur: 2.49, productId: 'credits_100' },
  { credits: 250, images: 83, priceEur: 5.49, productId: 'credits_250' },
  { credits: 600, images: 200, priceEur: 9.99, productId: 'credits_600' },
];

export interface SubscriptionPlan {
  productId: string;
  label: string;
  priceEur: number;
}

export const FABLE_PLUS_MONTHLY: SubscriptionPlan = {
  productId: 'fable_plus_monthly',
  label: 'Fable+ mensuel',
  priceEur: 4.99,
};

export const FABLE_PLUS_YEARLY: SubscriptionPlan = {
  productId: 'fable_plus_yearly',
  label: 'Fable+ annuel',
  priceEur: 39.99,
};

// ---------------------------------------------------------------------------
// Réponses API
// ---------------------------------------------------------------------------

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface UserProfile {
  id: string;
  age: AgeGroup;
  isPremium: boolean;
  creditsBalance: number;
  displayName?: string;
}

export interface GameSummary {
  id: string;
  title: string;
  genre: GenreCode;
  status: 'active' | 'finished' | 'failed';
  chapterCount: number;
  updatedAt: string;
}