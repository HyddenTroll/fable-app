/**
 * Test CLI de cohérence (v2 - état structuré).
 * 2 runs x 20 chapitres max, sur le pipeline de l'API (bible_text figée +
 * état structuré + résumé glissant + 3 derniers chapitres).
 *
 * Mesure PAR APPEL : tokens in (dont cachés), out, coût, latence.
 * Colonnes séparées : chapter / choices / summary / state.
 * Faits replacés pour SÉPARER âge vs type :
 *   - blessure tardive (ch.12) + objet tardif (ch.13)  -> "état héros" récent
 *   - PNJ nommé précoce (ch.2) + promesse précoce (ch.3) -> "narration" ancienne
 * Au ch.20 : question de rappel + vérification de l'état structuré.
 *
 * Usage : node --env-file=.env scripts/test-coherence.mjs
 */

import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY manquante (lancer avec --env-file=.env)');
  process.exit(1);
}

const bundlePath = path.join(root, '.vercel', 'tmp-test', 'coh-libs.js');
await build({
  entryPoints: [path.join(root, 'scripts', 'coh-entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: bundlePath,
  logLevel: 'error',
  external: ['@vercel/node'],
});
const libs = require(bundlePath);
const {
  getLLM,
  buildStoryBiblePrompt,
  buildProloguePrompt,
  buildChapterMessages,
  buildChoicesPrompt,
  buildSummaryPrompt,
  buildSystemPrompt,
  buildStatePrompt,
} = libs;

const N_CHAPTERS = Number(process.env.N_CHAPTERS ?? 8);
const N_RUNS = Number(process.env.N_RUNS ?? 1);
// Arrêt par défaut au ch.8 (validation cache + état) - économie de crédits
const STOP_AT = Number(process.env.STOP_AT ?? 8) || N_CHAPTERS;

// ---------------------------------------------------------------------------
// Faits : type + chapitre pour séparer âge vs type
// ---------------------------------------------------------------------------
const FACTS = [
  { id: 'pnj_precoce', label: 'PNJ nommé (Sergent Marrek) - ch.2', ch: 2, type: 'narration', keyword: ['Marrek'] },
  { id: 'promesse_precoce', label: 'Promesse à Elena - ch.3', ch: 3, type: 'narration', keyword: ['promesse', 'Elena'] },
  { id: 'blessure_tardive', label: 'Blessure bras (ch.12)', ch: 12, type: 'etat', keyword: ['bras', 'blessure', 'plaie'] },
  { id: 'objet_tardif', label: 'Objet : médaillon de jade (ch.13)', ch: 13, type: 'etat', keyword: ['médaillon', 'jade'] },
];

const RECALL_QUESTION = `Question de vérification : réponds brièvement en français.
(a) Qui est le Sergent Marrek ? (b) Quelle promesse le héros a-t-il faite à Elena ?
(c) Quelle blessure physique le héros porte-t-il encore ? (d) Quel objet précieux a-t-il ramassé récemment ?`;

function directiveForChapter(n) {
  const map = {
    2: 'Incluez : le héros rencontre un personnage secondaire nommé Sergent MARREK (officier sévère). Nommez-le plusieurs fois.',
    3: 'Incluez : le héros fait une PROMESSE solennelle à une femme nommée ELENA (protéger son village).',
    12: 'Incluez : pendant l\'action, le héros reçoit une blessure au BRAS GAUCHE (coupure profonde qui saigne). Montrez la douleur. Ne le guérissez pas.',
    13: 'Incluez : le héros ramasse un MÉDAILLON DE JADE (objet ancien, gravé). Mentionnez-le clairement.',
  };
  return map[n] ?? null;
}

const choiceStrategies = [
  (choices, i) => 0,
  (choices, i) => i % (choices?.length || 1),
];

function fmt(c) {
  return `$${c.toFixed(6)}`;
}

async function run(seed, runIndex) {
  const llm = getLLM();
  const system = buildSystemPrompt();
  const params = {
    genre: 'fantasy',
    subGenre: 'high',
    difficulty: 'moyenne',
    chapterLength: 'court',
    style: 'classique',
    maxChoices: 3,
  };
  const age = 'adult';
  const pick = choiceStrategies[seed];

  const bibleGen = await llm.generateJson({
    messages: [{ role: 'system', content: system }, { role: 'user', content: buildStoryBiblePrompt(params, age) }],
    kind: 'story_bible',
    maxTokens: 3000,
  });
  const bible = bibleGen.json;
  const bibleText = bibleGen.result.text; // verbatim, comme en prod

  const prologueGen = await llm.generateJson({
    messages: [{ role: 'system', content: system }, { role: 'user', content: buildProloguePrompt(bible, params, age) }],
    kind: 'prologue',
    maxTokens: 2500,
  });
  const prologue = prologueGen.json;
  let resume = bible.resumeGeneral ?? '';

  // État structuré (init vide, comme en prod)
  let state = { blessures: [], inventaire: [], pnj: [], engagements: [], lieu: '' };

  let recentChapters = [];
  const rows = [];
  let stopReason = 'terminé';

  for (let n = 1; n <= STOP_AT; n++) {
    const context = `${resume}\n\nDerniers chapitres :\n${recentChapters
      .map((c) => `--- ${c.title} ---\n${c.text}`)
      .join('\n\n')}`;

    const directive = directiveForChapter(n);
    const { system: sysMsg, stable, volatile } = buildChapterMessages({
      bible,
      bibleText,
      state: JSON.stringify(state),
      resume: context,
      playerChoice: recentChapters.length ? recentChapters[recentChapters.length - 1].choice : undefined,
      chapterNumber: n,
      totalChapters: N_CHAPTERS,
      act: n <= 4 ? 'Acte 1' : n <= 8 ? 'Acte 2' : n <= 12 ? 'Acte 3' : 'Dénouement',
      phase: '',
      params,
      age,
      rule: directive,
    });
    const chapterMessages = [
      { role: 'system', content: sysMsg },
      { role: 'user', content: stable },
      { role: 'user', content: volatile },
    ];

    // CHAPITRE (texte brut, json=false)
    const t0 = Date.now();
    const chapterRes = await llm.generate({
      messages: chapterMessages,
      kind: 'chapter',
      maxTokens: 4000,
    });
    const chapterMs = Date.now() - t0;
    const chapterText = chapterRes.text;

    // CHOICES (json)
    const t1 = Date.now();
    let choices = [];
    let title = `Chapitre ${n}`;
    try {
      const cg = await llm.generateJson({
        messages: [{ role: 'system', content: system }, { role: 'user', content: buildChoicesPrompt({ bible, chapterText, chapterNumber: n, maxChoices: params.maxChoices, age }) }],
        kind: 'choices',
        maxTokens: 800,
      });
      choices = cg.json.choix ?? [];
      title = cg.json.titre ?? title;
    } catch { choices = []; }
    const choicesMs = Date.now() - t1;

    // SUMMARY (texte brut)
    const t2 = Date.now();
    const summaryRes = await llm.generate({
      messages: [{ role: 'system', content: system }, { role: 'user', content: buildSummaryPrompt(resume, chapterText, choices[0]?.libelle) }],
      kind: 'summary',
      maxTokens: 600,
    });
    const summaryMs = Date.now() - t2;
    resume = summaryRes.text;

    // STATE (json - deltas appliqués par le code)
    const t3 = Date.now();
    let stateMs = 0;
    let stateTokensIn = 0;
    let stateTokensOut = 0;
    let stateCost = 0;
    try {
      const sg = await llm.generateJson({
        messages: [{ role: 'system', content: system }, { role: 'user', content: buildStatePrompt({ state: JSON.stringify(state), chapterText }) }],
        kind: 'state',
        maxTokens: 800,
      });
      stateMs = Date.now() - t3;
      stateTokensIn = sg.result.usage.inputTokens;
      stateTokensOut = sg.result.usage.outputTokens;
      stateCost = sg.result.costUsd;
      state = applyStatePatch(state, sg.json);
    } catch { /* garde l'état précédent */ }

    recentChapters.push({ title, text: chapterText, choice: choices[0]?.libelle });
    if (recentChapters.length > 3) recentChapters.shift();

    const chapterCost = chapterRes.costUsd;
    const summaryCost = summaryRes.costUsd;

    rows.push({
      n,
      title: title.slice(0, 20),
      chapterIn: chapterRes.usage.inputTokens,
      chapterCached: chapterRes.usage.cachedInputTokens,
      chapterOut: chapterRes.usage.outputTokens,
      chapterCost,
      chapterMs,
      summaryIn: summaryRes.usage.inputTokens,
      summaryOut: summaryRes.usage.outputTokens,
      summaryCost,
      summaryMs,
      stateIn: stateTokensIn,
      stateOut: stateTokensOut,
      stateCost,
      stateMs,
      totalCost: chapterCost + summaryCost + stateCost,
    });
  }

  // Rappel + état structuré
  const contextEnd = `${resume}\n\nDerniers chapitres :\n${recentChapters
    .map((c) => `--- ${c.title} ---\n${c.text}`)
    .join('\n\n')}`;
  const recallRes = await llm.generate({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${RECALL_QUESTION}\n\nBIBLE :\n${bibleText}\n\n${contextEnd}\n\nÉtat du héros :\n${JSON.stringify(state, null, 2)}` },
    ],
    kind: 'summary',
    maxTokens: 600,
  });
  const recall = recallRes.text;

  const factResults = FACTS.map((f) => {
    const hit = f.keyword.some((k) => recall.toLowerCase().includes(k.toLowerCase()));
    return { id: f.id, label: f.label, type: f.type, recalled: hit };
  });

  return { runIndex, seed, bible, prologue, rows, factResults, recall, state, bibleCost: bibleGen.result.costUsd + prologueGen.result.costUsd };
}

/** Applique les deltas d'état (copie locale du module state). */
function applyStatePatch(prev, delta) {
  if (!delta) return prev;
  const next = {
    blessures: [...prev.blessures],
    inventaire: [...prev.inventaire],
    pnj: [...prev.pnj],
    engagements: [...prev.engagements],
    lieu: delta.lieu ?? prev.lieu,
  };
  for (const w of delta.blessures?.ajouter ?? []) {
    if (!w.quoi) continue;
    next.blessures.push({ id: 'b' + next.blessures.length, quoi: w.quoi, depuis: w.depuis ?? 0, grave: w.grave ?? false });
  }
  for (const id of delta.blessures?.soigner ?? []) {
    const f = next.blessures.find((b) => b.id === id || b.quoi === id);
    if (f) f.soigne = true;
  }
  for (const it of delta.inventaire?.ajouter ?? []) {
    if (!it.objet) continue;
    next.inventaire.push({ id: 'i' + next.inventaire.length, objet: it.objet, depuis: it.depuis ?? 0 });
  }
  for (const p of delta.pnj?.ajouter ?? []) {
    if (!p.nom) continue;
    next.pnj.push({ id: 'p' + next.pnj.length, nom: p.nom, relation: p.relation ?? '', statut: 'vivant' });
  }
  for (const t of delta.pnj?.tuer ?? []) {
    const f = next.pnj.find((p) => p.id === t || p.nom === t);
    if (f) f.statut = 'mort';
  }
  for (const e of delta.engagements?.ajouter ?? []) {
    if (!e.envers) continue;
    next.engagements.push({ id: 'e' + next.engagements.length, envers: e.envers, quoi: e.quoi ?? '' });
  }
  return next;
}

async function main() {
  console.log(`=== Test cohérence v2 (état structuré) : ${N_RUNS} runs x ${STOP_AT} chapitres ===\n`);
  const allResults = [];

  for (let seed = 0; seed < N_RUNS; seed++) {
    console.log(`--- RUN ${seed + 1} (seed choix=${seed}) ---`);
    const r = await run(seed, seed);

    console.log(`Init: bible ${fmt(r.bibleCost)} (bible+prologue)`);
    console.log('| ch | titre | ch.in (cach) | ch.out | ch.coût | ch.ms | sum.in | sum.coût | sum.ms | st.in | st.out | st.coût | TOTAL |');
    console.log('|----|-------|-------------|--------|---------|-------|--------|----------|--------|-------|--------|---------|-------|');
    let runTotal = 0;
    for (const row of r.rows) {
      runTotal += row.totalCost;
      console.log(
        `| ${String(row.n).padEnd(2)} | ${String(row.title).padEnd(7)} | ${String(row.chapterIn).padEnd(4)} (${String(row.chapterCached).padEnd(3)}) | ${String(row.chapterOut).padEnd(6)} | ${fmt(row.chapterCost).padEnd(8)} | ${String(row.chapterMs).padEnd(6)} | ${String(row.summaryIn).padEnd(4)} | ${fmt(row.summaryCost).padEnd(9)} | ${String(row.summaryMs).padEnd(6)} | ${String(row.stateIn).padEnd(5)} | ${String(row.stateOut).padEnd(6)} | ${fmt(row.stateCost).padEnd(8)} | ${fmt(row.totalCost)} |`,
      );
    }
    console.log(`\nCoût total run ${seed + 1}: ${fmt(runTotal)} | coût moyen/ch: ${fmt(runTotal / Math.max(1, r.rows.length))}`);
    console.log('Cache: aucun input caché? -> chapitreIn ~ stable autour de 3.3k si cache actif sur la bible\n');

    console.log('Faits rappelés au ch.20 :');
    for (const f of r.factResults) {
      console.log(`  ${f.recalled ? '✔' : '✘'} [${f.type}] ${f.label}`);
    }
    console.log('\nÉtat structuré final :');
    console.log(`  blessures: ${JSON.stringify(r.state.blessures)}`);
    console.log(`  inventaire: ${JSON.stringify(r.state.inventaire)}`);
    console.log(`  pnj: ${JSON.stringify(r.state.pnj)}`);
    console.log(`  engagements: ${JSON.stringify(r.state.engagements)}\n`);
    allResults.push(r);
  }

  // Synthèse
  console.log('=== SYNTHÈSE ===');
  for (const f of FACTS) {
    const lost = allResults.filter((r) => !r.factResults.find((x) => x.id === f.id).recalled).length;
    const status = lost === 0 ? 'OK (tous)' : lost >= allResults.length ? '✘✘ PERDU' : `⚠ ${lost}/${allResults.length} perdus`;
    console.log(`  [${f.type}] ${f.label}: ${status}`);
  }
  const avg = allResults.reduce((s, r) => s + r.rows.reduce((x, y) => x + y.totalCost, 0), 0) / (allResults.length * Math.max(1, allResults[0]?.rows.length ?? 1));
  console.log(`\nCoût moyen/chapitre (tous runs): ${fmt(avg)}`);
  console.log(`200 chapitres extrapolés: ${fmt(avg * 200)}`);
}

main().catch((e) => {
  console.error('ERREUR:', e);
  process.exit(1);
});