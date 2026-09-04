/**
 * Prompts IA complets - le cœur de la qualité littéraire.
 * Basé sur docs/6-avant-le-code/prompts-ia.txt et
 * docs/5-ecriture-narrative/*.txt.
 * Sortie TOUJOURS en JSON (sauf chapitre en streaming : texte brut).
 */

import type { AgeGroup, GameParams, StoryBible } from '@fable/shared';
import { AGE_GROUPS } from '@fable/shared';

const ANTI_AI_SLOP = [
  'Écris en français naturel et soigné, comme un écrivain confirmé. Évite les tournures typiques de l\'IA.',
  'Interdit : les formules creuses ("dans un monde où...", "il était une fois un jeune homme destiné à..."), les superlatifs vides, les répétitions, le vocabulaire générique.',
  'Montre, ne dis pas : utilise des actions, des détails concrets et des sensations au lieu de déclarations abstraites.',
  'Varie la longueur des phrases et des paragraphes. Alterne action, dialogue, description et introspection.',
  'Les dialogues sonnent naturels, avec des voix distinctes.',
  'Ne mentionne jamais que tu es une IA. Ne casse pas le 4e mur.',
].join('\n');

/**
 * Règles de PROSE DE ROMAN PUBLIÉ (anti-style-amateur).
 * Socle commun à toutes les voix : ce qui ne varie jamais.
 * (La longueur des phrases/paragraphes, elle, dépend de la VOIX
 * narrative choisie pour chaque histoire - voir NARRATIVE_VOICES.)
 */
const PROSE_RULES = [
  'Écris une prose de ROMAN PUBLIÉ, pas un brouillon ni une fiche technique.',
  'Interdit le style haché typique de l\'IA : pas de paragraphes d\'une seule phrase en série, pas de phrases nominales alignées ("La nuit. Le froid. Le silence."), pas de structure répétitive ("Elle fit... Elle vit...").',
  'PRENDS LE TEMPS de raconter : chaque moment important mérite plusieurs paragraphes. Pose le décor et les sensations AVANT l\'action, montre le geste dans son détail, puis laisse la conséquence émotionnelle respirer. Une scène ne se brûle jamais en trois lignes.',
  'Interdit les enchaînements précipités d\'actions ("Il ouvrit la porte. Il entra. Il vit la lettre."). Entre deux actions : une perception, une pensée, un détail, le poids d\'un geste.',
  'La phrase courte est rare : au maximum une par paragraphe, jamais deux de suite. La phrase moyenne fait 18 à 35 mots. Les phrases longues construisent la dynamique, les courtes frappent.',
  'Dynamique de scène : les actions montent vers un point de bascule, puis respirent. Varie le tempo À L\'INTÉRIEUR de la scène ; une scène entière au même rythme est plate.',
  'Fais des descriptions concrètes et singulières (un détail précis vaut mieux qu\'un adjectif vague).',
  'Respecte strictement le point de vue : on ne voit que ce que le héros voit, sent et pense.',
  'Chaque chapitre = 2 à 4 scènes complètes, chacune avec son début, son développement et sa fin.',
  'Soigne les transitions entre scènes : pas de coupures brutales sans respiration.',
].join('\n');

/**
 * L'HUMANITÉ DU RÉCIT - ce qui fait qu'un livre "reconnaît" le lecteur.
 * Synthèse des analyses de lectorat (retrouvailles presse/lecteurs :
 * l'horreur mise sur l'empathie, la romance vend des expériences
 * émotionnelles, les grands romans montrent des gens contradictoires).
 * Le plot est le véhicule, l'émotion est la destination.
 */
const HUMANITY_RULES = [
  'RENDS LES GENS VRAIS : le héros (et les autres) pensent et ressentent des choses CONTRADICTOIRES, souvent en même temps : vouloir et avoir peur, aimer et se méfier, rire dans le chagrin, espérer malgré tout. Jamais une seule émotion à la fois, jamais les réactions "modèle".',
  'Les gens ne disent pas ce qu\'ils pensent : ils font des détours, mentent par omission, répondent à côté, se taisent quand il faudrait parler. Le vrai dialogue est approximatif et vivant.',
  'Détails humains singuliers : une manie, un tic, une habitude héritée (le héros compte ses pas, plie mal ses vêtements, retient son souffle avant les phrases difficiles). Ces petits gestes font plus que les grands discours.',
  'Le héros a des défauts ordinaires : des lâchetés, des élans avortés, de la mauvaise foi occasionnelle, des moments de grâce inattendus. Il n\'est ni un modèle ni un monstre : il est humain.',
  'TONALITÉ HONNÊTE : la vie mêle les registres - humour au milieu du drame, tendresse dans le conflit, absurdité dans les moments graves. Un récit monotone sonne faux.',
  'EMPATHIE AVANT SENSATION : pour effrayer, émouvoir ou faire rire, confronte le lecteur à une situation qu\'il ne voudrait pas vivre (ou qu\'il rêve de vivre), en la faisant exister par les détails - jamais par l\'effet gratuit. Si le lecteur ne se dit pas "ça pourrait m\'arriver", la scène ne sert à rien.',
  'Les émotions fortes naissent des relations et du quotidien : les familles, les amitiés, les rivalités, les rumeurs, la banalité qui se fissure. Le merveilleux, le surnaturel ou le futur ne sont que des miroirs grossissants de ce que les humains se font déjà entre eux.',
].join('\n');

