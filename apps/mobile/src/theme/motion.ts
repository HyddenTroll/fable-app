/**
 * MOTION — le système de mouvement Fable (DA).
 * Trois durées, deux courbes. TOUT ce qui bouge dans l'app utilise l'une de
 * ces combinaisons : c'est ce qui fait qu'on ne remarque pas les animations
 * individuellement, seulement une cohérence. En plus du réduit-mouvement
 * (useReducedMotion) respecté par chaque composant.
 */
import { Easing } from 'react-native-reanimated';

export const DUREE = { court: 140, moyen: 260, long: 620 };

export const COURBE = {
  doux: Easing.bezier(0.4, 0, 0.2, 1), // changements d'état
  sortie: Easing.bezier(0.22, 0.61, 0.36, 1), // arrivées, remplissages
  gravure: Easing.linear, // le méandre : vitesse constante
};