import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

export default function PaywallScreen() {
  const router = useRouter();
  const setPremium = useAppStore((s) => s.setPremium);

  const subscribe = () => {
    // PROTOTYPE : abonnement simulé (sera branché aux achats in-app)
    setPremium(true);
    router.replace('/(tabs)');
  };

  const later = () => router.back();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ton aventure continue...</Text>
      <Text style={styles.subtitle}>
        Le chapitre 5 se termine sur un rebondissement. Continue avec Fable+.
      </Text>

      <View style={styles.benefits}>
        <Text style={styles.benefit}>✓ Chapitres illimités</Text>
        <Text style={styles.benefit}>✓ Tous les genres et sous-genres</Text>
        <Text style={styles.benefit}>✓ Personnalisation complète</Text>
        <Text style={styles.benefit}>✓ Génération prioritaire</Text>
        <Text style={styles.benefit}>✓ Sans publicité</Text>
      </View>

      <View style={styles.priceBox}>
        <Text style={styles.price}>4,99 € / mois</Text>
        <Text style={styles.priceAlt}>ou 39,99 € / an (2 mois offerts)</Text>
      </View>

      <Button label="Essayer Fable+ (7 jours offerts)" onPress={subscribe} />

      <Button label="Pas maintenant" variant="secondary" onPress={later} />

      <Text style={styles.legal}>Annulable à tout moment. Les images restent payables en crédits.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg, justifyContent: 'center', flexGrow: 1 },
  title: { color: colors.primary, fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: colors.textBody, textAlign: 'center', lineHeight: 22 },
  benefits: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  benefit: { color: colors.text, fontSize: 16 },
  priceBox: { alignItems: 'center', gap: spacing.xs },
  price: { color: colors.primary, fontSize: 26, fontWeight: 'bold' },
  priceAlt: { color: colors.textSecondary, fontSize: 13 },
  legal: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});