/**
 * COHÉRENCE STRICTE : chaque nouvelle phrase doit rester cohérente
 * avec tout ce qui a été écrit précédemment dans le roman.
 */
const COHERENCE_RULES = [
  'COHÉRENCE STRICTE AVEC TOUT CE QUI PRÉCÈDE : chaque phrase doit être en accord avec la bible, le résumé des événements, l\'état du héros et les chapitres précédents.',
  'Aucune contradiction : ne fais pas disparaître une blessure non soignée, ne rends pas un objet perdu, ne change pas le nom, le caractère ou la loyauté d\'un personnage sans raison et sans le montrer.',
  'N\'introduis jamais un élément qui contredit une scène déjà écrite (un lieu réapparaît détruit, un allié devient traître sans transition, une information déjà sue est redécouverte avec surprise).',
  'Les personnages secondaires restent cohérents : s\'ils étaient hostiles, ils le restent progressivement ; s\'ils étaient présents ou absents d\'une scène, ne les téléporte pas.',
  'Le ton et la voix narrative ne dérivent pas : on reste dans le registre imposé du début à la fin.',
].join('\n');

/**
 * PALETTE DE VOIX NARRATIVES (diversité maximale entre les romans).
 * Chaque nouvelle histoire tire UNE voix au sort ; la bible et tous
 * les chapitres l'écrivent dans CE registre précis. Chaque livre doit
 * sonner différemment des autres - comme des auteurs différents.
 * Les références ne sont que des repères de RYTHME, jamais de contenu.
 */
export const NARRATIVE_VOICES: { id: string; nom: string; consigne: string }[] = [
  {
    id: 'realiste',
    nom: 'Réalisme classique',
    consigne: 'Prose ample et organisée à la manière des grands romanciers réalistes du XIXe. Phrases longues, subordonnées maîtrisées, descriptions précises du monde et des personnages, regard social. Alternance équilibrée narration/description/dialogue.',
  },
  {
    id: 'intimiste',
    nom: 'Intimisme psychologique',
    consigne: 'Plongée constante dans la conscience du héros. Phrases qui épousent les émotions et les hésitations, paragraphes de pensée intérieure, perceptions fines et ambivalentes. Peu de grands gestes ; beaucoup de sous-texte.',
  },
  {
    id: 'cinematique',
    nom: 'Cinématique haletant',
    consigne: 'Scènes découpées comme au cinéma, montage rapide entre les plans, dialogues secs et rapides, ellipses de temps marquées, tension permanente, fins de paragraphe qui claquent. Les phrases restent de longueur variée (jamais de staccato haché) : le tempo vient du MONTAGE des scènes, pas de la brièveté des phrases.',
  },
  {
    id: 'lyrique',
    nom: 'Lyrique et poétique',
    consigne: 'Musique des phrases, images et métaphores développées, descriptions sensorielles qui débordent, rythme lent et envoûtant, vocabulaire choisi et évocateur. L\'émotion passe par la beauté de la langue.',
  },
  {
    id: 'noir',
    nom: 'Noir atmosphérique',
    consigne: 'Ambiances pesantes, non-dit, silence et menace. Phrases simples mais qui portent du poids, très peu de dialogues et chacun lourd de sens, le monde est hostile et le héros en subit la gravité.',
  },
  {
    id: 'contemporain',
    nom: 'Contemporain punchy',
    consigne: 'Présent de narration, langue actuelle et directe, humour froid, ironie légère, réalisme urbain d\'aujourd\'hui. Phrases nerveuses mais jamais hachées, dialogues vivants et naturels.',
  },
  {
    id: 'epique',
    nom: 'Épique romanesque',
    consigne: 'Souffle et ampleur : descriptions monumentales, batailles et voyages, phrases longues à rythme large, vocabulaire soutenu. Le monde est grand, l\'histoire est une épopée.',
  },
  {
    id: 'baroque',
    nom: 'Baroque orné',
    consigne: 'Phrases longues et sinueuses, abondance de détails et de comparaisons riches, digressions savantes, goût de la précision excessive. Style dense, jamais paresseux.',
  },
  {
    id: 'minimaliste',
    nom: 'Minimalisme sec',
    consigne: 'Réserve et non-dit : le style en dit moins que l\'histoire n\'en contient, les silences et les blancs font partie de la narration. Rythme retenu, émotion par retenue et sous-texte - mais les scènes restent développées et les phrases de longueur normale (la discrétion est dans le choix des mots, pas dans la brièveté).',
  },
  {
    id: 'oral',
    nom: 'Conteur oral',
    consigne: 'Une voix qui raconte au lecteur, complice et naturelle : petites digressions, adresses discrètes, proverbes et images populaires, phrases qui se cherchent comme à l\'oral. Chaleur et humanité.',
  },
  {
    id: 'sensoriel',
    nom: 'Sensoriel immersif',
    consigne: 'Immersion totale par les cinq sens : chaque scène donne à voir, entendre, sentir, toucher. Rythme dense et lent, descriptions en couches, le lecteur est DANS le décor.',
  },
  {
    id: 'suspens',
    nom: 'Suspense policier',
    consigne: 'Indices distillés, rythme implacable, révélation différée, phrases qui avancent comme une enquête. Chaque paragraphe déplace le doute. Dialogue-miroir, atmosphère de vérité cachée.',
  },
];

