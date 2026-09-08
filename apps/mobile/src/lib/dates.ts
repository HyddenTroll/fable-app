/** Dates relatives — jamais d'ISO brut à l'écran. Toujours en minuscules. */
export function formatDateRelative(iso: string, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = now - t;
  const MIN = 60_000, H = 3_600_000, J = 86_400_000;
  if (diff < MIN) return "à l'instant";
  if (diff < 12 * H) {
    const h = Math.floor(diff / H);
    return h <= 1 ? 'il y a 1 heure' : `il y a ${h} heures`;
  }
  const d = new Date(t);
  const n = new Date(now);
  const memeJour = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  if (memeJour && diff < J) {
    const h = d.getHours();
    if (h < 12) return 'ce matin';
    if (h < 18) return 'cet après-midi';
    return 'ce soir';
  }
  const hier = new Date(n);
  hier.setDate(n.getDate() - 1);
  const memeDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (memeDate(d, hier)) return 'hier';
  if (diff < 7 * J) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long' });
  }
  if (diff < 365 * J) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Progression : chapitre courant vs total (1..N, borné). */
export function progression(chapter: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(1, chapter / total));
}

/** Solde ramené sur une échelle de 5 denticules (arrondi bas, borné). */
export function encresSur5(solde: number): number {
  if (solde <= 0) return 0;
  return Math.max(1, Math.min(5, Math.floor(solde / 6)));
}