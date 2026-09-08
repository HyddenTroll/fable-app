/**
 * TEST A/B BIBLE — avant/après sur LE MÊME livre.
 * Compare l'enrichissement actuel (v1) au prompt v2 (frise, relations,
 * cartes de scènes par acte, setups→payoffs, question dramatique).
 *
 * Métriques : usage réel (input/output/cached tokens), taille JSON du
 * résultat, présence des nouvelles sections, coût estimé, et la taille
 * du PRÉFIXE STABLE qui sera injecté à chaque chapitre (la bible
 * complète = le bloc cache) — c'est le chiffre de dilution à surveiller.
 *
 * Prérequis : OPENAI_API_KEY dans .env (clé absente localement, cf.
 * journal item 7 — recopier depuis l'autre PC), modèle gpt-5.6-luna.
 *
 * Usage : node scripts/test-bible-ab.mjs [--bible chemin.json]
 *   --bible : quick bible JSON (optionnel, une bible de référence est
 *   embarquée sinon). Les deux appels partent de LA MÊME bible.
 */
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Charge .env minimalement (jamais d'affichage de clé)
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 10) {
  console.error(
    '✘ OPENAI_API_KEY absente du .env local (longueur détectée : ' +
      (process.env.OPENAI_API_KEY ?? '').length +
      '). Clé à recopier depuis l\'autre PC (journal item 7) : `vercel env pull` renvoie des valeurs vides.',
  );
  process.exit(1);
}

const { OpenAI } = await import('openai');