/**
 * LOIS DU GENRE - ce que les lecteurs attendent vraiment, tirées de
 * l'étude de 47 best-sellers (docs/5-ecriture-narrative/
 * ce-que-veulent-les-lecteurs.txt, 05/09/2026).
 * Injectées dans le prompt de la bible quand le genre correspond.
 */
export const LOIS_PAR_GENRE: Record<string, string> = {
  horreur: [
    'L\'empathie d\'abord : on ne tremble que pour ceux qu\'on aime - frappe des personnages attachants et ce qui leur est cher, pas seulement leur vie.',
    'Suggestion plutôt que gore : la peur se nourrit de ce que le lecteur imagine - montre peu, fais monter l\'angoisse par des détails anodins qui prennent sens.',
    'Le contraste fait la tension : alterne temps calmes (quotidien, chaleur, humour) et scènes d\'angoisse, la montée doit être progressive.',
    'Peur personnelle et spécifique : chaque protagoniste a sa phobie, sa blessure ou son deuil que le récit exploite - le monstre générique ne fait peur à personne.',
    'Anticipation et compte à rebours : énonce le danger et ses règles (délai, cycle, condition) pour que le temps qui passe devienne angoisse.',
    'La fin doit durer : horreur survivant à la dernière page - image qui hante, menace résiduelle, prix payé ; jamais de retour à la normale parfait.',
    'Ancre l\'incroyable dans l\'ordinaire : la menace qui pervertit les objets et lieux familiers du lecteur rend l\'effroi contagieux.',
    'La forme est une arme : cadre clos, récit fragmenté, structure qui se dérègle augmentent l\'impression d\'emprisonnement.',
  ].join('\n'),
  fantasy: [
    'Monde cohérent avec profondeur d\'archive : l\'univers doit sembler préexister au récit, et toute règle annoncée doit être respectée - l\'incohérence tue l\'immersion.',
    'Promesse de l\'épique : des enjeux qui grandissent, une menace qui monte en puissance, un dénouement où la victoire a un prix.',
    'Apprentissage du héros : progression visible en compétences et en maturité (épreuves qualifiantes) - le lecteur grandit avec lui.',
    'La magie a des règles ou un coût : jamais de pouvoir gratuit qui résout tout sans contrepartie, sinon l\'enjeu disparaît.',
    'Personnages ambivalents : antagonistes aux motivations compréhensibles, héros avec faiblesses, erreurs et pertes.',
    'Une quête comme colonne vertébrale : objectif clair et irréversible, structure en étapes qui chacune transforme le héros.',
    'Tension réelle sans armure de héros : la défaite doit être possible, la survie se mérite, la victoire se paye.',
    'Merveille semée avec parcimonie : moments de découverte espacés pour rester marquants, pas dilués en catalogue.',
  ].join('\n'),
  science_fiction: [
    'L\'idée d\'abord : un concept central unique et fort (le "novum") - fais-le sentir dès les premières pages puis décline-le partout.',
    'Monde crédible et cohérent : règles physiques, technologiques et sociales explicites, tenues, avec des conséquences logiques - pas de deus ex machina.',
    'L\'humain au centre de la technologie : ce sont les désirs, peurs, relations et choix moraux des personnages qui portent le récit.',
    'Montre les conséquences des choix technologiques : chaque innovation a un coût, un revers, une conséquence imprévue.',
    'Évite l\'exposition massive : monde découvert progressivement par l\'action et les indices, révélations échelonnées.',
    'Sense of wonder : alterne les échelles, de l\'intime au cosmique, avec des moments de vertige réguliers.',
    'Rythme de thriller : chapitres courts, mini-cliffhangers, chaîne problème -> solution -> nouveau problème, échéances claires.',
    'Parle du présent déguisé en futur : extrapole une angoisse contemporaine d\'un cran - c\'est notre monde, pas un décor exotique.',
  ].join('\n'),
  policier: [
    'Fair-play des indices : tous les éléments de la résolution sont présents AVANT la révélation, lisibles mais discrets - le lecteur doit pouvoir dire "j\'aurais dû voir ça".',
    'Chaque suspect a un mobile, une occasion et des indices contre lui : le coupable ne se distingue que par un détail de cohérence globale.',
    'Le twist final ne contredit jamais un fait établi : il RE-interprète les mêmes faits sous un autre angle.',
    'Rythme par relais : tension régulière, révélations partielles, cliffhanger de fin de chapitre, points de vue alternés.',
    'Une contrainte externe : délai, menace, victime encore en vie - le mystère devient course contre la montre.',
    'L\'ambiance est un personnage : huis clos, environnement hostile, société corrompue - le décor contraint l\'enquête.',
    'Fausses pistes crédibles : chaque red herring est une mini-histoire complète qui semble vraie, et son démontage fait avancer l\'enquête.',
    'Révélation émotionnellement motivée : une justice, un choc personnel, une morale - la solution technique seule ne satisfait jamais.',
  ].join('\n'),
  historique: [
    'Immersion d\'époque sans manuel : la documentation transparaît dans l\'action, les objets, les odeurs, les métiers - jamais dans des exposés.',
    'Personnages de leur époque : ils pensent et désirent avec les croyances et contraintes du temps - l\'anachronisme de pensée est l\'erreur fatale.',
    'Incarnation des enjeux historiques : chaque grand événement est vécu de l\'intérieur par un personnage précis, avec un prix personnel.',
    'Un projet concret traverse le récit (bâtir, survivre, s\'élever) : il sert d\'horloge narrative sur la longue durée.',
    'Liberté créative assumée avec les faits : une histoire juste et émotionnellement vraie prime sur l\'exactitude académique.',
    'Rythme et structure de genre : trame policière, compte à rebours, feuilleton - l\'époque n\'est pas un prétexte à la lenteur.',
    'Le point de vue est roi : filtre l\'époque par une subjectivité forte - le lecteur découvre le monde en même temps que le personnage.',
    'Cohérence des détails avant tout : dates, hiérarchies, monnaies, métiers exacts et constants - un détail faux brise la confiance.',
  ].join('\n'),
  romance: [
    'Émotion = destination : chaque scène fait monter l\'émotion ; l\'intrigue est au service du ressenti, jamais l\'inverse.',
    'Contrat de lecture : la fin heureuse (ou optimiste) est garantie dès la première page - une promesse non négociable du genre.',
    'Résistance structurée : un obstacle extérieur apparent qui masque un obstacle intérieur réel (peur, trauma, orgueil) ; la séparation se résout par une révélation et une transformation.',
    'Désir centré et montré par le geste : regards, respirations, non-dits - jamais d\'adjectifs accumulés ; le slow burn paie toujours.',
    'Tropes promis mais réinventés : enemies-to-lovers, forbidden, second chance - annonce-les puis incarne-les dans des personnages singuliers.',
    'Personnages attachants et cohérents : héroïne imparfaite aux névroses identifiables, héros vulnérable, relation qui évolue - tout retournement a une cause visible.',
    'Vulnérabilité, consentement, héroïsme moderne : relations saines, consentement explicite, rejet de la romanticisation de la toxicité.',
    'Rythme feuilleton : chapitres courts, pics émotionnels, cliffhangers, courbe sinusoïdale avec point bas aux deux tiers.',
  ].join('\n'),
};

