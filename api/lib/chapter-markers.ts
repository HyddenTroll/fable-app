/**
 * Format de fin de chapitre FABLE — module PUR et testable.
 * Le modèle écrit : corps → [[TITRE]]|titre → [[CHOIX]] puis des lignes
 * "n|libellé|conséquence". Le serveur streame le corps et parse la queue.
 *
 * Robustesse attendue (tests dans scripts/test-marqueurs.mjs) :
 * - un « | » dans un libellé de choix ne casse pas le parse (on split
 *   sur le PREMIER et le DERNIER |, format "n|libelle|consequence")
 * - marqueur absent / mal orthographié → choix vides (filet serveur)
 * - « [[ » en incise dans la prose → ignoré tant que le vrai marqueur
 *   n'est pas trouvé
 */

export const TITRE_MARKER = '[[TITRE]]';
export const CHOIX_MARKER = '[[CHOIX]]';

export interface ChapterChoices {
  libelle: string;
  consequenceResumee: string;
}

export interface ChapterMeta {
  title?: string;
  choices: ChapterChoices[];
  /** Index (dans tail) où le corps s'arrête et où commence la structure. */
  bodyEnd: number;
}

/**
 * Trouve la position du PREMIER marqueur de structure dans un texte.
 * Retourne -1 si aucun marqueur n'est présent.
 */
export function findFirstMarker(text: string): number {
  const iTitre = text.indexOf(TITRE_MARKER);
  const iChoix = text.indexOf(CHOIX_MARKER);
  if (iTitre < 0 && iChoix < 0) return -1;
  if (iTitre < 0) return iChoix;
  if (iChoix < 0) return iTitre;
  return Math.min(iTitre, iChoix);
}

/**
 * ANTI-INTERTITRES : le modèle répète parfois le titre du chapitre en
 * clair dans le corps (« Chapitre 2 · Le troisième tiroir » sur une
 * ligne seule) pour séparer ses sections. Ces lignes sont retirées du
 * texte diffusé et stocké — le titre n'apparaît qu'en en-tête.
 * Ne retire QUE les lignes seules ; la prose est intouchée.
 */
export function cleanIntertitles(
  text: string,
  title: string | undefined,
  chapterNumber: number,
): string {
  const exacts = new Set<string>();
  if (title) {
    const t = title.trim();
    exacts.add(t);
    exacts.add(`— ${t} —`);
    exacts.add(`— ${t}—`);
  }
  exacts.add(`Chapitre ${chapterNumber}`);
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (exacts.has(t)) return false;
      if (/^Chapitre \d+\s*[·.]/.test(t)) return false; // « Chapitre 2 · titre »
      if (/^—\s*Chapitre \d+/.test(t)) return false; // « — Chapitre 2 · titre — »
      if (/^-{3,}$/.test(t)) return false; // ligne de séparation « --- »
      return true;
    })
    .join('\n');
}

/**
 * Parse la queue (à partir du premier marqueur) en titre + choix.
 * - Ligne de choix : "^\s*\d+\| libellé | conséquence $" — on ne coupe
 *   PAS sur le premier |  (un libellé peut en contenir) mais sur le
 *   PREMIER et le DERNIER | de la ligne.
 * - Si un marqueur est mal orthographié ([[CHoiX]], [[CHOIX]] sans
 *   nouvelle ligne...), on tente un rattrapage souple ; à défaut,
 *   choix vides.
 */
export function parseChapterMarkers(tail: string): ChapterMeta {
  const bodyEnd = findFirstMarker(tail);
  // -1 (aucun marqueur exact) : on parse tout le texte au cas d'un
  // marqueur mal orthographié (rattrapage souple).
  const head = bodyEnd >= 0 ? tail.slice(bodyEnd) : tail;
  const titleMatch = /\[\[TITRE\]\]\s*\|([^\n]+)/.exec(head);
  const title = titleMatch ? titleMatch[1].trim() : undefined;
  const choices: ChapterChoices[] = [];

  // Format strict puis rattrapage souple.
  const strict = /\[\[CHOIX\]\]([\s\S]*)$/.exec(head);
  if (strict) {
    collectChoices(strict[1], choices);
  } else {
    // Rattrapage : lignes "1|libelle|consequence" qui suivent un [[CHOIX
    // orthographié de près ([[CHOIX ]], [[ChoiX]], [[CHOIX]]...).
    const loose = /\[\[\s*CHOIX\s*\]\]([\s\S]*)$/i.exec(head);
    if (loose) collectChoices(loose[1], choices);
  }

  return { title, choices, bodyEnd };
}

function collectChoices(block: string, out: ChapterChoices[]): void {
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !/^\d+\s*[|.]/.test(trimmed)) continue;
    // retire l'index initial "1|" ou "1."
    const rest = trimmed.replace(/^\d+\s*[|.]\s*/, '');
    // Format "n|libellé|conséquence" : on ne coupe QUE sur le DERNIER |
    // (le libellé peut légitimement contenir une barre, ex. « Fuir | ou
    // rester ? »), la conséquence étant toujours le dernier segment.
    const last = rest.lastIndexOf('|');
    if (last === -1) {
      out.push({ libelle: rest.trim(), consequenceResumee: '' });
      continue;
    }
    out.push({ libelle: rest.slice(0, last).trim(), consequenceResumee: rest.slice(last + 1).trim() });
  }
}