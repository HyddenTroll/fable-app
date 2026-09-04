/**
 * book-via-api.mjs — Génère un livre de 4 chapitres via l'API DÉPLOYÉE
 * (https://fable-app-three.vercel.app) : compte Supabase jetable, puis
 * create (bible+prologue) + 4 chapitres SSE, et écrit un HTML lisible.
 *
 * Usage : node --env-file=.env scripts/book-via-api.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const API = process.env.FABLE_API_URL ?? 'https://fable-app-three.vercel.app';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const N_CHAPTERS = 4;
const EMAIL = `fabletest.${Date.now()}@gmail.com`;
const PASSWORD = `FableTest!${Date.now()}`;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / ANON manquantes (--env-file=.env)');
  process.exit(1);
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

/** Parse un flux SSE : retourne { events: {event: data[]}, done: bool } */
async function parseSSE(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = {};
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let ev = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      (events[ev] ??= []).push(JSON.parse(data));
    }
  }
  return events;
}

async function main() {
  // 1. Compte Supabase jetable
  console.log(`→ Création du compte test ${EMAIL}…`);
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const signup = await signupRes.json();
  const token = signup?.access_token;
  if (!token) {
    console.error('Signup échoué :', JSON.stringify(signup).slice(0, 400));
    process.exit(1);
  }
  console.log('  ✔ compte créé');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 2. create (bible + prologue)
  console.log('→ Création de la partie (bible + prologue)…');
  const createRes = await fetch(`${API}/api/game/create`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      genre: 'fantasy',
      subGenre: 'high',
      difficulty: 'moyenne',
      chapterLength: 'court',
      style: 'classique',
      maxChoices: 3,
      age: 'adult',
    }),
  });
  const create = await createRes.json();
  if (!createRes.ok) {
    console.error('create échoué :', JSON.stringify(create).slice(0, 500));
    process.exit(1);
  }
  const gameId = create.gameId;
  const prologue = create.chapter;
  const coverPrompt = create.coverPrompt;
  console.log(`  ✔ ${create.game.title} (gameId ${gameId}) — gratuits restants ${create.freeChaptersRemaining}`);

  // 3. Chapitres 1..N via SSE
  const chapters = [];
  let lastChoiceLabel;
  for (let n = 1; n <= N_CHAPTERS; n++) {
    console.log(`→ Chapitre ${n}/${N_CHAPTERS}… (SSE)`);
    const body = { gameId, playerChoiceIndex: 0, playerChoiceLabel: lastChoiceLabel ?? null };
    const chapRes = await fetch(`${API}/api/game/chapter`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    if (chapRes.status === 402) {
      console.error('  ✘ PAYWALL atteint (quota gratuit épuisé)');
      const err = await chapRes.json();
      console.error('  ', JSON.stringify(err).slice(0, 300));
      break;
    }
    if (!chapRes.ok) {
      console.error(`  ✘ chapitre ${n} échec HTTP ${chapRes.status} :`, (await chapRes.text()).slice(0, 300));
      process.exit(1);
    }
    const events = await parseSSE(chapRes);
    if (events.error) {
      console.error('  ✘ erreur SSE :', events.error[0]?.message);
      process.exit(1);
    }
    const done = events.done?.[0];
    if (!done) {
      console.error('  ✘ aucun event done');
      process.exit(1);
    }
    chapters.push(done.chapter);
    lastChoiceLabel = done.chapter.choices?.[0]?.libelle ?? null;
    console.log(`  ✔ ${done.chapter.title} — ${String(done.chapter.content).length} chars, gratuits restants ${done.freeChaptersRemaining}, coût ${(done.costUsd ?? 0).toFixed(5)} $`);
  }

  // 4. HTML lisible
  const outDir = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp', 'fable-book') : '/tmp/fable-book';
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, 'livre-4-chapitres.html');
  const jsonPath = path.join(outDir, 'livre-4-chapitres.json');

  const bible = create.game;
  const choicesHtml = chapters
    .map((c, ci) => {
      const list = (c.choices ?? []);
      if (!list.length) return '';
      return `<div class="choices"><strong>Choix possibles (fin du chapitre ${ci + 1}) :</strong>${list
        .map((ch, i) => `<div class="choice${i === 0 ? ' followed' : ''}">${i === 0 ? '👉 ' : ''}${esc(ch.libelle)}${i === 0 ? ' <span class="tag">chemin suivi</span>' : ''}</div>`)
        .join('')}</div>`;
    })
    .join('');

  const stateOf = chapters[chapters.length - 1]?.state;
  const stateHtml = stateOf
    ? `<div class="state">
    <h3>État du héros à la fin du chapitre ${chapters.length}</h3>
    <p><strong>Blessures :</strong> ${stateOf.blessures?.length ? stateOf.blessures.map((b) => esc(b.quoi)).join(', ') : 'aucune'}</p>
    <p><strong>Inventaire :</strong> ${stateOf.inventaire?.length ? stateOf.inventaire.map((i) => esc(i.objet)).join(', ') : 'vide'}</p>
    <p><strong>Compagnons :</strong> ${stateOf.pnj?.length ? stateOf.pnj.map((p) => `${esc(p.nom)} (${esc(p.relation ?? '')})`).join(', ') : 'aucun'}</p>
    <p><strong>Lieu :</strong> ${esc(stateOf.lieu || '—')}</p>
  </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(create.game.title ?? 'Fable — livre test')}</title>
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
  .state h3{color:var(--gold);margin-bottom:10px;font-size:14px}
  .state p{margin-bottom:6px;color:var(--muted);font-size:13px;line-height:1.5}
  .foot{text-align:center;margin-top:50px;font-family:Verdana,sans-serif;font-size:11px;color:var(--muted)}
  .end-line{text-align:center;color:var(--gold);letter-spacing:6px;margin:40px 0 10px;font-family:Verdana,sans-serif}
</style>
</head>
<body>
<div class="wrap">
  <div class="cover">
    <div class="kicker">Fable · livre généré par IA</div>
    <h1>${esc(create.game.title ?? 'Sans titre')}</h1>
    <div class="genre">${esc(create.game.genre ?? 'fantasy')} · hero : ${esc(create.game.heroName ?? '')}</div>
    <p class="desc">${esc(coverPrompt ?? '')}</p>
    <div class="meta">Test de lecture · prologue + ${chapters.length} chapitres · généré via l'API réelle (GPT-5.6 Luna)</div>
  </div>

  <div class="chapno">Prologue</div>
  <h2>${esc(prologue.title ?? 'Prologue')}</h2>
  <div class="divider"></div>
  ${para(prologue.content ?? '')}

  ${chapters
    .map(
      (c, ci) => `<div class="chapno">Chapitre ${ci + 1} / ${N_CHAPTERS}</div>
  <h2>${esc(c.title)}</h2>
  <div class="divider"></div>
  ${para(c.content)}
  ${ci === chapters.length - 1 ? '' : `<div class="choices"><strong>Choix suivi :</strong><div class="choice followed">👉 ${esc(c.choices?.[0]?.libelle ?? '—')}</div></div>`}`
    )
    .join('\n')}

  <div class="end-line">✦ FIN DU TEST (${chapters.length} chapitres) ✦</div>
  ${stateHtml}

  <div class="foot">Fable — livre de test généré via le pipeline réel (API Vercel + GPT-5.6 Luna + état structuré) le ${new Date().toLocaleString('fr-FR')}</div>
</div>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ game: create, prologue, chapters }, null, 2), 'utf8');
  console.log(`\nHTML : ${htmlPath}`);
  console.log(`JSON : ${jsonPath}`);
}

main().catch((e) => {
  console.error('ERREUR:', e);
  process.exit(1);
});