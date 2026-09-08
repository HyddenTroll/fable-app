/**
 * ÉCRAN PROFIL — l'ex-libris en place d'honneur, les statistiques de la
 * collection, le solde d'encres, le bloc Fable+ illustré (cinq arcades)
 * et la porte vers les réglages.
 * Ni lapis (réservé à l'IA) ni denticule : le bronze ne touche que les
 * encres et Fable+, l'obsidienne trace le reste. Radius 0, aucune ombre.
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SoldeEncres } from '@/components/SoldeEncres';
import { ExLibris } from '@/components/ExLibris';
import { PieceEncre } from '@/components/PieceEncre';
import { getMe, listGames } from '@/services/api';
import { useAppStore } from '@/state/store';
import { colors, fonts, spacing } from '@/theme';

/** Gris extra-muet : LECTEUR DEPUIS… et version. */
const MUTED = '#8A8B90';

const MOIS_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const MOIS_COURT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const AVANTAGES_FABLE = [
  'Couvertures illustrées sur tous tes livres',
  '3 encres offertes chaque mois',
  'Chapitres longs et fins alternatives',
];

interface Livre {
  id: string;
  title: string;
  genre: string;
  heroName: string;
  chapterCount: number;
  createdAt: string;
  status: string;
  coverImageUrl?: string | null;
}

/** require local (Metro) : import gardé muet pour ne jamais casser le
 *  bundler quand react-native-purchases n'est pas installé. */
declare const require: (id: string) => unknown;

/** Hash FNV-1a de l'email : identifiant stable de session, personne n'en
 *  voit la graine. La marque de tailleur de l'ex-libris en est dérivée. */
