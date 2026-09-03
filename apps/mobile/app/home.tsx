import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const currentGame = useAppStore((s) => s.currentGame);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  const ageLabel = age ?? 'inconnu';

  const continueGame = () => {
    if (currentGame) router.push(`/game/${currentGame.gameId}`);
  };

  const startNew = () => router.push('/new-game');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Fable</Text>
      <Text style={styles.subtitle}>Bienvenue ! (âge : {ageLabel})</Text>

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
          Ce prototype utilise des données fictives (pas d'IA réelle).
        </Text>
        {currentGame && (
          <TouchableOpacity onPress={() => setCurrentGame(null)}>
            <Text style={styles.debugLink}>Réinitialiser la partie en cours</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  title: { color: colors.primary, fontSize: 36, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, textAlign: 'center' },
  continueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.lg,
  },
  continueTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  continueMeta: { color: colors.textSecondary, marginTop: 6 },
  debugBox: { backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, padding: spacing.lg },
  debugTitle: { color: colors.primary, fontWeight: 'bold' },
  debugText: { color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  debugLink: { color: colors.primary, marginTop: 10, textDecorationLine: 'underline' },
});