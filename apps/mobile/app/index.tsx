import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/store';
import { getCurrentSession, onAuthStateChange } from '@/services/auth';
import { colors, spacing } from '@/theme';

export default function IndexScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const setEmail = useAppStore((s) => s.setEmail);
  const setUserName = useAppStore((s) => s.setUserName);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const session = await getCurrentSession();
      if (!active) return;
      if (session?.user.email) {
        setEmail(session.user.email);
        setUserName(session.user.email.split('@')[0] || 'Héros');
      }
      setChecked(true);
    })();

    const unsubscribe = onAuthStateChange((session) => {
      if (session?.user.email) {
        setEmail(session.user.email);
        setUserName(session.user.email.split('@')[0] || 'Héros');
      } else {
        setEmail('');
        setUserName('');
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    const email = useAppStore.getState().email;
    // Onboarding : âge -> auth -> onglets
    if (!age) {
      router.replace('/age');
    } else if (!email) {
      router.replace('/auth');
    } else {
      router.replace('/(tabs)');
    }
  }, [checked, age]);

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