// Bundle des prompts (TS → ESM). esbuild résout ./variety et
// @fable/shared depuis le workspace.
const outfile = join(tmpdir(), 'prompts-bible-ab.mjs');
esbuild.buildSync({
  entryPoints: ['api/lib/prompts.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});
const mod = await import(`file://${outfile}`);
rmSync(outfile, { force: true });

const { buildSystemPrompt, buildEnrichBiblePrompt, buildEnrichBiblePromptV2 } = mod;

// ---------------------------------------------------------------------------
// BIBLE DE RÉFÉRENCE (légère, réaliste — ou fournie via --bible)
// ---------------------------------------------------------------------------
const REF_BIBLE = {
  titre: 'La Lanterne des seuils',
  genre: 'fantasy',
  sousGenre: 'quête urbaine contemplative',
  logline: 'À la caserne devenue musée, un héros découvre un film de 1950 montrant sa ville actuelle et suit l\'eau disparue vers un seuil interdit.',
  questionDramatique: 'Que cache l\'eau disparue ?',
  theme: 'Regarder en face ce que les villes et les vivants enterrent.',
  these: 'Le courage commence quand on cesse de protéger son mensonge.',
  resumeGeneral: 'Synopsis complet avec fin révélée, à but de travail.',
  structure: {
    squelette: {
      ouverture: 'Le héros guide des touristes dans le musée-caserne.',
      incidentDeclencheur: 'Un film amateur daté de 1950 montre la ville actuelle.',
      engagement: 'Il suit le carnet annoté et l\'eau disparue.',
      pointMedian: 'La lanterne révèle les gestes cachés du peintre Sorel.',
      toutEstPerdu: 'Le souterrain s\'effondre, le film brûle, la lanterne est perdue.',
      climax: 'Devant le tribunal de statues, il répond sans mentir.',
      denouement: 'Il franchit le seuil interdit et laisse partir son besoin de lumière.',
    },
  },
  heros: {
    nom: 'Yohan', desir: 'Comprendre l\'anomalie', peur: 'Le noir', faille: 'Il allume la lumière avant de réfléchir',
    blessure: 'Un proche est mort seul dans une panne générale.', mensonge: 'S\'il surveille tout, personne ne disparaîtra.',
    verite: 'On accompagne les vivants sans contrôler leur départ.', besoinInconscient: 'Accepter qu\'aucune veille ne protège de toute perte.',
  },
  antagoniste: { nom: 'Sorel, le peintre des ruines', motivation: 'Préserver les secrets urbains en détruisant leurs façades.', logique: 'Une ville sauvée de ses traces devient enfin honnête.' },
  monde: { description: 'Ville contemporaine sur un ancien réseau magique d\'eau et de seuils.', regles: 'La lanterne révèle un secret gestuel au prix d\'un souvenir.' },
  tonStyle: 'Présent nerveux, ironie froide, descriptions urbaines précises.',
  planDirecteur: { destination: 'Le héros répond au tribunal des statues.', fins: ['Vraie réponse : quartier sauvé, mémoire amputée.', 'Réponse flatteuse : seuil fermé, ville stérile.', 'Mensonge : Sorel gagne.'] },
};

const args = process.argv.slice(2);
const bibleArg = args.find((a) => a.startsWith('--bible='))?.split('=')[1];
const quickBible = bibleArg ? JSON.parse(readFileSync(bibleArg, 'utf8')) : REF_BIBLE;
const params = {
  genre: 'fantasy', difficulty: 'moyenne', chapterLength: 'long', style: 'realiste', maxChoices: 3,
};
const voix = { nom: 'Réalisme classique', consigne: 'prose classique équilibrée' };
const age = 'adult';

const system = buildSystemPrompt();
const prompts = {
  v1: buildEnrichBiblePrompt(quickBible, params, age, voix),
  v2: buildEnrichBiblePromptV2(quickBible, params, age, voix),
};

console.log(`Bible d'entrée : ${bibleArg ?? 'référence embarquée'} (${JSON.stringify(quickBible).length} chars)\n`);

async function generate(label, prompt) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const started = Date.now();
  const res = await client.chat.completions.create({
    model: 'gpt-5.6-luna',
    max_completion_tokens: 10000,
    temperature: 1,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
  const text = res.choices[0]?.message?.content ?? '';
  const usage = res.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  const cost = ((usage.prompt_tokens ?? 0) * 0.2 + (usage.completion_tokens ?? 0) * 1.2) / 1_000_000;
  let jsonSize = text.length;
  let words = text.split(/\s+/).length;
  let sections = {};
  for (const s of ['frise', 'relations', 'cartesDeScenes', 'setupsPayoffs', 'questionDramatique', 'traitsPhysiques', 'jamaisFera']) {
    sections[s] = text.includes(`"${s}"`);
  }
  console.log(`${label} :`);
  console.log(`  durée      : ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(`  input      : ${usage.prompt_tokens} tokens (cached: ${usage.prompt_tokens_details?.cached_tokens ?? 0})`);
  console.log(`  output     : ${usage.completion_tokens} tokens`);
  console.log(`  coût       : ${cost.toFixed(5)} $`);
  console.log(`  JSON taille: ${jsonSize} chars / ${words} mots`);
  console.log(`  sections   : ${Object.entries(sections).filter(([, v]) => v).map(([k]) => k).join(', ') || 'aucune'} (v2 demandées)`);
  console.log(`  préfixe stable injecté à chaque chapitre (bloc cache) : ~${jsonSize} chars ≈ ${(words / 1.6).toFixed(0)} tokens estimés`);
  console.log('');
  return { text, usage, cost, jsonSize, words, sections };
}

const r1 = await generate('V1 (actuel)', prompts.v1);
const r2 = await generate('V2 (nouveau)', prompts.v2);

console.log('── Comparaison ──');
console.log(`  Taille JSON  : v1 ${r1.jsonSize} → v2 ${r2.jsonSize} (${((r2.jsonSize / Math.max(r1.jsonSize, 1)) - 1) * 100 > 0 ? '+' : ''}${(((r2.jsonSize / Math.max(r1.jsonSize, 1)) - 1) * 100).toFixed(0)} %)`);
console.log(`  Output tokens: v1 ${r1.usage.completion_tokens} → v2 ${r2.usage.completion_tokens}`);
console.log(`  Coût         : v1 ${r1.cost.toFixed(5)} $ → v2 ${r2.cost.toFixed(5)} $`);
const newSections = Object.keys(r2.sections).filter((k) => r2.sections[k]);
console.log(`  Sections v2 présentes : ${newSections.length}/7 (${newSections.join(', ') || 'aucune'})`);
console.log('\nVerdict : la dilution du préfixe se lit sur "préfixe stable estimé" (v2 vs v1) et les sections v2 manquantes. Si le préfixe grossit de +30 % ou si des sections manquent, ajuster la concision du prompt v2 avant de brancher.');