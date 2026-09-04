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
  return `Tu es un grand romancier. Crée la "bible" d'un roman interactif (livre dont le lecteur est le héros).

GENRE : ${params.genre}${params.subGenre ? ` - ${params.subGenre}` : ''}
PUBLIC : ${ageLabel(age)}
PARAMÈTRES : difficulté ${params.difficulty}, style narratif ${params.style}, ${params.chapterLength} longueur de chapitre, ${params.maxChoices} choix max par chapitre.
${heroName ? `NOM DU HÉROS (choisi par le lecteur, à respecter) : ${heroName}` : ''}
${heroTrait ? `TRAIT DE PERSONNALITÉ DU HÉROS : ${heroTrait}` : ''}

${briquesBlock}
VOIX NARRATIVE IMPOSÉE (obligatoire - tout le roman sera écrit dans CE registre, du prologue à la dernière ligne) :
"${voix?.nom ?? 'Réalisme classique'}" : ${voix?.consigne ?? 'Prose ample et organisée, descriptions précises, alternance équilibrée narration/description/dialogue.'} 
Le champ "tonStyle" de ta réponse doit décrire cette voix en 3-4 phrases concrètes utilisables par l'écrivain de chaque chapitre (rythme de phrase, densité descriptive, place du dialogue et de l'introspection, vocabulaire).

IMPORTANT - ORIGINALITÉ : ce roman doit être UNIQUE. Ne réutilise jamais l'intrigue, les personnages ou les situations d'histoire que tu as déjà écrites ou connues (changement de ville/nom/époque ne suffit pas : change la VRAIE histoire).
INDICE DE CRÉATION (numéro de tirage) : ${variationSeed} - utilise ce tirage pour ancrer une variation : fais un choix d'écriture différent (point de départ, secret du héros, nature de l'antagoniste, énigme centrale).

Ta mission : construire une histoire avec UN CAP PRÉCIS. Tu sais dès le départ où tu emmènes le lecteur, même si ses choix changent le chemin. Un bon roman ne dérive jamais : il converge.

Règles de fond :
- Structure en 3 actes (exposition/confrontation/résolution), chacun avec un objectif précis et un tournant de fin d'acte.
- UNE question dramatique centrale, répondue au climax.
- Un héros imparfait : désir, peur, faille, secret.
- Un antagoniste avec une motivation (jamais "méchant pour être méchant").
- Un monde cohérent (règles stables, magie/science/époque).
- ${ageLimit(age)}

PLAN DIRECTEUR - à remplir avec une précision totale :
- "destination" : UNE phrase qui dit où l'histoire emmène le lecteur (la promesse du roman, ce que le lecteur doit ressentir/comprendre à la fin). C'est LE cap.
- "noyauImmuable" : 3-5 vérités du roman qui ne changent JAMAIS, quel que soit le choix du lecteur (ex : la vérité sur les disparitions, le lien entre le héros et l'antagoniste, la nature du monde). Le scénario peut dévier, pas ces vérités.
- "actes" (3) : pour chaque acte, un objectif clair, 3-6 scènes clés qui DEVRONT avoir lieu (liste ordonnée), et le tournant qui clôt l'acte. C'est la colonne vertébrale : l'histoire avance vers ces scènes même si les choix la font zigzaguer.
- "carrefours" : 2-5 choix majeurs ANTICIPÉS (chapitre approximatif, enjeu, options possibles, et ce qui arrive à l'histoire si le lecteur dévie du chemin prévu). Ce sont les seuls endroits où l'histoire peut vraiment changer de route.
- "fins" : 2-5 fins possibles avec LA CONDITION précise qui y mène et l'émotion finale visée. Les choix du lecteur mènent vers l'une de ces fins - jamais une fin improvisée hors cadre.

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
  "heros": {"nom": "...", "desir": "...", "peur": "...", "faille": "...", "traitOptionnel": "..."},
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
- ACCROCHER immédiatement (une scène intrigante, un danger, une question, un mystère).
- Poser le héros et son monde ordinaire (avant la bascule), avec des descriptions riches et des scènes complètes.
- Faire sentir le CAP du roman : la destination du plan directeur doit se dessiner (sans la révéler).
- Finir sur une note qui donne envie de lire le chapitre 1.
- Ne PAS contenir de choix (les choix commencent au chapitre 1).
- ${ageLimit(age)}

${PROSE_RULES}

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
}): { system: string; stable: string; volatile: string } {
  const { bible, bibleText, state, resume, playerChoice, chapterNumber, totalChapters, act, phase, params, age, rule, plan } = opts;
  const bibleBlock = bibleText ?? JSON.stringify(bible, null, 2);
  const system = buildSystemPrompt();
  const stable = `BIBLE DU ROMAN (référence fixe) :
${bibleBlock}`;
  const volatile = `${state ? `ÉTAT DU HÉROS (référence fixe, à respecter) :
${state}
` : ''}${plan ? `GRANDES LIGNES DU PLAN (où l'histoire va - à respecter, la route peut s'adapter mais pas le cap) :
${plan}
` : 'PLAN : la bible contient le plan directeur (cap, actes, scènes clés). Suis-le.'}
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