/**
 * PROGRESSION DU RÉCIT - l'IA a LE plan (caché du lecteur), mais elle
 * écrit comme un romancier : installation d'abord, montée par couches.
 * Le lecteur doit d'abord aimer le héros et son monde avant toute bascule.
 */
const PROGRESSION_RULES = [
  'MONDE ORDINAIRE D\'ABORD : le lecteur doit d\'abord entrer dans la vie du héros (routines, travail, relations, manies, désirs) avant que quoi que ce soit ne bascule. L\'installation est un investissement : elle rend la bascule douloureuse.',
  'MONTÉE PAR COUCHES : l\'histoire se dévoile progressivement. Un détail anodin au chapitre 2, un second au chapitre 3, la brisure franche plus tard. La révélation centrale est un capital que tu dépenses avec parcimonie - jamais tout d\'un coup, jamais trop tôt.',
  'LE PLAN RESTE CACHÉ DU LECTEUR : tu sais où tu vas (bible), mais le lecteur ne doit PAS voir le cap arriver. Pas d\'exposition du destin : il découvre avec le héros, dans l\'ordre du vécu.',
  'LA MENACE N\'EST PAS PERÇUE DÈS LE DÉBUT : elle existe dans le plan dès le départ, mais le lecteur la sent d\'abord comme une gêne, une coïncidence, un malaise discret - pas comme une évidence. Pour le genre horreur : le lecteur doit avoir le temps de s\'attacher avant d\'avoir peur.',
  'L\'ACCROCHE VIENT DU PERSONNAGE, pas du danger : on lit les premières pages parce qu\'on s\'attache au héros et à son monde (écriture, humanité, désir), pas parce qu\'un événement spectaculaire a déjà frappé.',
  'VARIER LES OUVERTURES : certains romans peuvent ouvrir in medias res, mais PAS systématiquement. L\'installation lente est la base ; l\'ouverture directe dans l\'action est l\'exception, jamais la norme.',
].join('\n');

export function ageLabel(age: AgeGroup): string {
  return AGE_GROUPS.find((g) => g.code === age)?.label ?? 'Adultes';
}

/** Limite de contenu selon l'âge. */
function ageLimit(age: AgeGroup): string {
  switch (age) {
    case 'under10':
      return 'Aucune violence graphique, aucun danger réellement menaçant, aucune mort de personnage sympathique, zéro romance. Tout finit bien.';
    case '10to15':
      return 'Violence légère et non graphique, danger réel mais jamais gratuit, romance chaste, pas d\'horreur.';
    case '16to18':
      return 'Violence modérée, romance sans scènes explicites, horreur acceptable si non gratuite.';
    default:
      return 'Tous les tons sont possibles, sans gratuité.';
  }
}

