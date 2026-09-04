import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { handleAuthCallbackUrl } from '@/services/auth';
import { useAppStore } from '@/state/store';
import { colors, spacing } from '@/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const setEmail = useAppStore((s) => s.setEmail);
  const setUserName = useAppStore((s) => s.setUserName);

  useEffect(() => {
    (async () => {
      try {
        // L'URL complète est reconstruite depuis les params du deep link
        const { url } = params;
        if (typeof url === 'string') {
          await handleAuthCallbackUrl(url);
        } else {
          throw new Error('URL manquante');
        }
        const session = await import('@/services/auth').then((m) => m.getCurrentSession());
        if (session?.user.email) {
          setEmail(session.user.email);
          setUserName(session.user.email.split('@')[0] || 'Héros');
        }
        router.replace('/(tabs)');
      } catch {
        router.replace('/auth');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fable</Text>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>Connexion...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { color: colors.primary, fontSize: 36, fontWeight: 'bold' },
  text: { color: colors.textSecondary },
});