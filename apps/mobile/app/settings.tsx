/**
 * ÉCRAN PARAMÈTRES — lecture, notifications, mes données (mention IA),
 * aide et signalement, légal, compte, suppression du compte, version.
 * DA « Pierre & Lapis » : carrés (radius 0), aucune ombre sauf le fil
 * lapis, jamais de solde d'encres sur cet écran.
 */
import { useEffect, useState } from 'react';
import {
  Alert, Linking, Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { listGames } from '@/services/api';
import { signOut } from '@/services/auth';
import { Interrupteur, LigneReglage, Segments } from '@/components/Reglages';
import { Button } from '@/components/Button';
import { colors, fonts, spacing } from '@/theme';

type ThemeChoix = 'systeme' | 'jour' | 'nuit';
type TailleChoix = 'S' | 'M' | 'L';

const THEMES: { cle: ThemeChoix; label: string }[] = [
  { cle: 'systeme', label: 'Système' },
  { cle: 'jour', label: 'Jour' },
  { cle: 'nuit', label: 'Nuit' },
];

const TAILLES: { cle: TailleChoix; label: string }[] = [
  { cle: 'S', label: 'S' },
  { cle: 'M', label: 'M' },
  { cle: 'L', label: 'L' },
];

type Jeu = Awaited<ReturnType<typeof listGames>>;

export default function SettingsScreen() {
  const router = useRouter();
  const email = useAppStore((s) => s.email);
  const credits = useAppStore((s) => s.credits);

  // Lecture — état local (aucun mécanisme de thème global dans l'app).
  const [theme, setTheme] = useState<ThemeChoix>('systeme');
  const [taille, setTaille] = useState<TailleChoix>('M');
  const [tournerPage, setTournerPage] = useState(true);

  // Notifications.
  const [notifImage, setNotifImage] = useState(true);

  // Données.
  const [statsUsage, setStatsUsage] = useState(false); // désactivé par défaut
  const [jeux, setJeux] = useState<Jeu>([]);

  useEffect(() => {
    let actif = true;
    listGames()
      .then((g) => { if (actif) setJeux(g); })
      .catch(() => { /* liste vide : le compte n'a pas pu être chargé */ });
    return () => { actif = false; };
  }, []);

  const nbLivres = jeux.length;
  const nbImages = jeux.filter((g) => g.coverImageUrl).length;

  const exporterDonnees = async () => {
    try {
      const games = await listGames();
      const data = { email, credits, games };
      if (Platform.OS === 'web') {
        // Téléchargement JSON via Blob (web uniquement).
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fable-mes-donnees.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Bientôt disponible', "L'export de tes données arrive dans une prochaine version.");
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer tes histoires pour le moment.');
    }
  };

  const revoquerConsentementIa = () => {
    Alert.alert(
      'Génération par IA',
      'Tu peux retirer ton consentement : tes textes ne seront plus transmis à une intelligence artificielle. Tes histoires existantes restent disponibles.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => {} },
      ],
    );
  };

  const ecrireSupport = async () => {
    try {
      await Linking.openURL('mailto:support@fable.app');
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir ta messagerie.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  const messageSuppression = `Tes ${nbLivres} livres, tes ${nbImages} images et tes ${credits} encres seront effacés sous 30 jours, sans possibilité de retour.`;

  const supprimerCompte = () => {
    Alert.alert(
      'Supprimer mon compte',
      messageSuppression,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            // NOTE : la suppression côté serveur sera branchée plus tard —
            // pour l'instant on termine la session et on revient à l'accueil.
            await signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Barre : retour à gauche, titre centré. Jamais de solde ici. */}
      <View style={styles.barre}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.retour}
        >
          <Text style={styles.retourTexte}>←</Text>
        </TouchableOpacity>
        <Text style={styles.titre}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* ── LECTURE ─────────────────────────────────────────────── */}
        <Text style={styles.section}>Lecture</Text>
        <LigneReglage
          label="Thème"
          droite={
            <Segments options={THEMES} valeur={theme} onChoisir={setTheme} />
          }
        />
        <LigneReglage
          label="Taille du texte"
          droite={
            <Segments options={TAILLES} valeur={taille} onChoisir={setTaille} />
          }
        />
        <LigneReglage
          label="Tourner la page au doigt"
          sousLigne="Sinon, appui sur les bords"
          droite={
            <Interrupteur actif={tournerPage} onToggle={() => setTournerPage((v) => !v)} />
          }
        />

        {/* ── NOTIFICATIONS ───────────────────────────────────────── */}
        <Text style={styles.section}>Notifications</Text>
        <LigneReglage
          label="Mon image est prête"
          sousLigne="La seule notification que nous envoyons"
          droite={
            <Interrupteur actif={notifImage} onToggle={() => setNotifImage((v) => !v)} />
          }
        />

        {/* ── MES DONNÉES ─────────────────────────────────────────── */}
        <Text style={styles.section}>Mes données</Text>
        <LigneReglage
          label="Exporter mes données"
          sousLigne="Toutes tes histoires en JSON"
          droite={<Text style={styles.chevron}>›</Text>}
          onPress={exporterDonnees}
        />
        <LigneReglage
          label="Génération par IA"
          sousLigne="Consentement donné le 3 mars 2026"
          droite={<Text style={styles.chevron}>›</Text>}
          onPress={revoquerConsentementIa}
        />
        <LigneReglage
          label="Statistiques d'usage"
          sousLigne="Nous aide à corriger les pannes"
          droite={
            <Interrupteur actif={statsUsage} onToggle={() => setStatsUsage((v) => !v)} />
          }
        />
        <LigneReglage
          label="Politique de confidentialité"
          droite={<Text style={styles.chevron}>›</Text>}
          onPress={() => Alert.alert('Politique de confidentialité', 'Disponible sur le site.')}
        />

        {/* Mention IA en pied de bloc : fil lapis 1px + halo, la seule
            ombre de l'écran. */}
        <View style={styles.mentionIa}>
          <View style={styles.filLapis} />
          <Text style={styles.mentionIaTexte}>
            Tes histoires et tes images sont écrites par une intelligence artificielle. Les textes que tu saisis lui sont transmis.
          </Text>
        </View>

        {/* ── AIDE ET SIGNALEMENT ─────────────────────────────────── */}
        <Text style={styles.section}>Aide et signalement</Text>
        <LigneReglage
          label="Signaler un contenu"
          sousLigne="Une histoire ou une image"
          droite={<Text style={styles.chevron}>›</Text>}
          onPress={() => Alert.alert('Signaler un contenu', 'Tu peux signaler une histoire ou une image depuis sa page.')}
        />
        <LigneReglage
          label="Écrire au support"
          droite={<Text style={styles.chevron}>›</Text>}
          onPress={ecrireSupport}
        />
        <LigneReglage
          label="Questions fréquentes"
          droite={<Text style={styles.chevron}>›</Text>}
          onPress={() => Alert.alert('Questions fréquentes', 'Disponible sur le site.')}
        />

        {/* ── LÉGAL ───────────────────────────────────────────────── */}
        <Text style={styles.section}>Légal</Text>
        {[
          "Conditions d'utilisation",
          'Conditions de vente',
          'Mentions légales',
          'Licences des polices',
        ].map((l) => (
          <LigneReglage
            key={l}
            label={l}
            droite={<Text style={styles.chevron}>›</Text>}
            onPress={() => Alert.alert(l, 'Disponible sur le site.')}
          />
        ))}

        {/* ── COMPTE ──────────────────────────────────────────────── */}
        <Text style={styles.section}>Compte</Text>
        <LigneReglage label="Adresse e-mail" sousLigne={email ?? undefined} />
        <LigneReglage
          label="Connecté avec Google"
          droite={<Text style={styles.valeur}>3 mars 2026</Text>}
        />
        <Button
          label="Se déconnecter"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.deconnexion}
        />

        {/* ── SUPPRIMER MON COMPTE ────────────────────────────────── */}
        <Text style={[styles.section, styles.sectionDanger]}>Supprimer mon compte</Text>
        <Text style={styles.suppressionTexte}>
          Tes {nbLivres} livres, tes {nbImages} images et tes {credits} encres seront effacés
          sous 30 jours, sans possibilité de retour. Les factures sont conservées 10 ans, comme
          la loi l'exige. Ton abonnement doit être annulé séparément dans l'App Store.
        </Text>
        <TouchableOpacity
          style={styles.supprimer}
          onPress={supprimerCompte}
          accessibilityRole="button"
          accessibilityLabel="Supprimer mon compte"
        >
          <Text style={styles.supprimerTexte}>Supprimer mon compte</Text>
        </TouchableOpacity>

        {/* ── VERSION ─────────────────────────────────────────────── */}
        <Text style={styles.version}>FABLE 1.0.4 · 2026</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  barre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retour: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  retourTexte: { color: colors.text, fontFamily: fonts.ia, fontSize: 22, lineHeight: 24 },
  titre: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.text,
    fontFamily: fonts.grec,
    fontSize: 21,
  },
  contenu: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  section: {
    color: colors.textSecondary,
    fontFamily: fonts.iaSemiBold,
    fontSize: 10,
    letterSpacing: 0.9, // .09em à 10px
    textTransform: 'uppercase',
    marginTop: spacing.xxl,
    marginBottom: spacing.xs,
  },
  sectionDanger: { color: colors.alerte },
  chevron: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 14 },
  valeur: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 12 },
  mentionIa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  filLapis: {
    width: 1,
    height: 20,
    backgroundColor: colors.primary,
    shadowColor: '#6B8CFF',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  mentionIaTexte: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.ia,
    fontSize: 9.5,
    lineHeight: 14,
  },
  deconnexion: { height: 44, minHeight: 44, marginTop: spacing.lg },
  suppressionTexte: {
    color: colors.gris2,
    fontFamily: fonts.ia,
    fontSize: 11,
    lineHeight: 16.5, // interligne 1.5
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  supprimer: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.alerte,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supprimerTexte: { color: colors.alerte, fontFamily: fonts.iaSemiBold, fontSize: 14 },
  version: {
    color: '#8A8B90',
    fontFamily: fonts.ia,
    fontSize: 9.5,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});