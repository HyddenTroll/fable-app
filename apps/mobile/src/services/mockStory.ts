/**
 * Générateur de chapitres MOCK - simule l'IA localement.
 * Produit des chapitres variés selon le genre choisi, avec un
 * délai et un streaming simulé pour tester l'UX de lecture.
 * À remplacer par l'appel à /api/game/chapter quand le backend
 * sera branché.
 */

import type { GameParams, StoryChoice } from '@fable/shared';
import { GENRES } from '../data/mock';
import type { MockChapter } from '../data/mock';

const INTROS: Record<string, string[]> = {
  fantasy: [
    'La brume s’épaississait entre les pins noirs de la Vallée d’Ombre. Le vent portait une odeur de cendre et de fer, comme si un feu ancien venait de se réveiller quelque part sous la montagne.',
    'Les torches du village jetaient des danses orangées sur les murailles. Tu t’étais levé avant l’aube, guidé par un rêve dont tu ne te souvenais déjà plus, mais dont le goût salé restait sur ta langue.',
  ],
  science_fiction: [
    'Le vaisseau dérivait dans le silence de l’espace, tous feux éteints. Sur l’écran, la planète s’étendait comme une blessure ocre, ses dunes striées par un vent qui n’avait pas connu l’eau depuis des siècles.',
    'Dans la cité-cathédrale, les néons clignotaient en cadence. Tu serrais le pendentif que ta mère t’avait laissé — un fragment de cristal froid qui vibrait doucement, comme s’il cherchait à répondre à quelque chose.',
  ],
  policier: [
    'La pluie martelait les vitres du commissariat. Sur le bureau, le dossier n’avait ni nom ni numéro : seulement une photo jaunie, un mot griffonné et la sensation que quelqu’un, quelque part, t’observait.',
    'L’affaire était close depuis six mois. Pourtant, ce matin, une enveloppe anonyme t’attendait sous la porte, contenant une seule clé de cuivre — et la certitude que le coupable n’était pas celui qu’on avait arrêté.',
  ],
  horreur: [
    'La maison se dressait au bout de l’allée, silhouette noire contre un ciel gris. La lettre de ton grand-père disait « ne viens pas ». Tu venais quand même, parce que les lettres d’un mort se refusent rarement.',
    'Le silence n’était pas vraiment un silence. Derrière le battement de ton cœur, tu entendais autre chose : un frottement régulier, comme des pas lents sur un parquet qui aurait dû être vide.',
  ],
  historique: [
    'Paris, 1789. La foule grondait dans les rues, et les effluves de poudre et de pain chaud se mêlaient à l’angoisse. Tu avais une lettre à remettre — une lettre qui pouvait changer le cours des choses.',
    'Sur la route de Compostelle, la poussière collait aux sandales. Le pèlerin avait insisté : « Ne fais confiance à personne avant le prochain relais. » Tu aurais dû écouter.',
  ],
  romance: [
    'La terrasse du café donnait sur le port. Quand il était entré, la lumière avait paru changer — et toi, sans raison, tu avais oublié le livre que tu tenais.',
    'La lettre anonyme était arrivée par un soir d’orage. Une seule phrase, une écriture qui ne t’était pas inconnue : « Rendez-vous au vieux phare, à la marée haute. »',
  ],
};

const BODIES: Record<string, string[]> = {
  fantasy: [
    'Tu avançais prudemment, la main sur la garde de ton épée. À chaque pas, le souvenir des histoires d’autrefois remontait : la prophétie, le roi déchu, l’épée perdue qui devait revenir. Puis, au détour du sentier, tu la vis : la porte de pierre, couverte de runes qui brillaient faiblement dans la pénombre.',
  ],
  science_fiction: [
    'Le scanner bourdonnait, ses lignes bleues dessinant des schémas impossibles. Sur le pont, l’équipage retenait son souffle. Tu savais que chaque décision ici engageait plus que ta vie — elle engageait la seule chance qu’avait l’humanité.',
  ],
  policier: [
    'Tu relus les indices une dernière fois : une empreinte partielle, un billet de train jamais utilisé, un mot barré. La vérité n’était pas loin — elle était même peut-être plus proche que tu ne voulais l’admettre.',
  ],
  horreur: [
    'Tu ne savais pas ce qui était pire : le bruit, ou le silence qui le suivait. La bougie tremblait entre tes doigts, et sur le mur, ton ombre semblait bouger une seconde après toi.',
  ],
  historique: [
    'Tu serrais le message contre ta poitrine. Dans cette ville pleine d’oreilles, chaque mot pouvait être trahi. La rumeur disait que les portes allaient bientôt se fermer, et avec elles, la dernière chance de quitter les lieux.',
  ],
  romance: [
    'Vous vous étiez promis de ne pas vous revoir. Pourtant, à cet instant, tout ce qui comptait se résumait à ce regard, à cette main qui s’approchait, à ce que tu allais enfin oser dire.',
  ],
};

