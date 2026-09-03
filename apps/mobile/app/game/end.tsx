import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';

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

  const finalChapter = game.chapters[game.chapters.length - 1];

  const playAgain = () => {
    setCurrentGame(null);
    router.replace('/new-game');
  };

  const goHome = () => {
    setCurrentGame(null);
    router.replace('/home');
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

      <TouchableOpacity style={styles.button} onPress={playAgain}>
        <Text style={styles.buttonText}>Recommencer une aventure</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondary} onPress={goHome}>
        <Text style={styles.secondaryText}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101024', padding: 24, justifyContent: 'center' },
  fin: { color: '#E8B84B', fontSize: 48, fontWeight: 'bold', textAlign: 'center' },
  endingType: { color: '#fff', fontSize: 22, textAlign: 'center', marginTop: 6 },
  stats: {
    backgroundColor: '#1c1c3a',
    borderRadius: 12,
    padding: 16,
    marginTop: 28,
    gap: 6,
  },
  statTitle: { color: '#E8B84B', fontWeight: 'bold', marginBottom: 4 },
  stat: { color: '#d0d0e0' },
  closing: { color: '#9a9ab0', textAlign: 'center', marginTop: 24, lineHeight: 22 },
  button: {
    backgroundColor: '#E8B84B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#101024', fontSize: 16, fontWeight: 'bold' },
  secondary: { padding: 16, alignItems: 'center', marginTop: 8 },
  secondaryText: { color: '#9a9ab0' },
  meta: { color: '#9a9ab0', textAlign: 'center', marginTop: 40 },
});