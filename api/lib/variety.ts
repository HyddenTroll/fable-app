/**
 * VARIÉTÉ & DIVERSITÉ — anti-attracteur.
 * La variété se joue dans les contraintes injectées EN AMONT (tirage
 * d'axes), jamais dans la température. Réf : docs/2-analyse-strategique/
 * variete-diversite-2026.md (banque intégrale fournie par l'utilisateur,
 * 07/09/2026 — extrait opérationnel ci-dessous).
 *
 * Recette par histoire : tirage d'UN vecteur complet injecté dans la
 * génération de la bible. POV = FIXE « tu » (règle utilisateur : la
 * personne narrative est constante, jamais tirée).
 */

// ---------------------------------------------------------------------------
// THÈMES PAR GENRE (extrait de la banque, adapté aux 6 genres de l'app)
// ---------------------------------------------------------------------------
export const THEMES_PAR_GENRE: Record<string, string[]> = {
  fantasy: [
    'un royaume où mentir est physiquement impossible',
    'une dette payable en souvenirs',
    'une carte qui redessine le pays chaque nuit',
    'un dragon devenu comptable',
    'une magie qui coûte des années de vie',
    'une guilde de voleurs de noms',
    'une bibliothèque qui prête des vies',
    'une épée qui refuse de tuer',
    'des sorciers syndiqués en grève',
    'un artisan qui forge des serments',
    'une couronne qui choisit elle-même',
    'une frontière gardée par une chanson',
    'un empire de verre qui craint la pluie',
    'un peuple qui échange sa mémoire chaque solstice',
    'une magie qui ne marche que si on doute',
    'un dieu du quotidien (clés perdues, perruques)',
  ],
  science_fiction: [
    'une colonie qui a oublié la Terre',
    'un implant mémoire d\'occasion',
    'une IA qui démissionne',
    'une monnaie indexée sur l\'oxygène',
    'des clones qui se partagent une seule vie légale',
    'un traducteur universel qui ment un peu',
    'un service de sauvegarde de conscience piraté',
    'un procès pour meurtre d\'une IA',
    'une colonie qui ne peut pas mentir (implant)',
    'une épidémie de nostalgie programmée',
    'un vaisseau dont l\'équipage a été copié',
    'un monde où l\'attention se monnaie littéralement',
    'des jumeaux numériques qui divergent',
    'une planète en procès contre ses colons',
    'une station relais peuplée d\'un seul gardien',
    'des androïdes qui fondent une religion',
  ],
  policier: [
    'un témoin qui se souvient trop tard',
    'un cadavre qui n\'aurait pas dû être là',
    'un alibi parfait qui s\'effrite',
    'un flic qui enquête sur lui-même',
    'une taupe qui a oublié pour qui elle travaille',
    'un braquage qui tourne à l\'enquête morale',
    'un journaliste qui devient la cible',
    'un avocat qui défend qui il déteste',
    'un notaire qui garde trop de testaments',
    'une disparition sur un ferry',
    'un braqueur qui rend l\'argent',
    'un flic qui doit arrêter son mentor',
    'un tueur en série qui prend sa retraite',
    'une victime qui avait tout prévu',
  ],
  horreur: [
    'un cadeau qu\'on ne peut pas refuser',
    'des voisins trop serviables',
    'une maladie qui se transmet par le regard',
    'un miroir qui montre demain',
    'des photos où quelqu\'un se rapproche',
    'un ascenseur avec un étage en trop',
    'un phare dont le gardien ne dort plus',
    'un GPS qui invente des routes',
    'une greffe qui apporte des souvenirs',
    'un jeu de société trouvé dans un grenier',
    'une radio qui capte une station morte',
    'un tunnel routier plus long au retour',
    'une entreprise qui rachète les cauchemars',
    'une kermesse annuelle et son sacrifice',
    'un vieux jeu vidéo qui connaît ton nom',
    'des abeilles qui construisent un visage',
  ],
  historique: [
    'un déserteur qui rentre au village',
    'une correspondance pendant une guerre',
    'un artisan face à l\'arrivée de la machine',
    'une servante qui monte à la ville',
    'un médecin pendant une épidémie',
    'une révolte de paysans',
    'une résistante dans l\'ombre',
    'un instituteur dans un village hostile',
    'une couturière devenue espionne malgré elle',
    'un cheminot dans une grève historique',
    'un imprimeur clandestin',
    'une veuve qui reprend l\'atelier',
    'un télégraphiste qui connaît tous les secrets',
    'une lavandière témoin des secrets du quartier',
  ],
  romance: [
    'deux personnes qui se détestent en public et s\'écrivent en secret',
    'des ex forcés de cohabiter',
    'une correspondance qui ignore les visages',
    'un serveur et un critique gastronomique',
    'un faux couple pour un mariage',
    'une romance par petites annonces',
    'une rencontre lors d\'une panne d\'ascenseur',
    'deux personnes qui gardent le même chien en alternance',
    'un couple qui se rencontre par erreur d\'adresse',
    'une lettre d\'amour livrée trente ans trop tard',
    'deux personnes qui échangent leurs vies un été',
    'une romance de covoiturage régulier',
    'une rencontre pendant une grève de train',
    'deux personnes qui héritent d\'une maison à partager',
  ],
};