const CHOICES: Record<string, StoryChoice[]> = {
  fantasy: [
    { libelle: 'Ouvrir la porte de pierre aux runes brillantes', consequenceResumee: 'La porte s’ouvre sur un passage secret' },
    { libelle: 'Suivre la lueur au fond du ravin', consequenceResumee: 'Tu découvres un camp abandonné avec des indices' },
    { libelle: 'Faire demi-tour et prévenir le village', consequenceResumee: 'Le village se prépare, mais tu perds du temps' },
    { libelle: 'Invoquer l’esprit de la forêt', consequenceResumee: 'Une entité ancienne accepte de t’aider, à un prix' },
  ],
  science_fiction: [
    { libelle: 'Couper l’alimentation du vaisseau', consequenceResumee: 'Le silence total révèle une source d’énergie cachée' },
    { libelle: 'Répondre au signal inconnu', consequenceResumee: 'Un vaisseau-fantôme prend contact' },
    { libelle: 'Lancer une sonde dans la faille', consequenceResumee: 'La sonde revient avec une carte impossible' },
    { libelle: 'Activer le protocole de cryo-sommeil', consequenceResumee: 'Tu te réveilles 50 ans plus tard' },
  ],
  policier: [
    { libelle: 'Rendre visite au témoin qui refuse de parler', consequenceResumee: 'Il finit par craquer, mais tu es suivi' },
    { libelle: 'Fouiller le bureau du défunt', consequenceResumee: 'Tu trouves un journal codé' },
    { libelle: 'Confronter le suspect principal', consequenceResumee: 'Il t’avoue un secret, mais pas celui que tu cherches' },
    { libelle: 'Tendre un piège dans l’entrepôt', consequenceResumee: 'Le vrai coupable se démasque' },
  ],
  horreur: [
    { libelle: 'Allumer la lampe de poche', consequenceResumee: 'La lumière révèle des marques de griffes récentes' },
    { libelle: 'Suivre la voix qui t’appelle', consequenceResumee: 'Elle te mène à une pièce qui n’existait pas' },
    { libelle: 'Verrouiller la porte et attendre l’aube', consequenceResumee: 'Quelque chose gratte de l’autre côté' },
    { libelle: 'Examiner le miroir fissuré', consequenceResumee: 'Ton reflet est en retard d’une seconde' },
  ],
  historique: [
    { libelle: 'Confier la lettre au cocher de confiance', consequenceResumee: 'La lettre part, mais un espion te suit' },
    { libelle: 'Brûler la lettre et agir toi-même', consequenceResumee: 'Tu prends la place de ton contact' },
    { libelle: 'Chercher le relais secret sous la chapelle', consequenceResumee: 'Tu trouves une cache d’armes et d’argent' },
    { libelle: 'Soudoyer le garde de la porte', consequenceResumee: 'Il accepte, mais il veut plus que de l’argent' },
  ],
  romance: [
    { libelle: 'Avancer vers lui et dire enfin la vérité', consequenceResumee: 'Le silence entre vous se remplit de mots' },
    { libelle: 'Lui écrire un mot et partir', consequenceResumee: 'Il te rattrape au phare' },
    { libelle: 'Feindre l’indifférence', consequenceResumee: 'Il croit que tu ne veux plus le voir' },
    { libelle: 'Lui demander de recommencer à zéro', consequenceResumee: 'Une deuxième chance s’ouvre' },
  ],
};

