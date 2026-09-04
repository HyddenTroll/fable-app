/**
 * Build Vercel (Build Output API).
 * Produit `.vercel/output/` combinant :
 *  - le site Expo (export web) dans static/
 *  - les serverless functions de api/api (sous-dossiers inclus) dans functions/
 *
 * Réf : https://vercel.com/docs/build-output-api/primitives
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');
const functionsDir = path.join(outputDir, 'functions');
const mobileDist = path.join(root, 'apps', 'mobile', 'dist');
const apiSrcDir = path.join(root, 'api', 'api');

// 1. Build du site web Expo
console.log('[vercel-build] Expo export...');
execSync('npx expo export --platform web', {
  cwd: path.join(root, 'apps', 'mobile'),
  stdio: 'inherit',
});

// 2. Nettoyage + copie du site dans static/
console.log('[vercel-build] Copie du site dans .vercel/output/static');
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(mobileDist, staticDir, { recursive: true });

// 3. Compilation des functions serverless
function listTs(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listTs(full, rel));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(rel);
  }
  return out;
}

const entries = existsSync(apiSrcDir) ? listTs(apiSrcDir) : [];
if (entries.length === 0) {
  console.log('[vercel-build] Aucune function API trouvée.');
}

for (const rel of entries) {
  // api/api/user/profile.ts -> route /api/user/profile
  const route = rel.replace(/\.ts$/, '');
  const funcDir = path.join(functionsDir, 'api', `${route}.func`);
  const entryPath = path.join(apiSrcDir, rel);

  console.log(`[vercel-build] Bundle ${rel} -> ${path.relative(outputDir, funcDir)}`);
  mkdirSync(funcDir, { recursive: true });

  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    outfile: path.join(funcDir, 'index.js'),
    sourcemap: false,
    logLevel: 'warning',
    external: ['@vercel/node'],
  });

  writeFileSync(
    path.join(funcDir, '.vc-config.json'),
    JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.js',
        launcherType: 'Nodejs',
        shouldAddHelpers: true,
      },
      null,
      2,
    ),
  );
}

// 4. Routes : fichiers + functions d'abord, sinon fallback SPA -> index.html
writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('[vercel-build] Terminé.');