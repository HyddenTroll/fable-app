import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { CREDIT_PACKS, CREDITS_PER_IMAGE, FABLE_PLUS_MONTHLY } from '@fable/shared';
import { colors, spacing, radii } from '@/theme';

// Paliers d'encres nommés comme des ateliers (jamais de tailles S/M/L).
const ATELIER_NAMES = ['Le carnet', 'Le coffret', "L'atelier", "L'atelier"];

export default function ShopScreen() {
  const router = useRouter();
  const credits = useAppStore((s) => s.credits);
  const addCredits = useAppStore((s) => s.addCredits);
  const isPremium = useAppStore((s) => s.isPremium);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Boutique</Text>

      <View style={styles.balanceBox}>
        <Text style={styles.balanceLabel}>Ton solde</Text>
        <Text style={styles.balance}>{credits} encres</Text>
        <Text style={styles.balanceHint}>1 image = {CREDITS_PER_IMAGE} encres</Text>
      </View>

      <Text style={styles.section}>Encres d'illustration</Text>
      {CREDIT_PACKS.map((p, i) => (
        <View key={p.productId} style={styles.pack}>
          <View style={styles.packInfo}>
            <Text style={styles.packName}>{ATELIER_NAMES[Math.min(i, ATELIER_NAMES.length - 1)]}</Text>
            <Text style={styles.packDesc}>{p.credits} encres · ≈ {p.images} images</Text>
          </View>
          <Button
            label={`${p.priceEur.toFixed(2)} €`}
            onPress={() => {
              // PROTOTYPE : achat simulé (sera validé côté serveur)
              addCredits(p.credits);
              router.back();
            }}
            style={styles.packButton}
          />
        </View>
      ))}

      {!isPremium && (
        <>
          <Text style={styles.section}>Fable+</Text>
          <View style={styles.premiumBox}>
            <Text style={styles.premiumTitle}>{FABLE_PLUS_MONTHLY.label}</Text>
            <Text style={styles.premiumDesc}>
              Chapitres illimités, tous les genres, sans pub.
            </Text>
            <Button
              label={`${FABLE_PLUS_MONTHLY.priceEur.toFixed(2)} €/mois`}
              onPress={() => router.push('/paywall')}
            />
          </View>
        </>
      )}

      <Button label="Retour" variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.lg },
  title: { color: colors.primary, fontSize: 28, fontWeight: 'bold' },
  balanceBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  balanceLabel: { color: colors.textSecondary, fontSize: 13 },
  balance: { color: colors.primary, fontSize: 34, fontWeight: 'bold' },
  balanceHint: { color: colors.textSecondary, fontSize: 13 },
  section: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase', marginTop: spacing.sm },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  packInfo: { gap: 2 },
  packName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  packDesc: { color: colors.textSecondary, fontSize: 13 },
  packButton: { minWidth: 90, backgroundColor: colors.bronze },
  premiumBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  premiumTitle: { color: colors.primary, fontSize: 17, fontWeight: 'bold' },
  premiumDesc: { color: colors.textSecondary, fontSize: 14 },
});