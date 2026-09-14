/**
 * Format de fin de chapitre FABLE — module PUR et testable.
 * Le modèle écrit : corps → [[TITRE]]|titre → [[CHOIX]] puis des lignes
 * "n|libellé|conséquence". Le serveur streame le corps et parse la queue.
 *
 * ORDRE DE TRAITEMENT (spec correctifs FABLE) :
 *   a. texte brut complet ;
 *   b. LOCALISATION par les DERNIÈRES occurrences de la structure de fin
 *      (un [[TITRE]]/[[CHOIX]] orphelin dans la prose ne trompe pas le scan) ;
 *   c. DÉCOUPE en trois blocs : prose · titre · choix ;
 *   d. titre = ce qui suit « [[TITRE]]| » JUSQU'À la fin de ligne — jamais
 *      jusqu'au marqueur suivant — puis nettoyé des [[...]] résiduels ;
 *   e. prose nettoyée de toute chaîne de structure résiduelle ;
 *   f. garde-fous : titre vide → repli ; prose inachevée → troncature.
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
  /** Index (dans le texte) où la prose s'arrête et où commence la structure. */
  bodyEnd: number;
  /** Prose coupée en fin de génération (phrase manifestement inachevée). */
  tronquee: boolean;
}

const ANY_MARKER = /\[\[[^\]]*\]\]/g;

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

/** Retire TOUTE chaîne de structure [[...]] résiduelle d'un texte. */
export function stripMarkers(text: string): string {
  return text.replace(ANY_MARKER, '');
}

/**
 * Prose coupée en fin de génération : dernier caractère non ponctué
 * fort, ou dernier fragment de 1-2 lettres (« e. », « il. ») — une
 * phrase manifestement inachevée. Traiter la génération comme ÉCHOUÉE.
 */
export function estTronquee(prose: string): boolean {
  const fin = prose.trimEnd();
  if (!fin) return false;
  if (!/[.!?»…]$/.test(fin)) return true;
  const m = /([A-Za-zÀ-ÿ'’\-]{1,})\.?$/.exec(fin);
  const dernierMot = m ? m[1].replace(/\.$/, '').trim() : '';
  return dernierMot.length <= 2;
}

/**
 * Parse la structure de fin (titre + choix) d'un texte de chapitre.
 * La prose (avant la structure) est également nettoyée des marqueurs
 * résiduels.
 */
export function parseChapterMarkers(text: string): ChapterMeta {
  // b) LOCALISATION : les DERNIÈRES occurrences de la structure de fin.
  let idxChoix = text.lastIndexOf(CHOIX_MARKER);
  if (idxChoix < 0) {
    // Rattrapage souple : marqueur mal orthographié ([[CHoiX]], [[ CHOIX ])...).
    const loose = /\[\[\s*CHOIX\s*\]\]/gi;
    let m: RegExpExecArray | null;
    let last = -1;
    while ((m = loose.exec(text))) last = m.index;
    idxChoix = last;
  }
  const idxTitre =
    idxChoix >= 0
      ? text.lastIndexOf(TITRE_MARKER, idxChoix)
      : text.lastIndexOf(TITRE_MARKER);

  // c) DÉCOUPE : la prose s'arrête au premier marqueur valide.
  const bodyEnd =
    idxTitre >= 0 || idxChoix >= 0
      ? idxTitre >= 0 && idxChoix >= 0
        ? Math.min(idxTitre, idxChoix)
        : Math.max(idxTitre, idxChoix)
      : -1;
  const prose = bodyEnd >= 0 ? text.slice(0, bodyEnd) : text;

  // d) TITRE : jusqu'à la FIN DE LIGNE (jamais jusqu'au marqueur suivant),
  //    puis nettoyé des [[...]] ; tronqué au premier [[ | si résidu.
  let title: string | undefined;
  if (idxTitre >= 0) {
    const after = text.slice(idxTitre + TITRE_MARKER.length);
    const eol = after.search(/\n/);
    const rawTitle = (eol >= 0 ? after.slice(0, eol) : after)
      .replace(/^\s*\|?\s*/, '')
      .trim();
    const cleaned = stripMarkers(rawTitle).split(/[[|]/)[0].trim();
    title = cleaned || undefined;
  }

  // e) CHOIX : PREMIER bloc [[CHOIX]] après le titre, coupé au marqueur
  //    de structure suivant (un second bloc [[CHOIX]] est un artefact).
  const choices: ChapterChoices[] = [];
  const startBloque =
    (idxTitre >= 0 ? text.indexOf(CHOIX_MARKER, idxTitre) : text.indexOf(CHOIX_MARKER)) >= 0
      ? (idxTitre >= 0 ? text.indexOf(CHOIX_MARKER, idxTitre) : text.indexOf(CHOIX_MARKER))
      : idxChoix;
  if (startBloque >= 0) {
    const from = text.indexOf(']]', startBloque) + 2;
    const nextBracket = text.indexOf('[[', from);
    const block = nextBracket >= 0 ? text.slice(from, nextBracket) : text.slice(from);
    collectChoices(block, choices);
  }

  const tronquee = estTronquee(stripMarkers(prose));

  return { title, choices, bodyEnd, tronquee };
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