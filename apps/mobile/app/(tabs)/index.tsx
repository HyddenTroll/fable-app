import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

export default function HomeTabScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const email = useAppStore((s) => s.email);
  const currentGame = useAppStore((s) => s.currentGame);

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
  title: { color: colors.primary, fontSize: 28, fontWeight: 'bold' },
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
  continueMeta: { color: colors.textSecondary, marginTop: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});