const ENDINGS: Record<string, { title: string; text: string }[]> = {
  fantasy: [
    { title: 'La couronne restaurée', text: 'Tu posas l’épée sur l’autel, et la lumière ancienne reconnut enfin son héritier. Le royaume, longtemps morcelé, retrouvait un roi — et toi, tu retrouvais un nom. Loin, la prophétie se refermait comme un livre achevé.' },
    { title: 'Le sacrifice de la forêt', text: 'Tu acceptas le prix de l’entité ancienne. La forêt te garda, vivant, mais changé : tes pas ne s’entendaient plus, et les arbres te parlaient à voix basse. Certains disent que le royaume te doit tout. Tu ne réponds plus.' },
  ],
  science_fiction: [
    { title: 'Une nouvelle Terre', text: 'Le vaisseau se posa au matin, sur une planète que nul n’avait cartographiée. Tu coupas les moteurs, ouvris la soute, et la première graine tomba dans une terre qui n’avait jamais connu l’homme. L’histoire recommençait.' },
    { title: 'Le signal silencieux', text: 'Tu compris que le signal venait de toi — un écho de ton propre avenir. Tu désactivas la boucle, et le silence qui suivit fut la plus belle victoire qu’un être ait jamais gagnée.' },
  ],
  policier: [
    { title: 'La vérité éclate', text: 'La clé de cuivre ouvrit un coffre, et le coffre contenait une confession. Le vrai coupable était celui qu’on n’avait jamais soupçonné : celui qui avait tout orchestré depuis le début, protégé par son propre rôle de victime.' },
    { title: 'Le mystère impuni', text: 'Tu avais la vérité, mais pas les preuves. Tu rangeas le dossier, refermas l’enveloppe, et décidas d’attendre. Parfois, la justice n’est qu’une question de patience.' },
  ],
  horreur: [
    { title: 'L’aube', text: 'La porte céda, et ce qui grattait cessa soudain. Le soleil entra, banal et presque cruel. La maison était vide — ou presque. Sur le sol, une seule empreinte, trop grande, qui ne menait nulle part.' },
    { title: 'La maison vous garde', text: 'Tu compris trop tard que la maison n’avait jamais voulu te garder prisonnier. Elle voulait juste un témoin. Une présence. Quelqu’un pour continuer à gratter la nuit, de l’intérieur.' },
  ],
  historique: [
    { title: 'La lettre arrive à destination', text: 'La lettre changea tout. Trois jours plus tard, la ville retenait son souffle : les portes restaient ouvertes, les promesses tenues. Tu avais fait ta part d’histoire, sans jamais le dire à personne.' },
    { title: 'Le prix du silence', text: 'Tu gardas le secret jusqu’au bout. Certains t’en surent gré, d’autres te haïrent. Mais quand les temps changèrent, ils finirent tous par comprendre pourquoi tu avais choisi le silence.' },
  ],
  romance: [
    { title: 'La marée haute', text: 'Au phare, à la marée haute, vous vous retrouvâtes. Pas de grand discours, juste la certitude d’avoir traversé l’orage pour arriver ici, ensemble, au bord de la mer.' },
    { title: 'La deuxième chance', text: 'Tu tendis la main. Il la prit. Ce fut aussi simple, aussi difficile que ça : recommencer, non pas oublier, mais avancer avec ce que vous aviez appris.' },
  ],
};

export function createMockGame(params: GameParams): { gameId: string; title: string; genreLabel: string; prologue: MockChapter } {
  const genre = GENRES.find((g) => g.code === params.genre)!;
  const introPool = INTROS[params.genre] ?? INTROS.fantasy;
  const title = genre.label;

  const prologue: MockChapter = {
    number: 0,
    title: 'Prologue',
    text: introPool[Math.floor(Math.random() * introPool.length)],
    choices: [],
  };

  return {
    gameId: `mock-${Date.now()}`,
    title,
    genreLabel: genre.label,
    prologue,
  };
}

/** Génère le chapitre suivant en fonction du choix précédent. */
export function generateMockChapter(
  params: GameParams,
  chapterNumber: number,
  totalChapters: number,
  lastChoice: string,
): MockChapter {
  const genre = GENRES.find((g) => g.code === params.genre)!;
  const bodyPool = BODIES[params.genre] ?? BODIES.fantasy;
  const choicePool = CHOICES[params.genre] ?? CHOICES.fantasy;
  const endingPool = ENDINGS[params.genre] ?? ENDINGS.fantasy;

  const isLast = chapterNumber >= totalChapters;

  if (isLast) {
    const ending = endingPool[Math.floor(Math.random() * endingPool.length)];
    return {
      number: chapterNumber,
      title: `Chapitre ${chapterNumber} : Le dénouement`,
      text: bodyPool[Math.floor(Math.random() * bodyPool.length)] +
        '\n\n' + ending.text,
      choices: [],
      isEnd: true,
      endingType: ending.title,
    };
  }

  // 2-4 choix selon le paramètre
  const nChoices = Math.min(params.maxChoices, choicePool.length);
  const shuffled = [...choicePool].sort(() => Math.random() - 0.5).slice(0, nChoices);

  return {
    number: chapterNumber,
    title: `Chapitre ${chapterNumber} : La suite de l'aventure`,
    text:
      bodyPool[Math.floor(Math.random() * bodyPool.length)] +
      "\n\nTu repenses à ton dernier choix : « " +
      lastChoice +
      " ». La route s'ouvre devant toi, et l'instant exige une décision.",
    choices: shuffled,
  };
}