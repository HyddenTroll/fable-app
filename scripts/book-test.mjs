/**
 * book-test.mjs — Génère un livre complet de 4 chapitres via le pipeline
 * réel de l'API (bible + prologue + chapitres + choix + résumé + état + fin),
 * puis écrit un HTML lisible (thème Fable : ambre/or + bleu nuit).
 *
 * Usage : node --env-file=.env scripts/book-test.mjs
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY manquante (lancer avec --env-file=.env)');
  process.exit(1);
}

const tmpDir = path.join(root, '.vercel', 'tmp-test');
fs.mkdirSync(tmpDir, { recursive: true });
const bundlePath = path.join(tmpDir, 'book-libs.js');
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

const N_CHAPTERS = 4;
const CHOICE_INDEX = 0; // chemin suivi par le livre (choix n°1)
const PARAMS = {
  genre: 'fantasy',
  subGenre: 'high',
  difficulty: 'moyenne',
  chapterLength: 'court',
  style: 'classique',
  maxChoices: 3,
};
const AGE = 'adult';
const ACT = (n) => (n <= 1 ? 'Acte 1' : n === 2 ? 'Acte 1' : n === 3 ? 'Acte 2' : 'Acte 3 - Dénouement');
const PHASE = (n) =>
  n === 1 ? 'montée de tension' : n === 2 ? 'point de bascule' : n === 3 ? 'avant-climax' : 'climax imminent';

function fmt(c) {
  return `$${c.toFixed(5)}`;
}

/** Copie locale de applyStateDelta (même logique que state.ts). */
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

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function para(text) {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function main() {
  const llm = getLLM();
  const system = buildSystemPrompt();
  console.log(`=== Livre test : ${N_CHAPTERS} chapitres (genre ${PARAMS.genre} ${PARAMS.subGenre}, âge ${AGE}) ===\n`);

  // 1. STORY BIBLE
  console.log('→ Bible…');
  const bibleGen = await llm.generateJson({
    messages: [{ role: 'system', content: system }, { role: 'user', content: buildStoryBiblePrompt(PARAMS, AGE) }],
    kind: 'story_bible',
    maxTokens: 6000,
  });
  const bible = bibleGen.json;
  const bibleText = bibleGen.result.text;

  // 2. PROLOGUE
  console.log('→ Prologue…');
  const prologueGen = await llm.generateJson({
    messages: [{ role: 'system', content: system }, { role: 'user', content: buildProloguePrompt(bible, PARAMS, AGE) }],
    kind: 'prologue',
    maxTokens: 6000,
  });
  const prologue = prologueGen.json;

  let resume = bible.resumeGeneral ?? '';
  let state = { blessures: [], inventaire: [], pnj: [], engagements: [], lieu: '' };
  let recentChapters = [];
  const chapters = [];
  let totalCost = bibleGen.result.costUsd + prologueGen.result.costUsd;

  // 3. CHAPITRES 1..N
  for (let n = 1; n <= N_CHAPTERS; n++) {
    console.log(`→ Chapitre ${n}/${N_CHAPTERS}…`);
    const context = `${resume}\n\nDerniers chapitres :\n${recentChapters
      .map((c) => `--- ${c.title} ---\n${c.text}`)
      .join('\n\n')}`;

    const { system: sysMsg, stable, volatile } = buildChapterMessages({
      bible,
      bibleText,
      state: JSON.stringify(state),
      resume: context,
      playerChoice: recentChapters.length ? recentChapters[recentChapters.length - 1].choice : undefined,
      chapterNumber: n,
      totalChapters: N_CHAPTERS,
      act: ACT(n),
      phase: PHASE(n),
      params: PARAMS,
      age: AGE,
    });

    const chapterRes = await llm.generate({
      messages: [{ role: 'system', content: sysMsg }, { role: 'user', content: stable }, { role: 'user', content: volatile }],
      kind: 'chapter',
      maxTokens: 4000,
    });
    totalCost += chapterRes.costUsd;
    const chapterText = chapterRes.text.trim();

    const choicesGen = await llm.generateJson({
      messages: [{ role: 'system', content: system }, { role: 'user', content: buildChoicesPrompt({ bible, chapterText, chapterNumber: n, maxChoices: PARAMS.maxChoices, age: AGE }) }],
      kind: 'choices',
      maxTokens: 800,
    });
    totalCost += choicesGen.result.costUsd;
    const choice = choicesGen.json.choix?.[CHOICE_INDEX];
    const title = choicesGen.json.titre ?? `Chapitre ${n}`;

    const summaryRes = await llm.generate({
      messages: [{ role: 'system', content: system }, { role: 'user', content: buildSummaryPrompt(resume, chapterText, choice?.libelle) }],
      kind: 'summary',
      maxTokens: 600,
    });
    totalCost += summaryRes.costUsd;
    resume = summaryRes.text;

    try {
      const stateGen = await llm.generateJson({
        messages: [{ role: 'system', content: system }, { role: 'user', content: buildStatePrompt({ state: JSON.stringify(state), chapterText }) }],
        kind: 'state',
        maxTokens: 800,
      });
      totalCost += stateGen.result.costUsd;
      state = applyStatePatch(state, stateGen.json);
    } catch {
      /* garde l'état précédent */
    }

    chapters.push({ n, title, text: chapterText, choices: choicesGen.json.choix ?? [], followed: choice?.libelle });
    recentChapters.push({ title, text: chapterText, choice: choice?.libelle });
    if (recentChapters.length > 3) recentChapters.shift();

    console.log(`  ✔ ${title} (${fmt(chapterRes.costUsd)} + choix ${fmt(choicesGen.result.costUsd)} + résumé ${fmt(summaryRes.costUsd)})`);
  }

  // 4. FIN (climax + dénouement)
  console.log('→ Fin…');
  const finalContext = `${resume}\n\nDerniers chapitres :\n${recentChapters
    .map((c) => `--- ${c.title} ---\n${c.text}`)
    .join('\n\n')}`;
  const endingPrompt = `Tu es un grand romancier. Écris la FIN de ce roman : le CLIMAX (l'affrontement/résolution qui répond à la question dramatique), puis un court DÉNOUEMENT (le sort du héros) et un bref ÉPILOGUE (le monde après l'histoire, une note émotionnelle qui reste).

BIBLE DU ROMAN :
${bibleText}

RÉSUMÉ DES ÉVÉNEMENTS PRÉCÉDENTS :
${finalContext}

DERNIER CHOIX DU HÉROS : ${recentChapters[recentChapters.length - 1]?.choice ?? ''}

ÉTAT DU HÉROS :
${JSON.stringify(state, null, 2)}

PUBLIC : adulte | STYLE : classique | DIFFICULTÉ : moyenne

Règles :
- Le climax répond à la question dramatique : "${bible.questionDramatique ?? ''}"
- La fin doit être satisfaisante et logique, cohérente avec les choix du héros et son état (blessures, objets, compagnons).
- L'échec est possible mais la fin reste digne.
- Écris en texte brut, en français, 2e personne ("tu"). Structure : une section CLIMAX, une section DÉNOUEMENT, une section ÉPILOGUE avec des titres. Termine par une ligne "FIN".`;
  const endingRes = await llm.generate({
    messages: [{ role: 'system', content: system }, { role: 'user', content: endingPrompt }],
    kind: 'ending',
    maxTokens: 3000,
  });
  totalCost += endingRes.costUsd;

  // Sauvegarde JSON brute
  const data = { bible, prologue, chapters, ending: endingRes.text, state, totalCost };
  const jsonPath = path.join(tmpDir, 'book.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`JSON brut : ${jsonPath}`);

  // 5. HTML lisible
  const outDir = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'fable-book') : '/tmp/fable-book';
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, 'livre-4-chapitres.html');

  const hero = bible.heros ?? {};
  const choicesHtml = chapters
    .map(
      (c) => `<div class="choices"><strong>Choix possibles :</strong>${c.choices
        .map(
          (ch, i) =>
            `<div class="choice${i === CHOICE_INDEX ? ' followed' : ''}">${ch.libelle === c.followed ? '👉 ' : ''}${esc(ch.libelle)}${i === CHOICE_INDEX ? ' <span class="tag">chemin suivi</span>' : ''}</div>`
        )
        .join('')}</div>`
    )
    .join('');

  const stateHtml = `
  <div class="state">
    <h3>État du héros à la fin du voyage</h3>
    <p><strong>Blessures :</strong> ${state.blessures.length ? state.blessures.map((b) => esc(b.quoi) + (b.soigne ? ' (soignée)' : '')).join(', ') : 'aucune'}</p>
    <p><strong>Inventaire :</strong> ${state.inventaire.length ? state.inventaire.map((i) => esc(i.objet)).join(', ') : 'vide'}</p>
    <p><strong>Compagnons :</strong> ${state.pnj.length ? state.pnj.map((p) => `${esc(p.nom)} (${esc(p.relation)})`).join(', ') : 'aucun'}</p>
    <p><strong>Engagements :</strong> ${state.engagements.length ? state.engagements.map((e) => `envers ${esc(e.envers)} : ${esc(e.quoi)}`).join(' ; ') : 'aucun'}</p>
    <p><strong>Lieu :</strong> ${esc(state.lieu || '—')}</p>
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(bible.titre ?? 'Fable — livre test')}</title>
<style>
  :root{--bg:#101024;--surface:#1c1c3a;--alt:#181830;--border:#2c2c5a;--gold:#E8B84B;--text:#e8e8f0;--muted:#9a9ab0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:Georgia,'Times New Roman',serif;line-height:1.75;padding:40px 20px 80px}
  .wrap{max-width:720px;margin:0 auto}
  .cover{background:linear-gradient(160deg,var(--surface),var(--alt));border:1px solid var(--border);border-radius:14px;padding:48px 36px;text-align:center;margin-bottom:40px}
  .cover .kicker{font-family:Verdana,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--gold)}
  .cover h1{font-size:34px;margin:14px 0 6px;color:#fff}
  .cover .genre{color:var(--muted);font-style:italic;margin-bottom:18px}
  .cover p.desc{color:var(--muted);font-size:14px;max-width:480px;margin:0 auto}
  .cover .meta{margin-top:20px;font-family:Verdana,sans-serif;font-size:12px;color:var(--muted)}
  .cover .meta span{color:var(--gold)}
  h2{color:var(--gold);font-size:24px;margin:44px 0 6px;text-align:center;font-family:Verdana,sans-serif}
  .chapno{text-align:center;font-family:Verdana,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
  .divider{width:80px;height:1px;background:var(--border);margin:10px auto 26px}
  p{margin:0 0 1.1em;color:var(--text)}
  .choices{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin:22px 0;font-family:Verdana,sans-serif;font-size:13px}
  .choices strong{color:var(--gold);display:block;margin-bottom:8px}
  .choice{padding:6px 10px;border-left:3px solid var(--border);margin:5px 0;color:var(--muted)}
  .choice.followed{border-left-color:var(--gold);color:var(--text)}
  .tag{background:var(--gold);color:#101024;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px}
  .state{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 22px;margin-top:40px;font-family:Verdana,sans-serif;font-size:13px;color:var(--muted)}
  .state h3{color:var(--gold);margin-bottom:10px}
  .state p{margin-bottom:6px;color:var(--muted);font-size:13px;line-height:1.5}
  .foot{text-align:center;margin-top:50px;font-family:Verdana,sans-serif;font-size:11px;color:var(--muted)}
  .end-line{text-align:center;color:var(--gold);letter-spacing:6px;margin:40px 0 10px;font-family:Verdana,sans-serif}
</style>
</head>
<body>
<div class="wrap">
  <div class="cover">
    <div class="kicker">Fable · livre généré par IA</div>
    <h1>${esc(bible.titre ?? 'Sans titre')}</h1>
    <div class="genre">${esc(bible.genre ?? PARAMS.genre)} · ${esc(bible.sousGenre ?? '')}</div>
    <p class="desc">${esc(prologue.descriptionCouverture ?? '')}</p>
    <div class="meta">Test de lecture · ${N_CHAPTERS} chapitres + prologue + fin · <span>${fmt(totalCost)}</span> de génération</div>
  </div>

  <div class="chapno">Prologue</div>
  <h2>${esc(prologue.titre ?? 'Prologue')}</h2>
  <div class="divider"></div>
  ${para(prologue.texte ?? '')}

  ${chapters
    .map(
      (c) => `<div class="chapno">Chapitre ${c.n} / ${N_CHAPTERS}</div>
  <h2>${esc(c.title)}</h2>
  <div class="divider"></div>
  ${para(c.text)}
  ${choicesHtml}`
    )
    .join('\n')}

  <div class="chapno">Fin</div>
  <h2>Dénouement</h2>
  <div class="divider"></div>
  ${para(endingRes.text)}

  <div class="end-line">✦ FIN ✦</div>
  ${stateHtml}

  <div class="foot">Fable — test de lecture généré avec le pipeline réel de l'API (GPT-5.6 Luna) le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`\nCoût total : ${fmt(totalCost)}`);
  console.log(`HTML : ${htmlPath}`);
}

main().catch((e) => {
  console.error('ERREUR:', e);
  process.exit(1);
});