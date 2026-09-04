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

export function buildStoryBiblePrompt(params: GameParams, age: AgeGroup): string {
  return `Tu es un grand romancier. Crée la "bible" d'un roman interactif (livre dont le lecteur est le héros).

GENRE : ${params.genre}${params.subGenre ? ` - ${params.subGenre}` : ''}
PUBLIC : ${ageLabel(age)}
PARAMÈTRES : difficulté ${params.difficulty}, style narratif ${params.style}, ${params.chapterLength} longueur de chapitre, ${params.maxChoices} choix max par chapitre.

Règles de fond :
- Structure en 3 actes (exposition/confrontation/résolution).
- UNE question dramatique centrale, répondue au climax.
- Un héros imparfait : désir, peur, faille, secret.
- Un antagoniste avec une motivation (jamais "méchant pour être méchant").
- Un monde cohérent (règles stables, magie/science/époque).
- 2-5 fins possibles selon les choix.
- ${ageLimit(age)}

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
  "tonStyle": "..."
}`;
}

export function buildProloguePrompt(bible: StoryBible, params: GameParams, age: AgeGroup): string {
  return `Tu es un grand romancier. Écris le PROLOGUE de ce roman.

BIBLE DU ROMAN :
${JSON.stringify(bible, null, 2)}

PUBLIC : ${ageLabel(age)} | STYLE : ${params.style} | DIFFICULTÉ : ${params.difficulty}

Le prologue doit :
- ACCROCHER immédiatement (une scène intrigante, un danger, une question, un mystère) - pas de description poussée du monde ici.
- Poser le héros et son monde ordinaire (avant la bascule).
- Finir sur une note qui donne envie de lire le chapitre 1.
- Ne PAS contenir de choix (les choix commencent au chapitre 1).
- ${ageLimit(age)}

${ANTI_AI_SLOP}

Réponds UNIQUEMENT en JSON valide :
{
  "titre": "Prologue",
  "texte": "..." (le prologue, ~800-1200 mots),
  "descriptionCouverture": "description visuelle détaillée de la couverture (style de l'image, ambiance, couleurs, héros, lieu)",
  "choix": []
}`;
}

export function buildChapterPrompt(opts: {
  bible: StoryBible;
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
  const { bible, resume, playerChoice, chapterNumber, totalChapters, act, phase, params, age, rule } = opts;
  return `Tu es un grand romancier. Continue ce roman.

BIBLE DU ROMAN :
${JSON.stringify(bible, null, 2)}

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
- Conséquences visibles des choix précédents.
- ${ageLimit(age)}
- 2e personne ("tu") : le lecteur EST le héros.

${ANTI_AI_SLOP}

IMPORTANT : écris le chapitre en texte brut, SANS balises JSON, SANS titre. Juste la prose du chapitre (${params.chapterLength === 'court' ? 1500 : params.chapterLength === 'moyen' ? 3000 : 5000} mots environ).`;
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