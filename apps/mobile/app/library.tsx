import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listGames, deleteGame, readGame, type HeroState } from '@/services/api';
import { useAppStore } from '@/state/store';
import { colors, spacing, radii, fonts } from '@/theme';

interface GameItem {
  id: string;
  title: string;
  genre: string;
  heroName: string;
  chapterCount: number;
  createdAt: string;
  status: string;
}

const GENRE_LABELS: Record<string, string> = {
  fantasy: 'Fantasy',
  horreur: 'Horreur',
  romance: 'Romance',
  science_fiction: 'Science-fiction',
  policier: 'Policier',
  historique: 'Historique',
};

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);
  const setHeroState = useAppStore((s) => s.setHeroState);
  const [games, setGames] = useState<GameItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGames(await listGames());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger tes histoires.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (g: GameItem) => {
    try {
      const { game, chapters } = await readGame(g.id);
      setCurrentGame({
        gameId: game.id,
        title: game.title,
        genreLabel: game.genre,
        heroName: game.heroName || g.heroName,
        chapters: chapters.map((ch) => ({
          number: ch.chapterNumber,
          title: ch.title,
          text: ch.content,
          choices: ch.choices,
          isEnd: false,
        })),
        currentIndex: chapters.length - 1,
        resume: '',
        finished: game.status === 'finished',
      });
      const restoredState = (game as unknown as { state?: HeroState | null }).state ?? null;
      setHeroState(restoredState);
      router.push(`/game/${g.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'ouvrir l\'histoire.');
    }
  };

  const remove = (g: GameItem) => {
    Alert.alert(
      'Supprimer cette histoire ?',
      `« ${g.title} » et tous ses chapitres ne seront plus visibles.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setBusyId(g.id);
            try {
              await deleteGame(g.id);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Impossible de supprimer.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mes histoires</Text>
        <View style={styles.backBtn} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {games === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : games.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucune histoire pour l'instant</Text>
          <Text style={styles.emptyText}>
            Chaque histoire générée se sauvegarde automatiquement ici. Tu pourras la
            continuer ou la supprimer à tout moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: g }) => (
            <View style={styles.card}>
              <TouchableOpacity style={styles.cardMain} onPress={() => open(g)}>
                <Text style={styles.cardTitle}>{g.title}</Text>
                <Text style={styles.cardMeta}>
                  {GENRE_LABELS[g.genre] ?? g.genre} · {g.heroName} · Chapitre{' '}
                  {Math.max(g.chapterCount - 1, 0)}
                </Text>
                <Text style={styles.cardDate}>
                  {g.createdAt ? new Date(g.createdAt).toLocaleDateString('fr-FR') : ''}
                </Text>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.continueBtn} onPress={() => open(g)}>
                  <Text style={styles.continueText}>Continuer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => remove(g)}
                  disabled={busyId === g.id}
                >
                  {busyId === g.id ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Text style={styles.deleteText}>Supprimer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backText: { color: colors.primary, fontSize: 30, lineHeight: 32 },
  title: { color: colors.primary, fontFamily: fonts.grec, fontSize: 26, textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.md },
  loader: { marginTop: 60 },
  empty: { marginTop: 60, gap: spacing.md, alignItems: 'center' },
  emptyTitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 20 },
  emptyText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardMain: { gap: spacing.xs },
  cardTitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 19 },
  cardMeta: { color: colors.textSecondary, fontSize: 13 },
  cardDate: { color: colors.textMuted, fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: spacing.md },
  continueBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  continueText: { color: '#fff', fontFamily: fonts.iaSemiBold, fontSize: 14 },
  deleteBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontFamily: fonts.iaMedium, fontSize: 14 },
});