export function buildStoryBiblePrompt(
  params: GameParams,
  age: AgeGroup,
  opts?: {
    heroName?: string;
    heroTrait?: string;
    voix?: { nom: string; consigne: string };
    briques?: { label: string; valeur: string }[];
  }
): string {
  const { heroName, heroTrait, voix, briques } = opts ?? {};
  const variationSeed = Math.floor(Math.random() * 999_999);
  const briquesBlock = briques?.length
    ? `ÉLÉMENTS IMPOSÉS PAR LA DIRECTION (le roman DOIT les intégrer naturellement, ce sont les fondations du récit) :
${briques.map((b) => `- ${b.label} : ${b.valeur}`).join('\n')}
`
    : '';
  const loisGenre = LOIS_PAR_GENRE[params.genre];
  const loisBlock = loisGenre
    ? `LOIS DU GENRE (ce que les lecteurs de ${params.genre} attendent vraiment - le roman DOIT les respecter) :
${loisGenre}
`
    : '';
  return `Tu es un grand romancier. Crée la "bible" d'un roman interactif (livre dont le lecteur est le héros).

GENRE : ${params.genre}${params.subGenre ? ` - ${params.subGenre}` : ''}
PUBLIC : ${ageLabel(age)}
PARAMÈTRES : difficulté ${params.difficulty}, style narratif ${params.style}, ${params.chapterLength} longueur de chapitre, ${params.maxChoices} choix max par chapitre.
${heroName ? `NOM DU HÉROS (choisi par le lecteur, à respecter) : ${heroName}` : ''}
${heroTrait ? `TRAIT DE PERSONNALITÉ DU HÉROS : ${heroTrait}` : ''}

${briquesBlock}
${loisBlock}
VOIX NARRATIVE IMPOSÉE (obligatoire - tout le roman sera écrit dans CE registre, du prologue à la dernière ligne) :
"${voix?.nom ?? 'Réalisme classique'}" : ${voix?.consigne ?? 'Prose ample et organisée, descriptions précises, alternance équilibrée narration/description/dialogue.'} 
Le champ "tonStyle" de ta réponse doit décrire cette voix en 3-4 phrases concrètes utilisables par l'écrivain de chaque chapitre (rythme de phrase, densité descriptive, place du dialogue et de l'introspection, vocabulaire).

IMPORTANT - ORIGINALITÉ : ce roman doit être UNIQUE. Ne réutilise jamais l'intrigue, les personnages ou les situations d'histoire que tu as déjà écrites ou connues (changement de ville/nom/époque ne suffit pas : change la VRAIE histoire).
ANTI-CLICHÉ : si un élément imposé par la direction ressemble à un schéma connu (créature qui traque, cassette mystérieuse, maison hantée standard, secret de famille générique), DÉTOURNE-LE : sonne-le avec les codes du genre AVANT de le prendre au pied de la lettre, ou transforme-le en version inattendue. Le cliché est interdit même quand il vient des tables : la surprise est le minimum.
INDICE DE CRÉATION (numéro de tirage) : ${variationSeed} - utilise ce tirage pour ancrer une variation : fais un choix d'écriture différent (point de départ, secret du héros, nature de l'antagoniste, énigme centrale).

Ta mission : construire une histoire avec UN CAP PRÉCIS. Tu sais dès le départ où tu emmènes le lecteur, même si ses choix changent le chemin. Un bon roman ne dérive jamais : il converge.

Règles de fond :
- Structure en 3 actes (exposition/confrontation/résolution), chacun avec un objectif précis et un tournant de fin d'acte.
- UNE question dramatique centrale, répondue au climax.
- Un héros imparfait : désir CONSCIENT (ce qu'il croit vouloir) ET besoin INCONSCIENT (ce dont il a vraiment besoin - l'arc du personnage consiste à passer de l'un à l'autre), peur, faille, secret.
- Un antagoniste avec une motivation (jamais "méchant pour être méchant").
- Un monde cohérent (règles stables, magie/science/époque).
- UNE sous-intrigue en parallèle (relation, rivalité, enquête secondaire) qui se noue et se dénoue sans étouffer l'intrigue principale.
- ${ageLimit(age)}

ARCHITECTURE DU ROMAN (~10-15 chapitres + prologue) :
- Répartis les chapitres : Acte I = 3-5, Acte II = 5-7, Acte III = 2-3. Indique le point médian (le grand renversement au milieu de l'Acte II qui change la donne).
- La promesse du genre doit être tenue : ${params.genre}${params.subGenre ? ` (${params.subGenre})` : ''} a ses codes (sinon le lecteur se sent trahi), mais tu les déplaces avec originalité.
- L'élément imposé par la direction n'est JAMAIS un simple décor : il doit provoquer l'histoire, la nourrir et être dénoué (une brique est une graine, pas une affiche).

${HUMANITY_RULES}

PLAN DIRECTEUR - à remplir avec une précision totale :
- "destination" : UNE phrase qui dit où l'histoire emmène le lecteur (la promesse du roman, ce que le lecteur doit ressentir/comprendre à la fin). C'est LE cap.
- "noyauImmuable" : 3-5 vérités du roman qui ne changent JAMAIS, quel que soit le choix du lecteur (ex : la vérité sur les disparitions, le lien entre le héros et l'antagoniste, la nature du monde). Le scénario peut dévier, pas ces vérités.
- "actes" (3) : pour chaque acte, un objectif clair, 3-6 scènes clés qui DEVRONT avoir lieu (liste ordonnée), et le tournant qui clôt l'acte. C'est la colonne vertébrale : l'histoire avance vers ces scènes même si les choix la font zigzaguer.
- "carrefours" : 2-5 choix majeurs ANTICIPÉS (chapitre approximatif, enjeu, options possibles, et ce qui arrive à l'histoire si le lecteur dévie du chemin prévu). Ce sont les seuls endroits où l'histoire peut vraiment changer de route.
- "fins" : 2-5 fins possibles avec LA CONDITION précise qui y mène et l'émotion finale visée. Les choix du lecteur mènent vers l'une de ces fins - jamais une fin improvisée hors cadre.
- "pointMedian" : le grand renversement de l'acte II (la donne change, le héros ne peut plus reculer).
- "sousIntrigue" : UNE intrigue parallèle, en une phrase.

${ANTI_AI_SLOP}

Réponds UNIQUEMENT en JSON valide, rien d'autre :
{
  "titre": "...",
  "genre": "...",
  "sousGenre": "...",
  "questionDramatique": "...",
  "theme": "...",
  "resumeGeneral": "...",
  "structure": {"acte1": "résumé", "acte2": "résumé", "acte3": "résumé"},
  "heros": {"nom": "...", "desir": "...", "besoinInconscient": "...", "peur": "...", "faille": "...", "traitOptionnel": "..."},
  "antagoniste": {"nom": "...", "motivation": "..."},
  "personnages": [{"nom": "...", "role": "...", "detail": "..."}],
  "monde": {"description": "...", "regles": "..."},
  "finsPossibles": [{"nom": "...", "condition": "..."}],
  "tonStyle": "...",
  "planDirecteur": {
    "destination": "une phrase - le cap du roman",
    "noyauImmuable": ["vérité 1", "vérité 2", "vérité 3"],
    "actes": [
      {"acte": 1, "objectif": "...", "scenesCles": ["scène 1", "scène 2", "scène 3"], "tournant": "..."},
      {"acte": 2, "objectif": "...", "scenesCles": ["..."], "tournant": "..."},
      {"acte": 3, "objectif": "...", "scenesCles": ["..."], "tournant": "..."}
    ],
    "pointMedian": "le grand renversement de l'acte II",
    "sousIntrigue": "l'intrigue parallèle en une phrase",
    "carrefours": [
      {"chapitre": N, "enjeu": "...", "options": "...", "consequenceSiDeviation": "..."}
    ],
    "fins": [
      {"nom": "...", "condition": "...", "emotionFinale": "..."}
    ]
  }
}`;
}

