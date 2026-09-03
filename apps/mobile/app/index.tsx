import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAppStore } from '@/state/store';
import { colors, spacing } from '@/theme';

export default function IndexScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const email = useAppStore((s) => s.email);

  useEffect(() => {
    // Onboarding : âge -> auth -> onglets
    if (!age) {
      router.replace('/age');
    } else if (!email) {
      router.replace('/auth');
    } else {
      router.replace('/(tabs)');
    }
  }, [age, email]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fable</Text>
      <Text style={styles.loading}>Chargement...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.primary, fontSize: 44, fontWeight: 'bold' },
  loading: { color: colors.textSecondary, marginTop: spacing.md },
});