import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { useRestoreGame } from '@/hooks/useRestoreGame';
import { colors, spacing, radii, fonts } from '@/theme';

export default function HomeTabScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const email = useAppStore((s) => s.email);
  const currentGame = useAppStore((s) => s.currentGame);

  // Restaure la partie en cours depuis le serveur (rien n'est perdu)
  useRestoreGame();

  const continueGame = () => {
    if (currentGame) router.push(`/game/${currentGame.gameId}`);
  };

  const startNew = () => router.push('/new-game');

  const isAuthed = !!email;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Fable</Text>
        <View style={styles.headerRight}>
          {!isAuthed && (
            <TouchableOpacity onPress={() => router.push('/auth')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Connexion</Text>
            </TouchableOpacity>
          )}
          {isAuthed && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Profil</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Fil de lapis : le trait lumineux qui traverse la marque (= l'IA) */}
      <View style={styles.filLapis} />

      {isAuthed ? (
        <Text style={styles.greeting}>Bonjour {email.split('@')[0]}</Text>
      ) : (
        <Text style={styles.greeting}>Bienvenue sur Fable</Text>
      )}

      {currentGame ? (
        <TouchableOpacity style={styles.continueCard} onPress={continueGame}>
          <Text style={styles.continueTitle}>Continuer l'aventure</Text>
          <Text style={styles.continueMeta}>
            {currentGame.title} · Chapitre {currentGame.chapters.length || 1}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.continueCard} onPress={startNew}>
          <Text style={styles.continueTitle}>Commencer une aventure</Text>
          <Text style={styles.continueMeta}>Aucune partie en cours</Text>
        </TouchableOpacity>
      )}

      <Button label="+ Nouvelle aventure" onPress={startNew} />

      <TouchableOpacity style={styles.libraryBtn} onPress={() => router.push('/library')}>
        <Text style={styles.libraryText}>📚 Mes histoires</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {age ? `Tranche d'âge : ${age}` : 'Choisis ton âge pour commencer'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.primary, fontFamily: fonts.grec, fontSize: 28 },
  filLapis: {
    alignSelf: 'center',
    width: 1,
    height: 30,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  headerRight: { flexDirection: 'row', gap: spacing.md },
  headerButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  headerButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  greeting: { color: colors.textSecondary, fontSize: 15 },
  continueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  libraryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  libraryText: { color: colors.text, fontFamily: fonts.iaMedium, fontSize: 15 },
  continueMeta: { color: colors.textSecondary, marginTop: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});