# DIRECTION ARTISTIQUE FABLE — « Pierre & Lapis »
Date : 06/09/2026 — Source : charte fournie par l'utilisateur (docs de maquette).
Statut : RÉFÉRENCE OFFICIELLE pour toute la suite (web + mobile).

> ⚠️ IMPORTANT — CONFLIT AVEC LE THÈME ACTUEL : l'app mobile utilise
> aujourd'hui un thème SOMBRE (#101024 fond, accent doré #E8B84B).
> Cette DA impose un thème CLAIR (fond pierre, encre obsidienne,
> accent lapis) + formes carrées. La refonte du thème mobile ET du
> site web devra appliquer cette charte (voir section "À faire").

---

## 1. TOKENS

```css
:root {
  --pierre:    #E4E2DC;  /* fond principal */
  --pierre-2:  #D8D4CB;  /* fond secondaire / hover */
  --obsidienne:#101114;  /* encre, texte */
  --bronze:    #8A6A3D;  /* (présent dans la charte, usage à définir) */
  --lapis:     #2447D6;  /* accent = l'IA */
  --lapis-halo:#6B8CFF;  /* halo du fil de lapis */
  --gris:      #55565C;  /* texte secondaire */
  --gris-2:    #3A3B40;  /* liens */
}
```

## 2. TYPOGRAPHIE
- **--f-grec** : Didot (GFS_Didot) — TITRES h1/h2/h3, logo, tagline. Poids 400, gracieux.
- **--f-ia** : Manrope — TEXTES UI/boutons/champs. Poids 400/500/600.
- Corps 16px, interligne 1.55.

## 3. PRINCIPES
- **Formes carrées partout** : `border-radius: 0` (boutons, champs à soulignement).
- **Le lapis = l'IA** : tout ce qui touche à l'IA est bleu lapis #2447D6 (d'où la nuance : l'écriture des histoires est faite par l'IA → le lapis est son fil).
- **Le fil de lapis** : un pixel de 1px, halo lumineux (`box-shadow: 0 0 12px 1px var(--lapis-halo)`) — c'est l'IA. Séparateur vertical + traversée du logo.
- **Le méandre qui se pixelise** : motif grec (méandre) qui "se dissout" d'un côté en pixels lapis — métaphore : la tradition grecque antique devient l'ère numérique/IA. Un seul par écran (séparateur sous le logo).
- **Accessibilité** : `::selection` lapis/blanc, `:focus-visible` outline lapis, `prefers-reduced-motion` coupe les animations.

## 4. COMPOSANTS
- **Bouton `.btn`** : hauteur 52px, bordure 1px obsidienne, fond obsidienne, texte pierre ; variantes `.btn--second` (transparent, encre) et `.btn--ia` (bordure/fond lapis → le bouton "IA").
- **Champ `.champ`** : label en petit au-dessus (12px gris), input sans bordure sauf soulignement bas 1px obsidienne ; focus = soulignement 1.5px lapis ; erreur = soulignement #B4442E.
- **Logo** : Didot, le "b" de Fable en lapis, traversé verticalement par le fil de lapis.
- **Méandre** : bandeau 16px, SVG inline (data-uri), masque dégradé gauche (grec) → droite (pixels lapis). Un seul par écran.

## 5. PAGE CONNEXION (référence d'écran)
- Colonne centrée max-width 420px, padding 72px haut / 28px côtés / 32px bas.
- Logo centré → tagline Didot 19px "Chaque choix écrit la suite." → méandre → formulaire.
- Formulaire : champ e-mail, champ mot de passe, bouton "Entrer" (primary), bouton "Continuer avec Google" (second), liens "Créer un compte" / "Mot de passe oublié".
- Pied : note IA avec fil de lapis vertical : "Les histoires et les images sont écrites avec une intelligence artificielle. Tu décides, elle raconte."

---

## À FAIRE (prochaine refonte UI)
1. Remplacer `apps/mobile/src/theme/index.ts` (actuellement dark #101024 / doré) par les tokens ci-dessus (fond pierre clair, encre obsidienne, accent lapis, formes carrées radius 0).
2. Appliquer la typo : Didot (titres) + Manrope (texte) sur mobile (bundles de polices, vérifier licences GFS_Didot = libre OFL, Manrope = OFL).
3. Reprendre les composants : Button (variantes primary/second/ia), champ souligné, fil de lapis, méandre (SVG), logo "Fable" avec b lapis.
4. Le lapis = IA : accentuer ce qui est généré (couvertures, texte IA) en lapis.

## Fichiers sources fournis (collés verbatim dans le chat)
- app/globals.css (tokens + composants ci-dessus)
- app/layout.tsx (Next.js : fonts GFS_Didot + Manrope)
- components/ui/index.tsx (Meandre, Fil, Logo, Button, Field)
- app/connexion/page.tsx (écran connexion UI seule)