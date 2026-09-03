import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAppStore } from '@/state/store';

export default function IndexScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);

  useEffect(() => {
    // Onboarding : si pas d'âge -> écran âge, sinon accueil
    if (age) {
      router.replace('/home');
    } else {
      router.replace('/age');
    }
  }, [age]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fable</Text>
      <Text style={styles.loading}>Chargement...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101024', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#E8B84B', fontSize: 44, fontWeight: 'bold' },
  loading: { color: '#9a9ab0', marginTop: 12 },
});