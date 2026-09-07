# Conformité & faisabilité — App Stores + IA (synthèse du rapport du 07/09/2026)

*Sources primaires : Apple Developer, Google Play Console, OpenAI, Anthropic, EUR-Lex, CNIL, Arcom, FTC. Rapport complet collé dans la session (journal item 37).*

## Verdict
**La V1 13+ est lançable en France/UE**, avec 4 points **bloquants** avant review + un prix d'entrée réglementaire. Une v2 sous-13 ans est un **projet réglementaire distinct** (COPPA, double consentement <15, Kids Category, ZDR obligatoire).

## Les 4 points bloquants (avant soumission)
1. **Aucune clé API dans le binaire** → proxy serveur obligatoire. ✅ **DÉJÀ FAIT chez Fable** (tout passe par les routes Vercel ; les clés sont des secrets d'env serveur ; le mobile ne détient que la clé anon Supabase, publique par nature).
2. **Abonnement + crédits via IAP obligatoire** (Apple 3.1.1 / Google billing) → RevenueCat. ❌ **À FAIRE** (chantier quota ④ — cf. journal 35).
3. **Label « contenu généré par IA » + divulgation « vous interagissez avec une IA »** (AI Act art. 50, en vigueur 02/08/2026 ; Anthropic Guidelines Minors ; Play AI policy). ❌ **À FAIRE** (UI : mention permanente + écran de lancement).
4. **Signalement in-app du contenu IA** (Play AI-Generated Content). ✅ **DÉJÀ FAIT** (bouton « ⚠ Signaler » → `reportGame`, route `/api/game/report`).

## État Fable par axe

### Fournisseurs IA
- **Propriété des outputs : OK** (OpenAI + Anthropic cèdent les droits ; pas d'entraînement sur vos données). Réserve : pas de protection copyright garantie sur du 100 % IA (exigence d'auteur humain) — ne pas vendre les images comme œuvres exclusives.
- **Anthropic (pour Haiku 4.5) est plus strict** : Claude = 18+ grand public (vérif. Yoti), mais l'usage API pour mineurs est permis sous les **Guidelines for Organizations Serving Minors** : child-safety system prompt fourni par Anthropic, modération, signalement, **déclaration publique de conformité**, audits. ❌ À prévoir avec le chantier Haiku.
- **OpenAI (Luna actuel)** : contenu adapté à l'âge + accord parental < 18 dans les CGU ; ZDR obligatoire seulement < 13/< âge consentement (v2).
- **Images** : Imagen 4 (Vertex UE + DPA + indemnisé) ou GPT Image (C2PA + SynthID). **FLUX.1 [dev] = licence NON-commerciale → interdit en prod** (API FLUX pro = payante). Il n'y a pas encore d'images dans Fable (chantier futur : prendre Imagen/GPT Image, jamais FLUX [dev]).

### App Store (Apple, 2026)
- Nouvelle grille d'âge 4+/9+/13+/16+/18+ (questionnaire obligatoire) → Fable : **13+ ou 16+** selon fréquence de contenu sensible. À compléter.
- **5.1.2(i)** : consentement explicite avant envoi des données à une IA tierce → **écran dédié à créer**.
- **1.2 / 1.2.1(a)** : UGC → filtrage, signalement, blocage, contact (actions libres des joueurs = contenu utilisateur).
- **3.1.1** : IAP obligatoire ; pas de renvoi paiement web (hors régime UE).
- **UE au 01/10/2026** : commission IAP 30 % → **26 %** (15 % SBP) ; CTC 5 % seulement si distribution alternative (hors App Store) — pas notre cas.

### Google Play
- Compte **organisation D-U-N-S** recommandé (sinon test fermé 12 testeurs/14 jours pour comptes personnels post-13/11/2023). ❌ Démarche administrative.
- Déclaration du contenu IA dans la Play Console ; politique AI-Generated Content (signalement in-app ✅ déjà) ; UGC.
- Billing 15 % dès le 1er € (abonnements).

### Mineurs & données (UE/FR)
- **Age-gate 13+** à l'inscription + CGU accord parental 13-17. ❌ À FAIRE (l'app a déjà une tranche d'âge déclarée côté joueur → la rendre bloquante < 13).
- **AI Act art. 50** (02/08/2026, délai de grâce marquage → déc. 2026) : label IA en production. ❌ À FAIRE (point bloquant 3).
- **CNIL/RGPD** : art. 45 LIL = 15 ans en France (double consentement < 15) ; pas de collecte de < 13 ans ; DPA signés + mention sous-traitants IA dans la politique de confidentialité + DPIA. ❌ À FAIRE (papiers + écran consentement).
- **SREN** : vérif. d'âge = uniquement pour contenus porno → Fable 13+ hors champ. Un éventuel mode « fiction adulte » explicite = SREN + refus modèle → **le retirer de la V1**.
- App UE de vérification d'âge (mini-wallet) : pilote France 2026, à intégrer dès dispo (v2).

### Sécurité / architecture (déjà conforme chez Fable)
- Clés serveur uniquement ✅ ; rate liming côté serveur ✅ (quota) ; prompt injection : actions libres encapsulées en DONNÉES dans le prompt (pas concaténées aux instructions) ✅ ; modération entrée/sortie : verdict LLM bon marché pour mineurs ✅ (à compléter par le child-safety system prompt Anthropic) ; streaming SSE via proxy ✅ (à revérifier sur Hermes RN : `expo/fetch` ou `react-native-sse` si `response.body.getReader()` flaké — le flux marche déjà en prod, à confirmer sur le build natif).
- Prompt caching : OpenAI auto ≥ 1024 tokens (~0,1× maintenant sur GPT-5.x, écritures facturées 1,25×) ; Anthropic `cache_control` explicite (lectures 0,1×, écritures 1,25×) → à implémenter avec le chantier Haiku. ✅/⏳

## Checklist pré-soumission consolidée (V1 13+)
- [x] Proxy serveur, zéro clé dans le binaire
- [x] Signalement in-app (⚠ → reportGame)
- [ ] Divulgation IA + label « généré par IA » (UI + écran lancement)
- [ ] Consentement explicite avant envoi vers l'IA (5.1.2(i) / RGPD)
- [ ] Age-gate 13+ effectif (blocage des < 13) + CGU accord parental 13-17
- [ ] IAP abonnement + crédits via RevenueCat (Apple + Google)
- [ ] Compte Play organisation D-U-N-S ; déclaration IA Play Console ; questionnaire d'âge Apple
- [ ] DPA OpenAI/Anthropic + Project UE ; politique de confidentialité listant les sous-traitants IA ; DPIA
- [ ] Child-safety system prompt Anthropic + déclaration publique de conformité (Guidelines Minors)
- [ ] Pas de mode « fiction adulte » en V1

## Ordre suggéré
1. UI : âge-gate 13+ + consentement IA + label IA (bloquants, peu cher).
2. RevenueCat (avec le chantier quota ④ — lié).
3. Papiers : DPA, privacy policy, DPIA, compte D-U-N-S, questionnaire d'âge.
4. Child-safety system prompt (avec Haiku).