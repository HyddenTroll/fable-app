import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

export default function EndScreen() {
  const router = useRouter();
  const game = useAppStore((s) => s.currentGame);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  if (!game || !game.finished) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Aucune fin disponible.</Text>
      </View>
    );
  }

  const playAgain = () => {
    setCurrentGame(null);
    router.replace('/new-game');
  };

  const goHome = () => {
    setCurrentGame(null);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.fin}>FIN</Text>
      <Text style={styles.endingType}>{game.endingType ?? 'La fin'}</Text>

      <View style={styles.stats}>
        <Text style={styles.statTitle}>Ta partie</Text>
        <Text style={styles.stat}>Chapitres lus : {game.chapters.length}</Text>
        <Text style={styles.stat}>Choix pris : {game.chapters.length - 1}</Text>
        <Text style={styles.stat}>Héros : {game.heroName}</Text>
      </View>

      <Text style={styles.closing}>
        Le destin de {game.heroName} s'est joué à chaque décision. Une autre
        aventure t'attend déjà, avec d'autres choix et d'autres fins.
      </Text>

      <Button label="Recommencer une aventure" onPress={playAgain} />

      <TouchableOpacity style={styles.secondary} onPress={goHome}>
        <Text style={styles.secondaryText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl, justifyContent: 'center', gap: spacing.md },
  fin: { color: colors.primary, fontSize: 48, fontWeight: 'bold', textAlign: 'center' },
  endingType: { color: colors.text, fontSize: 22, textAlign: 'center', marginTop: spacing.xs },
  stats: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  statTitle: { color: colors.primary, fontWeight: 'bold', marginBottom: spacing.xs },
  stat: { color: colors.textBody },
  closing: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 22 },
  secondary: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.xs },
  secondaryText: { color: colors.textSecondary },
  meta: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});