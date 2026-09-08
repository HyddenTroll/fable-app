import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { DialogueFable, type DialogueAction } from '@/components/DialogueFable';
import { ColonneJauge } from '@/components/ColonneJauge';
import { useRestoreGame } from '@/hooks/useRestoreGame';
import { listGames, deleteGame, readGame, type HeroState } from '@/services/api';
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

/** Étiquette de la colonne : le titre du livre, tronqué à 14 caractères. */
const jaugeLabel = (title: string): string => {
  const t = (title ?? '').trim();
  if (!t) return '…';
  return t.length > 14 ? `${t.slice(0, 14)}…` : t;
};

export default function HomeTabScreen() {
  const router = useRouter();
  const age = useAppStore((s) => s.age);
  const email = useAppStore((s) => s.email);
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);
  const setHeroState = useAppStore((s) => s.setHeroState);
  const currentGame = useAppStore((s) => s.currentGame);

  const [games, setGames] = useState<GameItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<{
    kind: 'confirm' | 'erreur';
    title?: string;
    message: string;
    actions: DialogueAction[];
  } | null>(null);

  // Restaure la partie en cours depuis le serveur (rien n'est perdu)
  useRestoreGame();

  // Rafraîchit la liste à chaque retour sur l'accueil (chapitre ajouté,
  // histoire créée ou supprimée ailleurs).
  useFocusEffect(
    useCallback(() => {
      if (!email) {
        setGames([]);
        return;
      }
      listGames()
        .then(setGames)
        .catch((e) => setListError(e instanceof Error ? e.message : 'Liste indisponible.'));
    }, [email]),
  );

  const continueGame = () => {
    if (currentGame) router.push(`/game/${currentGame.gameId}`);
  };

  const startNew = () => router.push('/new-game');

  const isAuthed = !!email;

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
      setDialogue({
        kind: 'erreur',
        title: 'Impossible d\u2019ouvrir',
        message: e instanceof Error ? e.message : "Impossible d'ouvrir l'histoire.",
        actions: [{ label: 'Fermer', kind: 'secondary', onPress: () => setDialogue(null) }],
      });
    }
  };

  const doDelete = async (g: GameItem) => {
    setBusyId(g.id);
    try {
      await deleteGame(g.id);
      setGames((prev) => (prev ?? []).filter((x) => x.id !== g.id));
      // Si l'histoire supprimée était la partie en cours, on la retire du store.
      if (currentGame?.gameId === g.id) setCurrentGame(null);
    } catch (e) {
      // Les erreurs ne s'excusent pas : elles disent ce qui s'est passé.
      setDialogue({
        kind: 'erreur',
        title: 'Suppression impossible',
        message: "L'histoire n'a pas pu être supprimée.",
        actions: [{ label: 'Fermer', kind: 'secondary', onPress: () => setDialogue(null) }],
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = (g: GameItem) => {
    setDialogue({
      kind: 'confirm',
      title: 'Supprimer cette histoire ?',
      message: `« ${g.title} » et tous ses chapitres ne seront plus visibles.`,
      actions: [
        { label: 'Annuler', kind: 'secondary', onPress: () => setDialogue(null) },
        {
          label: 'Supprimer',
          kind: 'primary',
          onPress: () => {
            setDialogue(null);
            void doDelete(g);
          },
        },
      ],
    });
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Logo size={54} />
        <View style={styles.headerRight}>
          {!isAuthed && (
            <TouchableOpacity onPress={() => router.push('/auth')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Connexion</Text>
            </TouchableOpacity>
          )}
          {isAuthed && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Profil</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isAuthed ? (
        <Text style={styles.greeting}>Mes histoires</Text>
      ) : (
        <Text style={styles.greeting}>Bienvenue sur Fable</Text>
      )}

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

      <Button label="Commencer une histoire" onPress={startNew} />

      <Text style={styles.sectionTitle}>Mes histoires</Text>
      {listError && <Text style={styles.listError}>{listError}</Text>}
      {isAuthed && games === null && (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      )}
      {isAuthed && games !== null && games.length === 0 && (
        <Text style={styles.empty}>Aucune histoire pour l'instant — chaque aventure générée s'enregistrera ici.</Text>
      )}
      {isAuthed &&
        (games ?? []).map((g) => (
          <View key={g.id} style={styles.gameCard}>
            <ColonneJauge chapters={g.chapterCount} label={jaugeLabel(g.title)} />
            <View style={styles.gameCardBody}>
              <TouchableOpacity style={styles.gameInfos} onPress={() => open(g)}>
                <Text style={styles.gameTitle}>{g.title}</Text>
                <Text style={styles.gameMeta}>
                  Chapitre {g.chapterCount} sur 24 · {g.createdAt}
                  {g.status === 'finished' ? ' · terminée' : ''}
                </Text>
              </TouchableOpacity>
              <View style={styles.gameActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => open(g)} accessibilityRole="button">
                  <Text style={styles.actionContinue}>Continuer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => remove(g)}
                  disabled={busyId === g.id}
                  accessibilityRole="button"
                >
                  <Text style={styles.actionDelete}>{busyId === g.id ? '…' : 'Supprimer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

      <Text style={styles.hint}>
        {age ? `Tranche d'âge : ${age}` : 'Choisis ton âge pour commencer'}
      </Text>

      {/* Mention IA — tout écran qui produit du contenu généré (AI Act art. 50) */}
      <View style={styles.iaMention}>
        <View style={styles.iaFil} />
        <Text style={styles.iaMentionText}>Chaque histoire ici est écrite pour toi par une IA.</Text>
      </View>
      </ScrollView>

      <DialogueFable
        visible={!!dialogue}
        title={dialogue?.title}
        message={dialogue?.message ?? ''}
        kind={dialogue?.kind ?? 'confirm'}
        actions={dialogue?.actions ?? []}
        onClose={() => setDialogue(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', gap: spacing.md },
  headerButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  headerButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  greeting: { color: colors.textSecondary, fontSize: 15 },
  continueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  continueMeta: { color: colors.textSecondary, marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 20, marginTop: spacing.sm },
  loader: { marginVertical: spacing.lg },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  listError: { color: colors.danger, fontSize: 14 },
  iaMention: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  iaFil: { width: 1, height: 10, backgroundColor: colors.primary, shadowColor: colors.shadow, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  iaMentionText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, fontFamily: fonts.ia },
  gameCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gameCardBody: { flex: 1, gap: spacing.md },
  gameInfos: { gap: spacing.xs },
  gameTitle: { color: colors.text, fontSize: 16, fontWeight: '600', fontFamily: fonts.grec },
  gameMeta: { color: colors.textSecondary, fontSize: 10.5 },
  gameActions: { flexDirection: 'row', gap: spacing.lg },
  actionBtn: { paddingVertical: spacing.sm },
  actionContinue: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  actionDelete: { color: colors.danger, fontWeight: '600', fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});