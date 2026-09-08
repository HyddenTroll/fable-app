/** Tests unitaires du module variété (api/lib/variety.ts). */
import esbuild from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const outfile = join(tmpdir(), 'variety.test.mjs');
esbuild.buildSync({
  entryPoints: ['api/lib/variety.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});
const { tirerVecteur, titreTropProche, GABARITS_TITRE, PROFILS_AUTEURS, THEMES_PAR_GENRE } = await import(
  `file://${outfile}`
);
rmSync(outfile, { force: true });

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('1) Tirage du vecteur : champs complets et variés');
{
  const v = tirerVecteur('fantasy');
  check('theme présent', typeof v.theme === 'string' && v.theme.length > 3, v.theme);
  check('ton présent', typeof v.ton === 'string');
  check('lieu présent', typeof v.lieu === 'string');
  check('époque présente', typeof v.epoque === 'string');
  check('enjeu présent', typeof v.enjeu === 'string');
  check('gabarit titre issu de la liste', GABARITS_TITRE.includes(v.gabaritTitre));
  check('auteur issu des profils', PROFILS_AUTEURS.some((a) => a.nom === v.auteur.nom));
  check('twist optionnel (string ou absent)', v.twist === undefined || typeof v.twist === 'string');
}

console.log('2) Variété : 20 tirages fantasy/horreur produisent des combinaisons différentes');
{
  const vues = new Set();
  for (let i = 0; i < 20; i++) {
    const v = tirerVecteur(i % 2 === 0 ? 'fantasy' : 'horreur');
    vues.add(`${v.theme}|${v.ton}|${v.lieu}|${v.epoque}`);
  }
  check('≥ 15 combinaisons distinctes sur 20', vues.size >= 15, `${vues.size} distinctes`);
  check('thème fantasy != thème horreur probable (au moins 1 de chaque genre)',
    THEMES_PAR_GENRE.fantasy.length > 10 && THEMES_PAR_GENRE.horreur.length > 10);
}

console.log('3) Anti-doublon : identique, proche, différent');
{
  const connus = ['Les Voix de la Marée', 'La Lanterne des seuils'];
  check('égal exact → doublon', titreTropProche('Les Voix de la Marée', connus));
  check('égal avec casse/accents → doublon', titreTropProche('les voix de la maree', connus));
  check('2 mots-clés communs → proche', titreTropProche('La Marée des Voix', connus));
  check('aucun mot-clé commun → ok', !titreTropProche('Rouille', connus));
  check('liste vide → ok', !titreTropProche('Nimporte quoi', []));
  check('titre court sans mots-clés → ok', !titreTropProche('Oui', connus));
}

console.log(`\nRésultat : ${pass} ✔ / ${fail} ✘`);
process.exit(fail > 0 ? 1 : 0);