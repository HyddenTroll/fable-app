# Fable

Application mobile (iOS + Android) de livres dont vous êtes le héros, générés par IA.

## Liens utiles

- **Site déployé** : https://fable-app-three.vercel.app (auto-déployé à chaque push)
- **Dépôt GitHub** : https://github.com/HyddenTroll/fable-app
- **Local** : http://localhost:8081 (après `npm start` dans `apps/mobile`)

## Structure

```
fable/
├── apps/mobile/        # App Expo (React Native, TypeScript, Expo Router)
├── api/                # API serverless (Vercel) - génération IA, comptes, crédits
├── packages/shared/    # Types et utilitaires partagés
├── prompts/            # Fichiers de prompts IA
└── docs/               # Toute la documentation projet (stratégie, produit, technique)
```

## Travailler depuis un autre PC (GitHub = source de vérité)

Le projet est synchronisé via GitHub. Tout PC peut continuer le travail.

### Sur un nouveau PC (une seule fois)
1. Installer Node.js (LTS ≥ 20.19.4) et Git.
2. Cloner :
```bash
git clone https://github.com/HyddenTroll/fable-app.git
cd fable-app
npm install
```

### Avant de commencer à travailler (à chaque session)
```bash
git pull      # récupère les changements faits sur l'autre PC
```

### Après avoir travaillé
```bash
git add -A
git commit -m "description du changement"
git push      # envoie sur GitHub -> Vercel se met à jour automatiquement
```

### Règles importantes
- **Pousse toujours** avant de passer à un autre PC (évite les conflits).
- Ne pas modifier le **même fichier en même temps** sur deux PC.
- Les **clés API** (`.env`) ne sont PAS sur GitHub : créer/recopier `.env` sur chaque PC.
- Le journal de travail (`docs/JOURNAL-DE-TRAVAIL.txt`) note toutes les sessions.

## Démarrage rapide

### Prérequis
- Node.js 20+
- npm 10+
- Compte Expo (pour tester sur téléphone via Expo Go)
- Compte Supabase (base de données)
- Clés API IA (Anthropic, OpenAI, fal.ai)

### Installation

```bash
npm install
cp .env.example .env   # puis remplir les clés
```

### Lancer l'app mobile

```bash
npm run dev:mobile
```

Puis scanner le QR code avec l'app Expo Go (téléphone) ou appuyer sur `w` pour le web.

### API (local / Vercel)

La documentation complète du projet est dans `docs/` :
- `docs/CONTEXTE.txt` - vision globale
- `docs/6-avant-le-code/architecture-technique.txt` - architecture
- `docs/6-avant-le-code/design-ux.txt` - spécification des écrans
- `docs/6-avant-le-code/prompts-ia.txt` - les prompts IA