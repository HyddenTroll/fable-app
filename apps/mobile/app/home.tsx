import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';

export default function HomeScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const currentGame = useAppStore((s) => s.currentGame);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  const ageLabel = age ?? 'inconnu';

  const continueGame = () => {
    if (currentGame) {
      router.push(`/game/${currentGame.gameId}`);
    }
  };

  const startNew = () => {
    router.push('/new-game');
  };

  const resetApp = () => {
    setCurrentGame(null);
  };

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

      <TouchableOpacity style={styles.primaryButton} onPress={startNew}>
        <Text style={styles.primaryText}>+ Nouvelle aventure</Text>
      </TouchableOpacity>

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>Prototype - debug</Text>
        <Text style={styles.debugText}>Ce prototype utilise des données fictives (pas d'IA réelle).</Text>
        {currentGame && (
          <TouchableOpacity onPress={resetApp}>
            <Text style={styles.debugLink}>Réinitialiser la partie en cours</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101024' },
  content: { padding: 24, gap: 16 },
  title: { color: '#E8B84B', fontSize: 36, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#9a9ab0', textAlign: 'center' },
  continueCard: {
    backgroundColor: '#1c1c3a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8B84B',
    marginTop: 16,
  },
  continueTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  continueMeta: { color: '#9a9ab0', marginTop: 6 },
  primaryButton: {
    backgroundColor: '#E8B84B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryText: { color: '#101024', fontSize: 17, fontWeight: 'bold' },
  debugBox: {
    backgroundColor: '#181830',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  debugTitle: { color: '#E8B84B', fontWeight: 'bold' },
  debugText: { color: '#9a9ab0', marginTop: 6, lineHeight: 18 },
  debugLink: { color: '#E8B84B', marginTop: 10, textDecorationLine: 'underline' },
});