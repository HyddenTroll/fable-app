import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { AGE_GROUPS_MOCK } from '@/data/mock';
import { colors, fonts, radii } from '@/theme';

export default function AgeScreen() {
  const router = useRouter();
  const setAge = useAppStore((s) => s.setAge);

  const handleSelect = (code: string) => {
    setAge(code);
    router.push('/auth');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fable</Text>
      <Text style={styles.subtitle}>Quel âge as-tu ?</Text>
      <Text style={styles.hint}>
        Tes histoires s'adaptent à ton âge : violence, horreur et romance sont
        réglées automatiquement.
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {AGE_GROUPS_MOCK.map((g) => (
          <TouchableOpacity
            key={g.code}
            style={styles.card}
            onPress={() => handleSelect(g.code)}
          >
            <Text style={styles.cardText}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center' },
  title: { color: colors.primary, fontFamily: fonts.grec, fontSize: 40, textAlign: 'center' },
  subtitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 22, textAlign: 'center', marginTop: 8 },
  hint: { color: colors.textSecondary, fontFamily: fonts.ia, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20 },
  list: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardText: { color: colors.text, fontFamily: fonts.iaMedium, fontSize: 18, textAlign: 'center' },
});