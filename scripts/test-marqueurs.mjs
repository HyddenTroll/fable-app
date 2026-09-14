/**
 * Tests unitaires du parseur de marqueurs de fin de chapitre
 * (api/lib/chapter-markers.ts) — 6 cas dont les sorties tordues prévues :
 * 1) sortie normale   2) libellé contenant un « | »   3) marqueur absent
 * 4) marqueur mal orthographié   5) « [[ » en incise dans la prose
 * 6) choix sans conséquence.
 * Exécution : node scripts/test-marqueurs.mjs (depuis la racine du repo).
 */
import esbuild from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const outfile = join(tmpdir(), 'chapter-markers.test.mjs');
esbuild.buildSync({
  entryPoints: ['api/lib/chapter-markers.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});
const { parseChapterMarkers, findFirstMarker, cleanIntertitles } = await import(`file://${outfile}`);
rmSync(outfile, { force: true });

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.error(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('1) Sortie NORMALE (titre + 2 choix)');
{
  const tail =
    '[[TITRE]]|La lettre ouverte\n' +
    '[[CHOIX]]\n' +
    '1|Décacheter la lettre|Il apprend qui l\'écrivait\n' +
    '2|Brûler la lettre|Le pêcheur le regarde, méfiant';
  const m = parseChapterMarkers(tail);
  check('titre parsé', m.title === 'La lettre ouverte', `got: ${m.title}`);
  check('2 choix', m.choices.length === 2, `got: ${m.choices.length}`);
  check('libellé 1 exact', m.choices[0]?.libelle === 'Décacheter la lettre');
  check('conséquence 2 exacte', m.choices[1]?.consequenceResumee === 'Le pêcheur le regarde, méfiant');
}

console.log('2) Libellé contenant un « | » (« Fuir | ou rester ? »)');
{
  const tail =
    '[[CHOIX]]\n' +
    '1|Fuir | ou rester ?|Il fuit et s\'en repent\n' +
    '2|Ouvrir la porte|La pièce est vide\n';
  const m = parseChapterMarkers(tail);
  check('libellé 1 conserve sa barre', m.choices[0]?.libelle === 'Fuir | ou rester ?', `got: ${m.choices[0]?.libelle}`);
  check('conséquence 1 intacte', m.choices[0]?.consequenceResumee === 'Il fuit et s\'en repent', `got: ${m.choices[0]?.consequenceResumee}`);
  check('2 choix tous les deux', m.choices.length === 2);
}

console.log('3) Marqueur [[CHOIX]] ABSENT (le modèle a oublié)');
{
  const m = parseChapterMarkers('Le texte se poursuit sans aucun marqueur.');
  check('choix vides -> filet serveur', m.choices.length === 0);
  check('pas de titre', m.title === undefined);
}

console.log('4) Marqueur mal orthographié (« [[CHoiX]] »)');
{
  const tail = '[[CHoiX]]\n1|Tester la serrure|Elle cède\n2|S\'éloigner|Le couloir s\'allonge';
  const m = parseChapterMarkers(tail);
  check('rattrapage souple : 2 choix', m.choices.length === 2, `got: ${m.choices.length}`);
  check('libellé 1 correct', m.choices[0]?.libelle === 'Tester la serrure');
}

console.log('5) « [[ » en incise dans la PROSE avant le vrai marqueur');
{
  const prose = "Le [[ de la toile se tendit dans la lumière, puis tout s'immobilisa. [[CHOIX]]\n1|Avancer|La toile se déchire";
  const idx = findFirstMarker(prose);
  check('les [[ de la prose ne trompent pas le scan', idx === prose.indexOf('[[CHOIX]]'), `got: ${idx}`);
  const m = parseChapterMarkers(prose);
  check('1 choix quand même', m.choices.length === 1);
  check('libellé intact', m.choices[0]?.libelle === 'Avancer');
}

console.log('6) Choix SANS conséquence (une seule barre)');
{
  const tail = '[[CHOIX]]\n1|Juste partir\n2|Rester|Il attend';
  const m = parseChapterMarkers(tail);
  check('libellé seul conservé', m.choices[0]?.libelle === 'Juste partir');
  check('conséquence vide tolérée', m.choices[0]?.consequenceResumee === '');
  check('2 choix', m.choices.length === 2);
}

console.log('7) ANTI-INTERTITRES : titre répété en clair dans le corps');
{
  const body =
    'Le chemin du retour paraît plus court.\n\n' +
    'Chapitre 2 · Le troisième tiroir\n\n' +
    'Elle ralentit près d\'un abribus.\n\n' +
    '— Chapitre 2 · Le troisième tiroir —\n\n' +
    'Puis la porte se referme.\n\n' +
    'Chapitre 2\n\n' +
    'Le mot reste entre vous.';
  const cleaned = cleanIntertitles(body, 'Le troisième tiroir', 2);
  check('intertitre "Chapitre 2 · titre" retiré', !cleaned.includes('Chapitre 2 · Le troisième tiroir'));
  check('variante "— Chapitre 2 · titre —" retirée', !cleaned.includes('— Chapitre 2 ·'));
  check('ligne "Chapitre 2" seule retirée', !cleaned.includes('\nChapitre 2\n'));
  check('prose conservée (début)', cleaned.startsWith('Le chemin du retour paraît plus court.'));
  check('prose conservée (fin)', cleaned.trimEnd().endsWith('Le mot reste entre vous.'));
}

console.log('8) ANTI-INTERTITRES : une phrase de prose commençant par "Chapitre" reste');
{
  const body = 'Chapitre après chapitre, la mémoire revient par fragments.';
  const cleaned = cleanIntertitles(body, 'Le troisième tiroir', 2);
  check('prose intacte', cleaned === body);
}

console.log('9) FIXTURE REVUE : marqueurs COLLÉS « [[TITRE]]|La date de demain[[CHOIX]] »');
{
  const tail = '[[TITRE]]|La date de demain[[CHOIX]]\n1|Confier la boussole|Il la perd\n2|La garder|Elle pèse';
  const m = parseChapterMarkers(tail);
  check('titre NE contient PAS le marqueur', m.title === 'La date de demain', `got: ${m.title}`);
  check('2 choix parsés', m.choices.length === 2, `got: ${m.choices.length}`);
}

console.log('10) FIXTURE REVUE : [[TITRE]] ORPHELIN au milieu de la prose');
{
  const text =
    'Le vent se leva. Peut-être [[TITRE]] était-il un mauvais présage, mais elle continua. [[TITRE]]|La marée montante\n[[CHOIX]]\n1|Rentrer|Tout se referme';
  const m = parseChapterMarkers(text);
  check('le VRAI titre est pris (pas l\'orphelin)', m.title === 'La marée montante', `got: ${m.title}`);
  check('prose coupée au vrai marqueur', m.bodyEnd === text.lastIndexOf('[[TITRE]]'), `got: ${m.bodyEnd}`);
  check('1 choix', m.choices.length === 1);
  check('libellé intact', m.choices[0]?.libelle === 'Rentrer');
}

console.log('11) FIXTURE REVUE : texte se terminant par « e. » sans marqueur → TRONCATURE');
{
  const m = parseChapterMarkers('Le récit s\'arrête en plein milieu d\'un mot, avant la fin prévue e.');
  check('tronquee = true', m.tronquee === true, `got: ${m.tronquee}`);
  check('zéro choix (structure absente)', m.choices.length === 0);
  const ok = parseChapterMarkers('Il referma la porte. Le silence revint.');
  check('prose finie : tronquee = false', ok.tronquee === false);
}

console.log('12) FIXTURE REVUE : libellé contenant un « | »');
{
  const tail = '[[CHOIX]]\n1|Fuir | ou rester ?|Il fuit sans se retourner';
  const m = parseChapterMarkers(tail);
  check('barre conservée dans le libellé', m.choices[0]?.libelle === 'Fuir | ou rester ?', `got: ${m.choices[0]?.libelle}`);
  check('conséquence = dernier segment', m.choices[0]?.consequenceResumee === 'Il fuit sans se retourner');
}

console.log('13) FIXTURE REVUE : bloc [[CHOIX]] avec UNE seule ligne');
{
  const tail = '[[CHOIX]]\n1|Ouvrir la boîte|Elle grince';
  const m = parseChapterMarkers(tail);
  check('1 choix', m.choices.length === 1, `got: ${m.choices.length}`);
  check('libellé exact', m.choices[0]?.libelle === 'Ouvrir la boîte');
}

console.log('14) FIXTURE REVUE : DEUX blocs [[CHOIX]] dans le même texte');
{
  const tail = '[[TITRE]]|Double jeu\n[[CHOIX]]\n1|Forcer la porte|Elle cède\n[[CHOIX]]\n2|Frapper|Réveiller les voisins';
  const m = parseChapterMarkers(tail);
  check('un seul bloc retenu (le premier)', m.choices.length === 1, `got: ${m.choices.length}`);
  check('libellé sans marqueur', m.choices[0]?.libelle === 'Forcer la porte', `got: ${m.choices[0]?.libelle}`);
}

console.log(`\nRésultat : ${pass} ✔ / ${fail} ✘`);
process.exit(fail > 0 ? 1 : 0);