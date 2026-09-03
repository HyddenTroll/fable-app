import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [music, setMusic] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [textSize, setTextSize] = useState(17);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Réglages</Text>

      <Text style={styles.section}>Son</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Musique d'ambiance</Text>
        <Switch value={music} onValueChange={setMusic} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Bruitages</Text>
        <Switch value={sounds} onValueChange={setSounds} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>

      <Text style={styles.section}>Lecture</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Mode sombre</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: colors.primary, false: colors.border }} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Taille du texte : {textSize}</Text>
        <View style={styles.sizeControls}>
          <Button label="−" variant="secondary" onPress={() => setTextSize((s) => Math.max(14, s - 1))} style={styles.sizeButton} />
          <Button label="+" variant="secondary" onPress={() => setTextSize((s) => Math.min(22, s + 1))} style={styles.sizeButton} />
        </View>
      </View>

      <Text style={styles.section}>À propos</Text>
      <Text style={styles.about}>Fable v0.1 - prototype. Contenu généré par IA (AI Act).</Text>

      <Button label="Retour" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  title: { color: colors.primary, fontSize: 28, fontWeight: 'bold' },
  section: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase', marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  rowLabel: { color: colors.text, fontSize: 15 },
  sizeControls: { flexDirection: 'row', gap: spacing.sm },
  sizeButton: { minWidth: 48, paddingHorizontal: spacing.md },
  about: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
});