/** Nettoie un fragment de texte généré : retire les caractères de dessin
 *  (cadres ASCII, blocs, formes) et les séparateurs décoratifs que certains
 *  modèles laissent échapper — jamais de place dans un roman. */
export function cleanText(t: string): string {
  return t
    // Boîtes de dessin (╔═╗║╚╝┌┐…) + blocs pleins (█▀▄▌…)
    .replace(/[\u2500-\u259F]/g, '')
    // Formes géométriques (■□◆●▲…) : séparateurs décoratifs
    .replace(/[\u25A0-\u25FF\u2B00-\u2BFF]/g, '')
    // Lignes de séparation en série (----, ====, ____, ~~~~, #####)
    .replace(/[-—_=~#]{4,}/g, '')
    // Lignes de cadratins/secrets isolées (——— sur une ligne entière)
    .replace(/^[—–\s]+$/gm, '')
    // Trois retours à la ligne ou plus → deux
    .replace(/\n{3,}/g, '\n\n');
}