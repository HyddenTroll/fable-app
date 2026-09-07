# Variété & diversité — anti-attracteur (étude du 07/09/2026)

*Source : étude fournie par l'utilisateur (analyse de 12 titres réels + banque de thèmes). La banque intégrale (11 genres, 820 thèmes, 28 tons, 12 registres, 10 rythmes, 5 POV, 20 enjeux, 37 lieux, 17 époques, 10 gabarits de titre, 15 twists) est collée dans la session du 07/09 (récupérable via session_search) et sera injectée en code au moment du chantier.*

## Diagnostic (chiffré sur les vrais titres)
- **Un seul moule syntaxique** : [Article défini] + [Nom] + [de/sous + complément]. « La Boussole des noyés », « La Lanterne des seuils », « Les Voix sous la marée », « Le Pavillon fendu », « Le Couloir sous les eaux », « La Bouche de Sel »… Aucun titre d'un mot, aucun nom propre, aucune phrase, aucun registre trivial.
- **Lexique fermé** : sur 12 titres — « sous » ×5, eau/marée/eau ×5, silences ×2, flamme/feux/lumière ×3.
- **DOUBLON EXACT** : « Les Voix sous la marée » généré deux fois par deux générations distinctes → espace de sortie effondré sur un point.
- **Le genre ne change rien** : fantasy et horreur produisent des titres interchangeables → la variable genre n'est pas réellement injectée (ou est écrasée par le style par défaut).

## Pourquoi
L'IA a un attracteur esthétique : rien dans le pipeline ne la tire ailleurs. La température ne crée PAS de variété de fond (même histoire, autres mots). **La variété se joue en amont, dans les contraintes injectées** — le tirage d'axes, pas le sampling.

## Les 6 leviers (du plus efficace au plus fin)
1. **Purge des adjectifs de ton codés en dur** : aucun mot de style (« atmosphérique », « poétique », « mélancolique »…) dans le prompt système hors variables. Le ton vient d'un paramètre.
2. **Tirage d'axes AVANT la bible (levier principal)** : jamais « écris une histoire » nu. Le serveur tire 1 valeur dans chaque liste : genre + thème(du genre) + ton + lieu + époque + enjeu + POV + gabarit_titre (+ 1 twist 1 fois/3). 10×8×10×… = des milliers de combinaisons.
3. **Liste noire des clichés récurrents** dans la génération de bible : eau/noyade/marée/lac comme motif central, mémoire perdue/amnésie, objets sous verre, brume, seuils/portes symboliques, villages qui disparaissent, vocabulaire « liminal » — « sauf si le genre l'impose ».
4. **Gabarit de titre tiré au sort** (10 formes) + INTERDICTION « Le/La/Les + nom + de/sous + complément » + mots interdits (eau, mer, marée, noyé, vague, silence, flamme, feu, lumière, ombre, seuil, porte, voix, sang, murmure, écho, brume).
5. **Mémoire anti-répétition inter-livres** : injecter les 10-20 derniers titres + pitchs de l'utilisateur (« produis quelque chose de nettement différent »). Sans elle, chaque génération est aveugle aux précédentes.
6. **Anti-doublon serveur** : si le titre généré existe déjà chez cet utilisateur (ou trop proche en mots-clés) → régénérer.

## Diagnostics complémentaires (A/B)
- **A — deux titres identiques** = pas de mémoire de diversité ET sampling trop resserré sur le titre. Le point 5 est non négociable : il aurait empêché « Les Voix sous la marée » ×2. Vérification serveur obligatoire (régénérer si titre existant ou trop proche).
- **B — le générateur de titre ignore le genre** : séparer et durcir l'étape titre. Tirer un gabarit au hasard et imposer : « Génère le titre selon CE gabarit imposé : {gabarit}. INTERDIT : structure Le/La/Les + nom + de/sous + complément. Le titre doit refléter le GENRE ({genre}). »

## Recette minimale (implémentation par étapes)
1. Purge des adjectifs de ton codés en dur.
2. Tirage serveur : genre + thème + ton + lieu (+ époque + enjeu).
3. Liste noire injectée dans le prompt bible.
4. Mémoire des 15 derniers titres de l'utilisateur + interdiction d'y ressembler.
5. Vérification serveur : titre identique/proche → régénération (max 2 tentatives, puis fallback).

## État Fable au moment de la consignation
- Les voix narratives existent déjà en tant que variables (NARRATIVE_VOICES : réaliste, intimiste, lyrique-poétique, noir atmosphérique…) — le problème n'est PAS un adjectif codé en dur dans PROSE_RULES (vérifié), mais l'absence de TIRAGE : le style vient du choix client (souvent le même) et la bible n'a aucune contrainte de variété ni mémoire.
- La création actuelle envoie genre/subGenre/style/difficulté/longueur/maxChoices AU CLIENT → le tirage d'axes doit se faire CÔTÉ SERVEUR au moment du create (le thème/ton/lieu/époque/gabarit ne sont pas demandés au client ; le style client reste un « par défaut », le serveur peut tirer si non précisé ou ajouter les axes).

## Plan d'implémentation proposé (ordre)
① purge + tirage d'axes (thème/ton/lieu/époque/enjeu/gabarit titre) injectés dans buildQuickBiblePrompt → ② liste noire des motifs → ③ gabarit de titre imposé + interdits → ④ mémoire 15 titres + anti-doublon serveur (régénération bornée). Tests : 2 générations fantaisy + 2 horreur → titres de gabarits différents, aucun doublon, lexique hors liste noire.