// ---------------------------------------------------------------------------
// AXES TRANSVERSAUX (listes complètes de l'étude)
// ---------------------------------------------------------------------------
export const TONS = [
  'sombre', 'tendre', 'drôle', 'sec et minimaliste', 'épique', 'ironique',
  'mélancolique', 'absurde', 'chaleureux', 'âpre et brutal', 'onirique',
  'satirique', 'nostalgique', 'tendu et anxiogène', 'solennel', 'léger et pétillant',
  'grinçant', 'contemplatif', 'survolté', 'doux-amer', 'cynique', 'naïf et candide',
  'fiévreux', 'clinique et détaché', 'exalté', 'résigné', 'espiègle', 'glacial',
];

export const REGISTRES = [
  'oral et rapide, phrases courtes', 'classique et soigné', 'argotique et populaire',
  'technique et précis', 'lyrique', 'familier et chaleureux', 'haché et nerveux',
  'ample et sinueux', 'télégraphique', 'soutenu, presque littéraire', 'cru et direct',
  'poétique retenu',
];

export const LIEUX = [
  'une station orbitale', 'un cargo en pleine mer', 'une cuisine de restaurant en plein coup de feu',
  'un immeuble de banlieue', 'une cour de récréation', 'un train de nuit', 'un désert',
  'une petite ville de province', 'un hôpital la nuit', 'un open space',
  'une station-service isolée', 'une île', 'un marché couvert', 'une prison', 'un internat',
  'une forêt profonde', 'un cirque itinérant', 'un centre commercial vide', 'une mine',
  'un phare', 'une colonie martienne', 'un tribunal', 'un monastère',
  'une caserne de pompiers', 'un aéroport bloqué par la neige', 'un village de montagne',
  'les égouts d\'une capitale', 'un paquebot de croisière', 'une ferme isolée',
  'un data center', 'une bibliothèque interdite', 'un ring de boxe',
  'un plateau de tournage', 'une maison de retraite', 'un festival de musique',
  'un sous-marin', 'une antenne scientifique polaire',
];

export const EPOQUES = [
  'aujourd\'hui', 'proche futur (2040)', 'futur lointain', 'années 1980',
  'Belle Époque', 'Moyen Âge', 'Antiquité romaine', 'XIXe industriel',
  'années folles (1920)', 'futur post-effondrement', 'Renaissance', 'guerre froide',
  'far west (1870)', 'époque indéterminée / atemporelle', 'un passé alternatif steampunk',
  'la préhistoire', '2001, début d\'internet',
];