export function buildProloguePrompt(bible: StoryBible, params: GameParams, age: AgeGroup): string {
  return `Tu es un grand romancier. Écris le PROLOGUE de ce roman.

BIBLE DU ROMAN :
${JSON.stringify(bible, null, 2)}

PUBLIC : ${ageLabel(age)} | STYLE : ${params.style} | DIFFICULTÉ : ${params.difficulty}

VOIX NARRATIVE du roman (écris le prologue DANS CE REGISTRE, pas dans un autre) :
${bible.tonStyle ?? 'Prose classique, descriptions précises, équilibre narration/dialogue.'}

Le prologue doit :
- INSTALLER la vie ordinaire du héros : sa routine, son travail, les gens qui l'entourent, ses manies, ce qu'il désire et ce qu'il redoute. On doit entrer dans son monde et s'attacher à lui AVANT toute bascule.
- Contenir AU PLUS une graine discrète (un détail étrange qui ne prendra sens qu'après coup) - jamais d'horreur, de danger ou de mystère explicite.
- L'accroche vient de l'écriture et du personnage (sa voix, son humanité, son désir), pas d'un événement spectaculaire. On lit la page 2 parce qu'on veut rester avec lui.
- Faire sentir, de manière subliminale, que quelque chose pourrait dérailler - sans jamais le nommer.
- Finir sur une note calme qui donne envie de lire le chapitre 1 (le lecteur veut suivre ce héros).
- Ne PAS contenir de choix (les choix commencent au chapitre 1).
- ${ageLimit(age)}

${PROSE_RULES}

${HUMANITY_RULES}

${PROGRESSION_RULES}

${ANTI_AI_SLOP}

Rappel : un VRAI prologue de roman = 1500 à 2200 mots, en prose soignée et détaillée, PAS un résumé ni un teaser. Prends le temps : développe chaque moment, ne précipite pas les actions.

Réponds UNIQUEMENT en JSON valide :
{
  "titre": "Prologue",
  "texte": "..." (le prologue, 1500-2200 mots),
  "descriptionCouverture": "description visuelle détaillée de la couverture (style de l'image, ambiance, couleurs, héros, lieu)",
  "choix": []
}`;
}

export function buildChapterPrompt(opts: {
  bible: StoryBible;
  /** texte figé de la bible (verbatim, pour le cache) - optionnel sinon JSON.stringify */
  bibleText?: string;
  state?: string;
  resume: string;
  playerChoice?: string;
  chapterNumber: number;
  totalChapters: number;
  act: string;
  phase: string;
  params: GameParams;
  age: AgeGroup;
  rule?: string;
}): string {
  const { bible, bibleText, state, resume, playerChoice, chapterNumber, totalChapters, act, phase, params, age, rule } = opts;
  // Ordre STABLE pour le cache : system → bible (verbatim) → état → résumé → chapitres
  const bibleBlock = bibleText ?? JSON.stringify(bible, null, 2);
  return `Tu es un grand romancier. Continue ce roman.

BIBLE DU ROMAN (référence fixe) :
${bibleBlock}

${state ? `ÉTAT DU HÉROS (référence fixe, à respecter) :
${state}
` : ''}

RÉSUMÉ DES ÉVÉNEMENTS PRÉCÉDENTS (texte courant) :
${resume}

${playerChoice ? `DERNIER CHOIX DU HÉROS : ${playerChoice}` : ''}

INFO CHAPITRE : Chapitre ${chapterNumber}/${totalChapters}. Position narrative : ${act}. ${phase}.
PUBLIC : ${ageLabel(age)} | STYLE : ${params.style} | DIFFICULTÉ : ${params.difficulty}
${rule ? `RÈGLE SPÉCIALE : ${rule}` : ''}

Règles d'écriture :
- Le chapitre doit avoir un début qui relance, un développement (1-3 scènes), une fin variée (clôture / suspense doux / CLIFFHANGER).
- Progression de l'arc : on avance vers le climax de l'acte.
- Le héros agit selon son trait mais le joueur garde le contrôle via les choix.
- Conséquences visibles des choix précédents : les blessures, objets et personnages de l'état du héros doivent rester cohérents.
- ${ageLimit(age)}
- 2e personne ("tu") : le lecteur EST le héros.

${ANTI_AI_SLOP}

IMPORTANT : écris le chapitre en texte brut, SANS balises JSON, SANS titre. Juste la prose du chapitre (${params.chapterLength === 'court' ? 1500 : params.chapterLength === 'moyen' ? 3000 : 5000} mots environ).`;
}

