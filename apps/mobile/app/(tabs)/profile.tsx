/**
 * ÉCRAN PROFIL — l'ex-libris, le solde d'encres, les réglages, le compte.
 * Un seul endroit où la pièce d'encre s'explique. Réglages strictement
 * limités au thème et à la taille du texte. Aucun emoji, radius 0.
 */
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { signOut } from '@/services/auth';
import { getMe } from '@/services/api';
import { SoldeEncres } from '@/components/SoldeEncres';
import { PieceEncre } from '@/components/PieceEncre';
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

export default function ProfileScreen() {
  const router = useRouter();
  const email = useAppStore((s) => s.email);
  const credits = useAppStore((s) => s.credits);

  const [theme, setTheme] = useState<ThemeChoix>('systeme');
  const [taille, setTaille] = useState<TailleChoix>('M');
  // Statut Fable+ lu côté serveur (jamais le store local, la sync d'achat
  // peut être en cours). null = pas encore chargé.
  const [meFable, setMeFable] = useState<{ isPremium: boolean } | null>(null);

  useEffect(() => {
    let actif = true;
    getMe()
      .then((m) => { if (actif) setMeFable({ isPremium: m.isPremium }); })
      .catch(() => { if (actif) setMeFable({ isPremium: false }); });
    return () => { actif = false; };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  const supprimerCompte = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible : votre compte, vos histoires et vos encres seront effacés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            // La suppression côté serveur n'est pas branchée dans le
            // prototype : on termine la session et on revient à l'accueil.
            await signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>Profil</Text>
        <SoldeEncres solde={credits} denticules={5} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* L'ex-libris — seule explication de la pièce d'encre */}
        <View style={styles.exlibris}>
          <PieceEncre size={140} />
          <Text style={styles.exlibrisTexte}>La pièce d'encre — chaque image coûte une encre.</Text>
        </View>

        {/* Solde d'encres et boutique */}
        <TouchableOpacity
          style={styles.boutiqueBloc}
          onPress={() => router.push('/shop')}
          accessibilityRole="button"
          accessibilityLabel="Accéder à la boutique"
        >
          <Text style={styles.boutiqueSolde}>{credits} encres</Text>
          <Text style={styles.boutiqueLien}>Accéder à la boutique</Text>
        </TouchableOpacity>

        {/* Statut Fable+ : affiché en direct depuis le serveur (jamais le
            store local : un retour d'achat peut être en cours de sync). */}
        {meFable !== null && (
          <TouchableOpacity
            style={styles.fableBloc}
            onPress={() => router.push('/paywall')}
            accessibilityRole="button"
            accessibilityLabel={meFable.isPremium ? 'Fable+ actif' : 'Découvrir Fable+'}
          >
            {meFable.isPremium ? (
              <Text style={styles.fableActif}>Fable+ actif — couvertures illustrées incluses</Text>
            ) : (
              <Text style={styles.fableInactif}>Compte Fable — les couvertures illustrées viennent avec Fable+</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Réglages : thème et taille de texte, rien d'autre */}
        <Text style={styles.section}>Réglages</Text>
        <View style={styles.groupe}>
          <Text style={styles.groupeLabel}>Thème</Text>
          <View style={styles.choixRang}>
            {THEMES.map((t) => (
              <Choix
                key={t.cle}
                label={t.label}
                actif={theme === t.cle}
                onPress={() => setTheme(t.cle)}
              />
            ))}
          </View>
        </View>
        <View style={styles.groupe}>
          <Text style={styles.groupeLabel}>Taille du texte</Text>
          <View style={styles.choixRang}>
            {TAILLES.map((t) => (
              <Choix
                key={t.cle}
                label={t.label}
                actif={taille === t.cle}
                onPress={() => setTaille(t.cle)}
              />
            ))}
          </View>
        </View>

        {/* Compte */}
        {email ? (
          <>
            <Text style={styles.section}>Compte</Text>
            <Text style={styles.email}>{email}</Text>
            <View style={styles.compteActions}>
              <Button label="Se déconnecter" variant="secondary" onPress={handleSignOut} />
              <TouchableOpacity
                style={styles.supprimer}
                onPress={supprimerCompte}
                accessibilityRole="button"
              >
                <Text style={styles.supprimerTexte}>Supprimer le compte</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* Mentions discrètes */}
        <View style={styles.liens}>
          <TouchableOpacity onPress={() => Alert.alert('Mentions légales', 'Disponibles prochainement.')}>
            <Text style={styles.lien}>Mentions légales</Text>
          </TouchableOpacity>
          <Text style={styles.lienSep}>·</Text>
          <TouchableOpacity onPress={() => Alert.alert('Politique de confidentialité', 'Disponible prochainement.')}>
            <Text style={styles.lien}>Politique de confidentialité</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Choix({ label, actif, onPress }: { label: string; actif: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.choix}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
    >
      {/* Filet obsidienne 2×20 au-dessus du choix actif */}
      <View style={[styles.choixFilet, actif && styles.choixFiletActif]} />
      <Text style={[styles.choixTexte, actif && styles.choixTexteActif]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  titre: { color: colors.text, fontFamily: fonts.grec, fontSize: 21 },
  contenu: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  exlibris: { alignItems: 'center', marginTop: 32, gap: spacing.md },
  exlibrisTexte: {
    color: colors.textSecondary,
    fontFamily: fonts.ia,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  boutiqueBloc: {
    marginTop: spacing.xl,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    gap: spacing.xs,
  },
  fableBloc: {
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  fableActif: { color: colors.text, fontSize: 12, fontFamily: fonts.iaMedium },
  fableInactif: { color: colors.textSecondary, fontSize: 12, fontFamily: fonts.ia },
  boutiqueSolde: { color: colors.bronze, fontFamily: fonts.grec, fontSize: 30 },
  boutiqueLien: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 12 },
  section: {
    color: colors.textSecondary,
    fontFamily: fonts.iaSemiBold,
    fontSize: 13,
    textTransform: 'uppercase',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  groupe: { gap: spacing.sm, marginBottom: spacing.lg },
  groupeLabel: { color: colors.text, fontFamily: fonts.iaMedium, fontSize: 15 },
  choixRang: { flexDirection: 'row', gap: spacing.lg },
  choix: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  choixFilet: { width: 2, height: 20, backgroundColor: 'transparent' },
  choixFiletActif: { backgroundColor: colors.text },
  choixTexte: { color: colors.textSecondary, fontFamily: fonts.iaMedium, fontSize: 13 },
  choixTexteActif: { color: colors.text, fontFamily: fonts.iaSemiBold },
  email: { color: colors.text, fontFamily: fonts.ia, fontSize: 15 },
  compteActions: { marginTop: spacing.md, gap: spacing.md },
  supprimer: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supprimerTexte: { color: colors.danger, fontFamily: fonts.iaSemiBold, fontSize: 14 },
  liens: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  lien: {
    color: colors.textSecondary,
    fontFamily: fonts.ia,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  lienSep: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 11 },
});