export const ENJEUX = [
  'survivre', 'être aimé', 'se venger', 'découvrir la vérité', 'protéger quelqu\'un',
  'obtenir de l\'argent', 'sauver sa réputation', 'retrouver la liberté', 'réparer une faute',
  'garder un secret', 'gagner / triompher', 'trouver sa place', 'fuir un passé',
  'tenir une promesse', 'choisir entre deux loyautés', 'survivre à soi-même',
  'restaurer la justice', 'échapper à une dette', 'conquérir le pouvoir',
  'simplement rentrer chez soi',
];

export const GABARITS_TITRE = [
  'UN SEUL nom commun concret, sans article (ex. « Rouille », « Cendres »)',
  'un prénom ou nom propre seul (ex. « Mardi », « Sornat »)',
  'une phrase complète, orale (ex. « Personne ne descend deux fois »)',
  'un objet trivial du quotidien (ex. « Le chargeur », « La liste de courses »)',
  'un titre ironique ou comique (ex. « Tout va très bien »)',
  'un chiffre ou une heure (ex. « 4 h 12 », « Chambre 9 »)',
  'deux mots qui claquent, sans lien évident (ex. « Verre pilé »)',
  'un impératif (ex. « Ne réponds pas »)',
  'un lieu réel précis (ex. « Sortie 14 », « Quai 3 »)',
  'un métier ou un rôle (ex. « La remplaçante », « Le veilleur »)',
];

export const TWISTS = [
  'le narrateur ment (peu fiable)',
  'tout se passe en une seule nuit',
  'raconté à rebours',
  'un compte à rebours visible dès le début',
  'le personnage secondaire est le vrai moteur',
  'une contrainte de lieu unique (huis clos)',
  'une révélation change le sens de tout au milieu',
  'deux fils temporels qui se rejoignent',
  'un objet passe de main en main',
  'le protagoniste est l\'antagoniste sans le savoir',
  'une règle du monde imposée et jamais violée',
  'le héros veut échouer',
  'une saison entière traversée',
  'un seul lieu vu à trois époques',
  'le vrai enjeu n\'est révélé qu\'au dernier tiers',
];

// ---------------------------------------------------------------------------
// PROFILS D'AUTEUR — le STYLE est une variable tirée, jamais une constante.
// Chaque profil définit un phrasé, une manière de dialoguer, une sensibilité.
// ---------------------------------------------------------------------------
export interface ProfilAuteur {
  nom: string;
  consigne: string;
}

export const PROFILS_AUTEURS: ProfilAuteur[] = [
  {
    nom: 'L\'ironiste sec',
    consigne: 'Phrases nerveuses et justes, humour froid qui ne se signale jamais. Les sentiments s\'expriment par ce qui n\'est PAS dit. Descriptions brèves mais précises, une image forte par scène. Les dialogues claquent : répliques courtes, refus de répondre, silences qui comptent. Jamais d\'émotion déclarée — elle se lit dans un geste, un objet, une habitude.',
  },
  {
    nom: 'La lyrique du quotidien',
    consigne: 'La beauté se cache dans les détails ordinaires : une habitude, un objet usé, une lumière de fin d\'après-midi. Métaphores mesurées, jamais ornementales. Chaleur et tendresse même dans la dureté. Dialogues simples et vrais, qui avancent la relation plus que l\'intrigue. Le chapitre respire : des pauses, des regards, du temps qui passe.',
  },
  {
    nom: 'Le brutal réaliste',
    consigne: 'La chair avant tout : le froid, l\'effort, la fatigue, l\'odeur. Phrases courtes, coupantes, sans poésie. Les sentiments sont décrits comme des faits physiologiques. Dialogues directs, brutaux, sans détour. Zéro sentimentalisme, zéro métaphore gratuite : chaque image doit servir la réalité physique de la scène.',
  },
  {
    nom: 'L\'onirique lent',
    consigne: 'La langue ample et flottante ; le réel dérive imperceptiblement vers l\'étrange sans jamais le nommer. Phrases longues, musique, images qui se déploient. Les dialogues sont rares et précieux, comme arrachés à un rêve. Le temps n\'avance pas de façon linéaire : il s\'épaissit, ralentit, revient. Le lecteur doit ressentir plus qu\'il ne comprend.',
  },
  {
    nom: 'La classique ample',
    consigne: 'La phrase équilibrée du grand roman réaliste : subordination maîtrisée, regard social, ironie douce sur les conventions. Descriptions amples et organisées, personnages saisis par leurs manies et leur milieu. Dialogues de salon ou de cuisine, toujours en sous-texte. Le style donne de la dignité même aux vies petites.',
  },
  {
    nom: 'L\'oral vivant',
    consigne: 'Le phrasé de la parole : rapide, familier, chaleureux, avec de l\'humour de proximité. Phrases qui se coupent, se reprennent, rigolent. Les dialogues dominent la scène et font avancer l\'action en jaillissant. Descriptions vives et concrètes, comme racontées à un ami. Le lecteur a l\'impression d\'être dans la pièce.',
  },
];