/**
 * Version SÉPARÉE en 2 messages pour le prompt caching GPT-5.6 :
 * - msg[1] : system + bible (verbatim, FIGÉ) -> cache implicite à sa fin
 * - msg[2] : état + résumé + chapitres + consigne (VOLATILE)
 * Le breakpoint implicite de GPT-5.6 se place à la fin du dernier message
 * stable, donc la bible est lue depuis le cache aux chapitres suivants.
 */
export function buildChapterMessages(opts: {
  bible: StoryBible;
  bibleText?: string;
  state?: string;
  resume: string;
  playerChoice?: string;
  chapterNumber: number;
  totalChapters: number;
  act: string;
  phase: string;
  params: GameParams;
  age: AgeGroup;
  rule?: string;
  /** Grandes lignes évolutives du plan (games.story_plan) - optionnel. */
  plan?: string;
  /** Profil de rythme du roman (params.rythme) - optionnel. */
  rythme?: string;
}): { system: string; stable: string; volatile: string } {
  const { bible, bibleText, state, resume, playerChoice, chapterNumber, totalChapters, act, phase, params, age, rule, plan, rythme } = opts;
  const bibleBlock = bibleText ?? JSON.stringify(bible, null, 2);
  const system = buildSystemPrompt();
  const stable = `BIBLE DU ROMAN (référence fixe) :
${bibleBlock}`;
  const volatile = `${state ? `ÉTAT DU HÉROS (référence fixe, à respecter) :
${state}
` : ''}${plan ? `GRANDES LIGNES DU PLAN (où l'histoire va - à respecter, la route peut s'adapter mais pas le cap) :
${plan}
` : 'PLAN : la bible contient le plan directeur (cap, actes, scènes clés). Suis-le.'}
${rythme ? `RYTHME DU ROMAN (structure du récit - à respecter absolument, c'est la respiration du livre) :
${rythme}
` : ''}
RÉSUMÉ DES ÉVÉNEMENTS PRÉCÉDENTS (texte courant) :
${resume}

${playerChoice ? `DERNIER CHOIX DU HÉROS : ${playerChoice}` : ''}

INFO CHAPITRE : Chapitre ${chapterNumber}/${totalChapters}. Position narrative : ${act}. ${phase}.
PUBLIC : ${ageLabel(age)} | STYLE : ${params.style} | DIFFICULTÉ : ${params.difficulty}
${rule ? `RÈGLE SPÉCIALE : ${rule}` : ''}

Règles d'écriture :
- Le chapitre doit avoir un début qui relance, un développement (2-4 scènes complètes), une fin variée (clôture / suspense doux / CLIFFHANGER).
- Progression de l'arc : on avance vers les scènes clés du plan et vers le climax de l'acte. Le chapitre doit FAIRE AVANCER le cap, pas seulement prolonger la série.
- Le héros agit selon son trait mais le joueur garde le contrôle via les choix.
- Conséquences visibles des choix précédents : les blessures, objets et personnages de l'état du héros doivent rester cohérents.
- ${ageLimit(age)}
- 2e personne ("tu") : le lecteur EST le héros.

VOIX NARRATIVE (obligatoire - écris ce chapitre DANS CE REGISTRE, pas dans un autre ; respecte le rythme de phrase, la densité descriptive, la place du dialogue et de l'introspection) :
${bible.tonStyle ?? 'Prose classique, descriptions précises, équilibre narration/dialogue.'}

${PROSE_RULES}

${HUMANITY_RULES}

${COHERENCE_RULES}

${PROGRESSION_RULES}

${ANTI_AI_SLOP}

IMPORTANT : écris le chapitre en texte brut, SANS balises JSON, SANS titre. Juste la prose du chapitre (${params.chapterLength === 'court' ? 2000 : params.chapterLength === 'moyen' ? 3500 : 5000} mots environ). Ce nombre de mots n'est PAS un résumé : c'est le temps de DÉVELOPPER chaque scène. Prends le temps de raconter - décris, installe, fais durer les moments importants, ne précipite jamais les actions. Si tu écris trop court, c'est une faute.`;
  return { system, stable, volatile };
}

export function buildChoicesPrompt(opts: {
  bible: StoryBible;
  chapterText: string;
  chapterNumber: number;
  maxChoices: number;
  age: AgeGroup;
}): string {
  const { bible, chapterText, chapterNumber, maxChoices, age } = opts;
  return `Tu es un grand romancier. Voici le chapitre ${chapterNumber} d'un roman interactif.

BIBLE :
${JSON.stringify(bible, null, 2)}

CHAPITRE :
${chapterText}

Propose ${2 <= maxChoices ? `de 2 à ${maxChoices}` : '2'} choix de suite pour le lecteur.

- Les libellés des choix sont ÉVOCATEURS (montrent l'action et l'enjeu), pas génériques ("Ouvrir la porte").
- Chaque choix a une conséquence résumée (pour la cohérence).
- Les choix ne doivent pas être des fausses options : chacun mène à une suite réellement différente.
- ${ageLimit(age)}

Réponds UNIQUEMENT en JSON valide (objet JSON, comme demandé) :
{
  "titre": "Chapitre ${chapterNumber} : ...",
  "choix": [
    {"libelle": "Frapper à la porte de l'étranger", "consequenceResumee": "..."},
    {"libelle": "...", "consequenceResumee": "..."}
  ]
}`;
}

export function buildSummaryPrompt(previousResume: string, chapterText: string, playerChoice?: string): string {
  return `Résume en un texte bref et précis les événements d'un roman pour permettre à un autre rédacteur de continuer l'histoire sans relire les chapitres. Inclus : les choix majeurs du héros, les personnages rencontrés, les révélations, l'état émotionnel, les conséquences. Garde les faits importants, omets les descriptions.

RÉSUMÉ PRÉCÉDENT :
${previousResume || '(aucun - début du roman)'}

${playerChoice ? `CHOIX DU HÉROS : ${playerChoice}` : ''}

NOUVEAU CHAPITRE :
${chapterText}

Réponds UNIQUEMENT avec le nouveau résumé, en texte brut, sans préambule ni titre.`;
}

/** Préfixe système STABLE mis en cache entre les appels d'un même roman. */
export function buildSystemPrompt(): string {
  return `Tu es Fable, un système d'écriture de romans interactifs "livre dont vous êtes le héros" en français. Ta mission est la qualité littéraire : cohérence, profondeur, émotion. Tu respectes toujours le format demandé. ${ANTI_AI_SLOP}`;
}

/** Prompt d'état structuré : le modèle renvoie des DELTAS, le code applique. */
export function buildStatePrompt(opts: { state: string; chapterText: string }): string {
  return `Voici l'état structuré actuel du héros d'un roman interactif (JSON) :
${opts.state}

Voici le chapitre qui vient d'être écrit :
${opts.chapterText}

Mets à jour l'état en fonction de ce qui s'est passé dans ce chapitre. RÈGLES :
- Ne renvoie QUE les CHANGEMENTS (deltas), pas l'état complet.
- N'invente rien qui ne soit pas dans le chapitre.
- Une blessure s'ajoute seulement si le chapitre montre clairement une blessure physique.
- Un objet s'ajoute seulement si le héros le ramasse explicitement.
- Un PNJ meurt seulement si le chapitre montre sa mort explicitement.
- Si rien ne change, renvoie {} .

Réponds UNIQUEMENT en JSON (structure exacte) :
{
  "blessures": { "ajouter": [{"quoi": "...", "depuis": N, "grave": false}], "soigner": ["id"] },
  "inventaire": { "ajouter": [{"objet": "...", "depuis": N}] },
  "pnj": { "ajouter": [{"nom": "...", "relation": "..."}], "tuer": ["id ou nom"] },
  "engagements": { "ajouter": [{"envers": "...", "quoi": "..."}] },
  "lieu": "nouveau lieu si changé"
}`;
}

/**
 * Prompt de RÉÉVALUATION DU PLAN (mémoire des grandes lignes).
 * Après CHAQUE choix du lecteur, l'IA juge si le choix est un tournant
 * important ; si oui, elle RÉÉCRIT les grandes lignes (la route s'adapte,
 * le cap reste). Résultat stocké dans games.story_plan et injecté dans
 * les chapitres suivants.
 */
export function buildPlanReconsiderPrompt(opts: {
  planDirecteur: string;
  currentPlan: string | null;
  resume: string;
  playerChoice: string;
}): string {
  return `Tu es le directeur d'écriture d'un roman interactif. Le lecteur vient de faire un choix : "${opts.playerChoice}".

PLAN DIRECTEUR (le cap, FIXE - défini au départ, il ne change pas) :
${opts.planDirecteur}

${opts.currentPlan ? `GRANDES LIGNES ACTUELLES (la route prévue) :
${opts.currentPlan}

` : ''}RÉSUMÉ DES ÉVÉNEMENTS DE L'HISTOIRE :
${opts.resume}

Ta mission : décider si ce choix est un TOURNANT IMPORTANT (il change la route : les enjeux, les alliés, la situation du héros, ou il s'éloigne notablement du chemin prévu).

- Si OUI (tournant) : réécris les grandes lignes pour intégrer la conséquence de ce choix. La route peut changer (nouvelles scènes, nouveaux obstacles), mais tu respectes le plan directeur : la destination et le noyau immuable restent. Si le choix rapproche d'une fin précise du plan directeur, indique laquelle.
- Si NON : renvoie "important": false sans réécrire (les grandes lignes restent valables).

Grandes lignes à produire (si important) : 150-250 mots, en français, destinées à l'écrivain des prochains chapitres. Inclus : la situation actuelle, l'objectif immédiat du héros, les 2-4 scènes clés à venir, et par quelle fin du plan directeur l'histoire converge. N'invente rien hors du plan directeur, ne révèle aucun élément que le lecteur ignore.

Réponds UNIQUEMENT en JSON valide :
{
  "important": true ou false,
  "grandesLignes": "..." (à remplir si important, sinon chaîne vide),
  "versQuelleFin": "nom de la fin du plan directeur visée" (optionnel)
}`;
}