function hashEmail(valeur: string): string {
  let h = 2166136261;
  for (let i = 0; i < valeur.length; i++) {
    h ^= valeur.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Pseudo par défaut : la partie de l'email avant l'arobase. */
function pseudoParDefaut(email: string | null): string {
  if (!email) return 'Fable';
  const local = email.split('@')[0]?.trim();
  return local && local.length > 0 ? local : 'Fable';
}

/** Plus ancien createdAt de la collection (null si aucun valide). */
function plusAncien(jeux: Livre[]): Date | null {
  let plus: Date | null = null;
  for (const jeu of jeux) {
    const d = new Date(jeu.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    if (!plus || d.getTime() < plus.getTime()) plus = d;
  }
  return plus;
}

export default function ProfileScreen() {
  const router = useRouter();
  const email = useAppStore((s) => s.email);
  const credits = useAppStore((s) => s.credits);
  const userName = useAppStore((s) => s.userName);
  const setUserName = useAppStore((s) => s.setUserName);

  const [me, setMe] = useState<{ isPremium: boolean } | null>(null);
  const [jeux, setJeux] = useState<Livre[] | null>(null);
  const [pseudoOuvert, setPseudoOuvert] = useState(false);
  const [pseudoSaisie, setPseudoSaisie] = useState('');
  const [erreurPseudo, setErreurPseudo] = useState<string | null>(null);

  // Statut Fable+ lu côté serveur (jamais le store local) + collection
  // rafraîchies à chaque retour sur l'onglet.
  const charger = useCallback(async () => {
    getMe()
      .then((m) => setMe({ isPremium: m.isPremium }))
      .catch(() => setMe({ isPremium: false }));
    try {
      setJeux(await listGames());
    } catch {
      setJeux([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  // ── Identité ─────────────────────────────────────────────
  const pseudo = userName ?? pseudoParDefaut(email);
  const identifiant = hashEmail(email ?? 'fable');

  // ── Statistiques ─────────────────────────────────────────
  const livres = jeux ?? [];
  const livresFinis = livres.filter((g) => g.status === 'finished').length;
  const chapitres = livres.reduce((n, g) => n + (g.chapterCount || 0), 0);
  const images = livres.filter((g) => Boolean(g.coverImageUrl)).length;
  const ancien = plusAncien(livres);
  const moisAncien = ancien ? MOIS_LONG[ancien.getMonth()].toUpperCase() : 'MARS';
  const anneeAncien = ancien ? String(ancien.getFullYear()) : '2026';
  const genre = pseudo.trim().toLowerCase().endsWith('e') ? 'LECTRICE' : 'LECTEUR';

  // ── Encres ───────────────────────────────────────────────
  const pages = Math.max(1, Math.floor(credits / 5));

  const ouvrirPseudo = () => {
    setPseudoSaisie(userName ?? '');
    setErreurPseudo(null);
    setPseudoOuvert(true);
  };

  const fermerPseudo = () => {
    setPseudoOuvert(false);
    setErreurPseudo(null);
  };

  const validerPseudo = () => {
    const nettoye = pseudoSaisie.trim();
    if (nettoye.length < 2) {
      setErreurPseudo('Le pseudo doit faire au moins 2 caractères.');
      return;
    }
    setUserName(nettoye);
    fermerPseudo();
  };

  /** Restauration des achats : on tente l'import de react-native-purchases ;
   *  sur le web ou quand le module manque → alerte. Ne crashe jamais. */
  const restaurerAchats = async () => {
    try {
      if (Platform.OS === 'web') throw new Error('restauration indisponible sur le web');
      const nom = 'react-native-' + 'purchases';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const brut: unknown = require(nom);
      const candidat = (brut as { default?: unknown } | null | undefined)?.default ?? brut;
      const api = candidat as { restorePurchases?: () => Promise<unknown> } | null | undefined;
      if (!api || typeof api.restorePurchases !== 'function') throw new Error('module indisponible');
      await api.restorePurchases();
      void charger();
    } catch {
      Alert.alert('Restaurer mes achats', 'Disponible sur l’application mobile.');
    }
  };

  const gererAbonnement = () => {
    Alert.alert(
      "Gérer l'abonnement",
      "L'annulation se fait dans l'App Store : Réglages → Abonnements.",
    );
  };

  // Date du jour + 1 mois, « 8 oct. · 4,99 € ».
  const renouvellement = (() => {
    const maintenant = new Date();
    const suivant = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate());
    return `${suivant.getDate()} ${MOIS_COURT[suivant.getMonth()]} · 4,99 €`;
  })();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {/* A — Barre haute : titre à gauche, solde à droite */}
        <View style={styles.barreHaute}>
          <Text style={styles.titre}>Profil</Text>
          <SoldeEncres solde={credits} />
        </View>

        {/* B — Identité : l'ex-libris en place d'honneur */}
        <View style={styles.identite}>
          <ExLibris id={identifiant} pseudo={pseudo} taille={106} />
          <Text style={styles.pseudo} numberOfLines={1} adjustsFontSizeToFit>
            {pseudo}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {email ?? 'Fable'}
          </Text>
          <TouchableOpacity
            style={styles.pseudoBouton}
            onPress={ouvrirPseudo}
            accessibilityRole="button"
            accessibilityLabel={userName ? 'Changer de pseudo' : 'Choisir un pseudo'}
          >
            <Text style={styles.pseudoBoutonTexte}>
              {userName ? 'Changer de pseudo' : 'Choisir un pseudo'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.marque}>
            Ta marque, calculée à ton inscription. Personne d'autre n'a la même.
          </Text>
        </View>

        {/* C — Statistiques : bandeau cerné de deux filets obsidienne */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statChiffre}>{livresFinis}</Text>
            <Text style={styles.statLibelle}>LIVRES FINIS</Text>
          </View>
          <View style={styles.statFilet} />
          <View style={styles.stat}>
            <Text style={styles.statChiffre}>{chapitres}</Text>
            <Text style={styles.statLibelle}>CHAPITRES</Text>
          </View>
          <View style={styles.statFilet} />
          <View style={styles.stat}>
            <Text style={styles.statChiffre}>{images}</Text>
            <Text style={styles.statLibelle}>IMAGES</Text>
          </View>
        </View>
        <Text style={styles.since}>
          {genre} DEPUIS {moisAncien} {anneeAncien}
        </Text>

        {/* D — Mes encres */}
        <Text style={styles.section}>MES ENCRES</Text>
        <View style={styles.encresBloc}>
          <PieceEncre size={44} />
          <Text style={styles.encresNombre}>{credits}</Text>
          <Text style={styles.encresSous}>de quoi illustrer {pages} pages</Text>
          <TouchableOpacity
            style={styles.acheter}
            onPress={() => router.push('/shop')}
            accessibilityRole="button"
            accessibilityLabel="Acheter des encres"
          >
            <Text style={styles.acheterTexte}>Acheter des encres</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.restaurer}
            onPress={() => void restaurerAchats()}
            accessibilityRole="button"
            accessibilityLabel="Restaurer mes achats"
          >
            <Text style={styles.restaurerTexte}>Restaurer mes achats</Text>
          </TouchableOpacity>
        </View>

        {/* E — Fable+ : cadre bronze illustré de cinq arcades */}
        <View style={styles.fableCadre}>
          <View style={styles.arcades}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.arc} />
            ))}
          </View>
          <View style={styles.fableFilet} />
          <View style={styles.fableTete}>
            <Text style={styles.fableTitre}>Fable+</Text>
            <Text style={styles.fableStatut}>{me?.isPremium ? 'ACTIF' : '4,99 € / MOIS'}</Text>
          </View>
          <View style={styles.avantages}>
            {AVANTAGES_FABLE.map((a) => (
              <View key={a} style={styles.avantageRow}>
                <View style={styles.avantageCarre} />
                <Text style={styles.avantageTexte}>{a}</Text>
              </View>
            ))}
          </View>
          {me?.isPremium ? (
            <View style={styles.renouvellement}>
              <View style={styles.renouvellementFilet} />
              <View style={styles.renouvellementLigne}>
                <Text style={styles.renouvellementLabel}>Prochain renouvellement</Text>
                <Text style={styles.renouvellementDate}>{renouvellement}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.decouvrir}
              onPress={() => router.push('/paywall')}
              accessibilityRole="button"
              accessibilityLabel="Découvrir Fable+"
            >
              <Text style={styles.decouvrirTexte}>Découvrir Fable+</Text>
            </TouchableOpacity>
          )}
        </View>

        {me?.isPremium && (
          <TouchableOpacity
            style={styles.gerer}
            onPress={gererAbonnement}
            accessibilityRole="button"
            accessibilityLabel="Gérer l'abonnement"
          >
            <View style={styles.gererTextes}>
              <Text style={styles.gererTitre}>Gérer l'abonnement</Text>
              <Text style={styles.gererSous}>Annulation dans l'App Store</Text>
            </View>
            <Text style={styles.gererChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* F — La porte vers les réglages */}
        <TouchableOpacity
          style={styles.porte}
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
        >
          <View style={styles.porteTextes}>
            <Text style={styles.porteTitre}>Paramètres</Text>
            <Text style={styles.porteSous}>Lecture, données, compte, aide</Text>
          </View>
          <Text style={styles.porteChevron}>›</Text>
        </TouchableOpacity>

        {/* G — Version */}
        <Text style={styles.version}>FABLE 1.0.4</Text>
      </ScrollView>

      {/* Feuille de saisie du pseudo (modal maison, radius 0) */}
      <Modal visible={pseudoOuvert} transparent animationType="fade" onRequestClose={fermerPseudo}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.pseudoOverlay}
        >
          <View style={styles.pseudoCard}>
            <Text style={styles.pseudoTitre}>
              {userName ? 'Changer de pseudo' : 'Choisir un pseudo'}
            </Text>
            <Text style={styles.pseudoMessage}>
              2 à 24 caractères. Ton monogramme grec en est tiré.
            </Text>
            <TextInput
              style={styles.pseudoInput}
              value={pseudoSaisie}
              onChangeText={setPseudoSaisie}
              placeholder="Ton pseudo"
              placeholderTextColor={colors.textMuted}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={validerPseudo}
            />
            {erreurPseudo ? <Text style={styles.pseudoErreur}>{erreurPseudo}</Text> : null}
            <View style={styles.pseudoActions}>
              <TouchableOpacity
                style={styles.pseudoAnnuler}
                onPress={fermerPseudo}
                accessibilityRole="button"
                accessibilityLabel="Annuler"
              >
                <Text style={styles.pseudoBtnTexte}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pseudoAnnuler, styles.pseudoValider]}
                onPress={validerPseudo}
                accessibilityRole="button"
                accessibilityLabel="Valider"
              >
                <Text style={[styles.pseudoBtnTexte, styles.pseudoValiderTexte]}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contenu: { padding: spacing.xxl, paddingBottom: spacing.xxl * 2 },

  barreHaute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titre: { fontFamily: fonts.grec, fontSize: 21, color: colors.text },

  // Identité
  identite: { alignItems: 'center', marginTop: spacing.xl },
  pseudo: {
    fontFamily: fonts.grec,
    fontSize: 22,
    color: colors.text,
    marginTop: spacing.md,
  },
  email: { fontFamily: fonts.ia, fontSize: 10.5, color: colors.gris2, marginTop: spacing.xs },
  pseudoBouton: {
    height: 27,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  pseudoBoutonTexte: { fontFamily: fonts.iaMedium, fontSize: 10.5, color: colors.text },
  marque: {
    fontFamily: fonts.ia,
    fontSize: 10,
    color: colors.gris2,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Statistiques
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.text,
    marginTop: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statFilet: { width: 1, backgroundColor: colors.surfaceAlt, alignSelf: 'stretch' },
  statChiffre: { fontFamily: fonts.grec, fontSize: 21, color: colors.text },
  statLibelle: {
    fontFamily: fonts.ia,
    fontSize: 9.5,
    color: colors.gris2,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  since: {
    fontFamily: fonts.ia,
    fontSize: 9.5,
    color: MUTED,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Mes encres
  section: {
    fontFamily: fonts.iaSemiBold,
    fontSize: 10,
    color: colors.gris2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  encresBloc: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.text,
    paddingVertical: spacing.xl,
  },
  encresNombre: {
    fontFamily: fonts.grec,
    fontSize: 34,
    color: colors.bronze,
    marginTop: spacing.sm,
  },
  encresSous: { fontFamily: fonts.ia, fontSize: 10.5, color: colors.gris2, marginTop: spacing.xs },
  acheter: {
    height: 42,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bronze,
    marginTop: spacing.lg,
  },
  acheterTexte: { fontFamily: fonts.iaSemiBold, fontSize: 13, color: '#FFFFFF' },
  restaurer: {
    height: 42,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: 'transparent',
    marginTop: spacing.sm,
  },
  restaurerTexte: { fontFamily: fonts.iaSemiBold, fontSize: 13, color: colors.text },

  // Fable+
  fableCadre: {
    borderWidth: 1,
    borderColor: colors.bronze,
    marginTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  arcades: {
    flexDirection: 'row',
    gap: 3,
    opacity: 0.75,
    paddingTop: 11,
    paddingHorizontal: 13,
    paddingBottom: 0,
  },
  arc: {
    width: 19,
    height: 19,
    borderWidth: 1,
    borderColor: colors.bronze,
    borderBottomWidth: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  fableFilet: {
    height: 1,
    backgroundColor: colors.bronze,
    opacity: 0.55,
    marginHorizontal: 13,
    marginTop: 11,
  },
  fableTete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 13,
    marginTop: spacing.md,
  },
  fableTitre: { fontFamily: fonts.grec, fontSize: 23, color: colors.bronze },
  fableStatut: {
    fontFamily: fonts.iaSemiBold,
    fontSize: 9.5,
    color: colors.bronze,
    letterSpacing: 0.8,
  },
  avantages: { paddingHorizontal: 13, gap: spacing.sm, marginTop: spacing.lg },
  avantageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  avantageCarre: { width: 4, height: 4, backgroundColor: colors.bronze, marginTop: 6 },
  avantageTexte: {
    flex: 1,
    fontFamily: fonts.ia,
    fontSize: 11.5,
    lineHeight: 16.1,
    color: colors.gris2,
  },
  renouvellement: { marginTop: spacing.lg },
  renouvellementFilet: {
    height: 1,
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: 13,
  },
  renouvellementLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingTop: spacing.md,
  },
  renouvellementLabel: { fontFamily: fonts.ia, fontSize: 10.5, color: colors.gris2 },
  renouvellementDate: { fontFamily: fonts.ia, fontSize: 10.5, color: colors.text },
  decouvrir: {
    height: 40,
    backgroundColor: colors.bronze,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginHorizontal: 13,
  },
  decouvrirTexte: { fontFamily: fonts.iaSemiBold, fontSize: 13, color: '#FFFFFF' },

  gerer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  gererTextes: { gap: 2 },
  gererTitre: { fontFamily: fonts.iaMedium, fontSize: 12.5, color: colors.text },
  gererSous: { fontFamily: fonts.ia, fontSize: 10, color: colors.gris2 },
  gererChevron: { color: colors.text, fontSize: 22 },

  // La porte vers les réglages
  porte: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    marginTop: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  porteTextes: { gap: 2 },
  porteTitre: { fontFamily: fonts.iaMedium, fontSize: 12.5, color: colors.text },
  porteSous: { fontFamily: fonts.ia, fontSize: 10, color: colors.gris2 },
  porteChevron: { color: colors.text, fontSize: 22 },

  version: {
    fontFamily: fonts.ia,
    fontSize: 9.5,
    color: MUTED,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },

  // Feuille de saisie du pseudo
  pseudoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16,17,20,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  pseudoCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.text,
    padding: spacing.xl,
  },
  pseudoTitre: { fontFamily: fonts.grec, fontSize: 19, color: colors.text },
  pseudoMessage: {
    fontFamily: fonts.ia,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.gris2,
    marginTop: spacing.sm,
  },
  pseudoInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.ia,
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.lg,
  },
  pseudoErreur: {
    fontFamily: fonts.ia,
    fontSize: 11.5,
    color: colors.alerte,
    marginTop: spacing.sm,
  },
  pseudoActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  pseudoAnnuler: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.text,
  },
  pseudoValider: { backgroundColor: colors.text },
  pseudoBtnTexte: { fontFamily: fonts.iaMedium, fontSize: 14, color: colors.text },
  pseudoValiderTexte: { color: colors.background },
});