// ---------------------------------------------------------------------------
// LISTE NOIRE DES MOTIFS (anti-cliché) — injectée dans la génération de bible.
// ---------------------------------------------------------------------------
export const MOTIFS_INTERDITS =
  'l\'eau, la noyade, la marée, le lac ou la mer comme motif central ; ' +
  'la mémoire perdue ou l\'amnésie ; les objets sous verre ; la brume ou le brouillard ; ' +
  'les seuils, portes ou passages symboliques ; les villages qui disparaissent ; ' +
  'le vocabulaire « liminal » (seuil, entre-deux, passage). ' +
  'Ces motifs sont surexploités : choisis AUTRE CHOSE, sauf si le thème imposé les exige.';

// ---------------------------------------------------------------------------
// VECTEUR TIRÉ — un seul objet injecté dans la bible, le prologue et les
// chapitres. Stocké dans games.params.variety.
// ---------------------------------------------------------------------------
export interface VecteurVariete {
  theme: string;
  ton: string;
  registre: string;
  lieu: string;
  epoque: string;
  enjeu: string;
  gabaritTitre: string;
  auteur: ProfilAuteur;
  twist?: string;
}

export function piocher<T>(table: readonly T[]): T {
  return table[Math.floor(Math.random() * table.length)];
}

export function tirerVecteur(genre: string): VecteurVariete {
  const themes = THEMES_PAR_GENRE[genre] ?? THEMES_PAR_GENRE.fantasy;
  return {
    theme: piocher(themes),
    ton: piocher(TONS),
    registre: piocher(REGISTRES),
    lieu: piocher(LIEUX),
    epoque: piocher(EPOQUES),
    enjeu: piocher(ENJEUX),
    gabaritTitre: piocher(GABARITS_TITRE),
    auteur: piocher(PROFILS_AUTEURS),
    twist: Math.random() < 1 / 3 ? piocher(TWISTS) : undefined,
  };
}

// ---------------------------------------------------------------------------
// ANTI-DOUBLON TITRES — mémoire inter-livres + vérification serveur.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'au', 'aux', 'sous', 'sur',
  'pour', 'dans', 'avec', 'pas', 'plus', 'que', 'qui', 'ne', 'ce', 'se', 'en', 'à', 'a', 'y',
]);

function motsCles(titre: string): string[] {
  return titre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

/** Vrai si le titre est déjà pris (égalité) ou trop proche (≥ 2 mots-clés communs). */
export function titreTropProche(titre: string, titresConnus: string[]): boolean {
  if (!titresConnus || titresConnus.length === 0) return false;
  const t = titre.trim().toLowerCase();
  if (titresConnus.some((c) => c.trim().toLowerCase() === t)) return true;
  const mots = motsCles(t);
  if (mots.length < 2) return false;
  return titresConnus.some((c) => {
    const cmots = new Set(motsCles(c));
    return mots.filter((m) => cmots.has(m)).length >= 2;
  });
}