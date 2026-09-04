import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';
import { signOut } from '@/services/auth';

export default function ProfileTabScreen() {
  const router = useRouter();
  const email = useAppStore((s) => s.email);
  const age = useAppStore((s) => s.age);
  const isPremium = useAppStore((s) => s.isPremium);
  const credits = useAppStore((s) => s.credits);
  const currentGame = useAppStore((s) => s.currentGame);
  const setPremium = useAppStore((s) => s.setPremium);

  const chaptersRead = currentGame ? currentGame.chapters.length : 0;
  const gamesFinished = 0; // placeholder - sera branché aux stats réelles

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profil</Text>

      {email ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Compte</Text>
          <Text style={styles.cardValue}>{email}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.badge}>{isPremium ? 'Fable+ actif' : 'Plan gratuit'}</Text>
            <Text style={styles.badge}>✨ {credits} crédits</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.loginCard} onPress={() => router.push('/auth')}>
          <Text style={styles.loginText}>Se connecter</Text>
        </TouchableOpacity>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Statistiques</Text>
        <Text style={styles.cardValue}>
          Chapitres lus : {chaptersRead} · Romans terminés : {gamesFinished}
        </Text>
        <Text style={styles.cardValue}>Âge déclaré : {age ?? '—'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Succès</Text>
        <Text style={styles.cardValue}>
          (V1) - Les succès arrivent avec les statistiques réelles.
        </Text>
      </View>

      {!isPremium && (
        <Button label="Passer à Fable+ (4,99 €/mois)" onPress={() => router.push('/paywall')} />
      )}
      {isPremium && (
        <Button label="Gérer Fable+" variant="secondary" onPress={() => setPremium(false)} />
      )}

      <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/settings')}>
        <Text style={styles.settingsText}>Réglages (son, lecture, compte)</Text>
      </TouchableOpacity>

      {email && (
        <Button
          label="Se déconnecter"
          variant="secondary"
          onPress={handleSignOut}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  title: { color: colors.primary, fontSize: 28, fontWeight: 'bold' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardLabel: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase' },
  cardValue: { color: colors.text, fontSize: 15 },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  badge: {
    color: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.xl,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  loginText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  settingsRow: { paddingVertical: spacing.md, alignItems: 'center' },
  settingsText: { color: colors.primary, textDecorationLine: 'underline' },
});