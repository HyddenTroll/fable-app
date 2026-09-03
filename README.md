# Fable

Application mobile (iOS + Android) de livres dont vous êtes le héros, générés par IA.

## Structure

```
fable/
├── apps/mobile/        # App Expo (React Native, TypeScript, Expo Router)
├── api/                # API serverless (Vercel) - génération IA, comptes, crédits
├── packages/shared/    # Types et utilitaires partagés
├── prompts/            # Fichiers de prompts IA
└── docs/               # Toute la documentation projet (stratégie, produit, technique)
```

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