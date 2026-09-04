/**
 * État structuré du héros - mis à jour de façon DÉTERMINISTE.
 * Le modèle renvoie des DELTAS, le code applique le patch.
 * Rien ne s'efface sans instruction explicite (contrairement au
 * résumé en prose qui oublie). Le résumé reste pour l'intrigue/le ton.
 */

export interface Wound {
  id: string;
  quoi: string;
  depuis: number;
  grave: boolean;
  soigne?: boolean;
}

export interface InventoryItem {
  id: string;
  objet: string;
  depuis: number;
}

export interface NpcEntry {
  id: string;
  nom: string;
  statut: 'vivant' | 'mort' | 'inconnu';
  relation: string;
  depuis: number;
}

export interface Engagement {
  id: string;
  envers: string;
  quoi: string;
  depuis: number;
}

export interface HeroState {
  blessures: Wound[];
  inventaire: InventoryItem[];
  pnj: NpcEntry[];
  engagements: Engagement[];
  lieu: string;
}

/** Deltas renvoyés par le modèle après chaque chapitre. */
export interface StateDelta {
  blessures?: {
    ajouter?: Partial<Wound>[];
    soigner?: string[]; // ids
  };
  inventaire?: {
    ajouter?: Partial<InventoryItem>[];
  };
  pnj?: {
    ajouter?: Partial<NpcEntry>[];
    tuer?: string[]; // ids (ou noms)
  };
  engagements?: {
    ajouter?: Partial<Engagement>[];
  };
  lieu?: string;
}

export function emptyState(): HeroState {
  return { blessures: [], inventaire: [], pnj: [], engagements: [], lieu: '' };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Applique les deltas sur l'état courant (déterministe, idempotent). */
export function applyStateDelta(prev: HeroState, delta: StateDelta | null | undefined, chapterNumber: number): HeroState {
  if (!delta) return prev;

  const next: HeroState = {
    blessures: [...prev.blessures],
    inventaire: [...prev.inventaire],
    pnj: [...prev.pnj],
    engagements: [...prev.engagements],
    lieu: delta.lieu ?? prev.lieu,
  };

  // Blessures : ajouter + soigner
  for (const w of delta.blessures?.ajouter ?? []) {
    if (!w.quoi) continue;
    next.blessures.push({
      id: uid('b'),
      quoi: w.quoi,
      depuis: w.depuis ?? chapterNumber,
      grave: w.grave ?? false,
    });
  }
  for (const id of delta.blessures?.soigner ?? []) {
    const found = next.blessures.find((b) => b.id === id || b.quoi === id);
    if (found) found.soigne = true;
  }

  // Inventaire : ajouter (jamais retirer implicitement)
  for (const it of delta.inventaire?.ajouter ?? []) {
    if (!it.objet) continue;
    next.inventaire.push({ id: uid('i'), objet: it.objet, depuis: it.depuis ?? chapterNumber });
  }

  // PNJ : ajouter + tuer (par id ou nom)
  for (const n of delta.pnj?.ajouter ?? []) {
    if (!n.nom) continue;
    next.pnj.push({ id: uid('p'), nom: n.nom, statut: 'vivant', relation: n.relation ?? '', depuis: n.depuis ?? chapterNumber });
  }
  for (const target of delta.pnj?.tuer ?? []) {
    const found = next.pnj.find((p) => p.id === target || p.nom === target);
    if (found) found.statut = 'mort';
  }

  // Engagements : ajouter
  for (const e of delta.engagements?.ajouter ?? []) {
    if (!e.envers) continue;
    next.engagements.push({ id: uid('e'), envers: e.envers, quoi: e.quoi ?? '', depuis: e.depuis ?? chapterNumber });
  }

  return next;
}

/** Sérialise l'état de façon STABLE (ordre de clés fixe) pour le cache. */
export function serializeState(state: HeroState): string {
  return JSON.stringify({
    blessures: state.blessures.map((b) => ({ id: b.id, quoi: b.quoi, depuis: b.depuis, grave: b.grave, soigne: b.soigne ?? false })),
    inventaire: state.inventaire.map((i) => ({ id: i.id, objet: i.objet, depuis: i.depuis })),
    pnj: state.pnj.map((p) => ({ id: p.id, nom: p.nom, statut: p.statut, relation: p.relation, depuis: p.depuis })),
    engagements: state.engagements.map((e) => ({ id: e.id, envers: e.envers, quoi: e.quoi, depuis: e.depuis })),
    lieu: state.lieu,
  });
}

/** Parser tolérant (le modèle peut renvoyer du texte autour du JSON). */
export function parseStateDelta(text: string): StateDelta | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as StateDelta;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}