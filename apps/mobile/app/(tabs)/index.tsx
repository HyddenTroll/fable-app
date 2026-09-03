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
  const credits = useAppStore((s) => s.credits);

  const continueGame = () => {
    if (currentGame) router.push(`/game/${currentGame.gameId}`);
  };

  const startNew = () => router.push('/new-game');

  const isAuthed = !!email;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Fable</Text>
        <View style={styles.badges}>
          {!isAuthed && (
            <TouchableOpacity onPress={() => router.push('/auth')}>
              <Text style={styles.badgeLink}>Connexion</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/shop')}>
            <Text style={styles.creditsBadge}>✨ {credits}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {age && <Text style={styles.subtitle}>Tranche d'âge : {age}</Text>}

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

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>Prototype - debug</Text>
        <Text style={styles.debugText}>
          Données fictives (pas d'IA réelle). Connecté : {email ?? 'non'}.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.primary, fontSize: 32, fontWeight: 'bold' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badgeLink: { color: colors.primary, fontSize: 14, textDecorationLine: 'underline' },
  creditsBadge: { color: colors.text, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.xl, overflow: 'hidden' },
  subtitle: { color: colors.textSecondary, fontSize: 13 },
  continueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.md,
  },
  continueTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  continueMeta: { color: colors.textSecondary, marginTop: 6 },
  debugBox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.sm },
  debugTitle: { color: colors.primary, fontWeight: 'bold' },
  debugText: { color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
});