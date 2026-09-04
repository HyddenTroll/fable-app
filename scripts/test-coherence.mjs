/**
 * Test CLI de cohérence narrative (20 chapitres) contre l'API Fable.
 * But : mesurer le coût réel par chapitre (5/15/30/50) ET vérifier que
 * le résumé glissant ne perd pas d'informations clés (blessure, objet, mort).
 *
 * Usage : node --env-file=.env scripts/test-coherence.mjs
 * Prérequis : .env à la racine (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
 * API déployée (FABLE_API_BASE, défaut = https://fable-app-three.vercel.app).
 *
 * Le script crée un utilisateur de test premium, joue N chapitres,
 * puis supprime l'utilisateur. Coût réel : quelques centimes.
 */

import { createClient } from '@supabase/supabase-js';

const API_BASE = process.env.FABLE_API_BASE ?? 'https://fable-app-three.vercel.app';
const N_CHAPTERS = Number(process.env.N_CHAPTERS ?? 20);
const TEST_EMAIL = `coh-${Date.now()}@yopmail.com`;
const TEST_PASSWORD = 'CohTest123!';

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes (lire depuis .env)');
  process.exit(1);
}
const anonKey = process.env.SUPABASE_ANON_KEY;

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

// Objets à tracer pour la cohérence
const TRACK_ITEMS = [
  { kind: 'blessure', text: 'blessur', occurrences: 0 },
  { kind: 'objet', text: 'épée', occurrences: 0 },
  { kind: 'personnage', text: 'mère', occurrences: 0 },
];

function track(chapterText, resume) {
  for (const item of TRACK_ITEMS) {
    const source = `${chapterText} ${resume ?? ''}`;
    item.occurrences += (source.match(new RegExp(item.text, 'gi')) ?? []).length;
  }
}

async function main() {
  console.log(`=== Test cohérence Fable : ${N_CHAPTERS} chapitres ===`);
  console.log(`API: ${API_BASE}`);

  // 1) Créer l'utilisateur de test (confirmé + premium)
  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (userErr) throw new Error(`createUser: ${userErr.message}`);
  console.log(`Utilisateur test: ${user.user.id}`);

  await admin.from('profiles').update({ is_premium: true }).eq('id', user.user.id);

  // 2) Connexion -> token
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);
  const token = signIn.session.access_token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 3) Créer la partie
  const createRes = await fetch(`${API_BASE}/api/game/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      genre: 'fantasy',
      subGenre: 'high',
      difficulty: 'moyenne',
      chapterLength: 'court',
      style: 'classique',
      maxChoices: 3,
      age: 'adult',
      heroName: 'Kaelen',
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`create: ${JSON.stringify(created)}`);
  const gameId = created.gameId;
  console.log(`Partie créée: ${created.game.title} (${gameId})`);

  track(created.chapter.content ?? '', created.game.resume ?? '');
  console.log('Prologue OK\n');

  // 4) Jouer N chapitres
  let totalCost = 0;
  let lastResume = created.game.resume ?? '';

  for (let n = 1; n <= N_CHAPTERS; n++) {
    const res = await fetch(`${API_BASE}/api/game/chapter`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ gameId, playerChoiceIndex: 0 }),
    });

    if (res.status === 402) {
      const body = await res.json();
      console.log(`\nPAYWALL au chapitre ${n}: ${body.error?.message}`);
      break;
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`\nErreur chapitre ${n}: ${body.slice(0, 300)}`);
      break;
    }

    // Parser le flux SSE
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = null;
    while (true) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const m = buffer.match(/event: done\ndata: (.+)\n\n/);
      if (m) {
        done = JSON.parse(m[1]);
        break;
      }
    }

    if (!done) {
      console.error(`\nChapitre ${n}: aucun événement done`);
      break;
    }

    totalCost += done.costUsd ?? 0;
    lastResume = done.resume ?? lastResume;
    track(done.chapter?.content ?? '', lastResume);

    // Points de mesure
    if ([5, 15, 30, 50].includes(n)) {
      const ch5 = n;
      console.log(`\n=== MESURE chapitre ${ch5} ===`);
      console.log(`Coût cumulé: $${totalCost.toFixed(5)}`);
      console.log(`Coût moyen/chapitre: $${(totalCost / (n)).toFixed(6)}`);
    }

    if (n <= 3 || n % 5 === 0) {
      console.log(`ch.${n} "${done.chapter?.title ?? ''}" +$${(done.costUsd ?? 0).toFixed(5)} cumulé $${totalCost.toFixed(5)}`);
    }
  }

  // 5) Rapport final
  console.log(`\n=== RAPPORT FINAL ===`);
  console.log(`Chapitres joués: ${N_CHAPTERS}, coût total: $${totalCost.toFixed(5)}`);
  console.log(`Coût moyen/chapitre: $${(totalCost / N_CHAPTERS).toFixed(6)}`);
  console.log(`Coût pour 200 chapitres (extrapolé): $${(totalCost / N_CHAPTERS * 200).toFixed(2)}`);
  console.log(`Résumé final (120): ${(lastResume ?? '').slice(0, 120)}`);
  console.log('\nTraçage cohérence (occurrences cumulées) :');
  for (const item of TRACK_ITEMS) {
    console.log(`  - ${item.kind} ("${item.text}"): ${item.occurrences}`);
  }

  // 6) Nettoyage
  await admin.auth.admin.deleteUser(user.user.id);
  console.log('\nUtilisateur test supprimé.');
}

main().catch((e) => {
  console.error('ERREUR:', e.message);
  process.exit(1);
});