import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { streamChapter, ApiError, type HeroState } from '@/services/api';
import type { MockChapter } from '@/data/mock';
import { colors, spacing, radii } from '@/theme';

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const game = useAppStore((s) => s.currentGame);
  const heroState = useAppStore((s) => s.heroState);
  const setHeroState = useAppStore((s) => s.setHeroState);
  const updateCurrentGame = useAppStore((s) => s.updateCurrentGame);

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pressedChoice, setPressedChoice] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastChoiceRef = useRef<number | null>(null);

  // Nettoie l'abort controller au démontage
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!game || params.gameId !== game.gameId) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Partie introuvable.</Text>
      </View>
    );
  }

  const current: MockChapter = game.chapters[game.currentIndex];

  const retryChoice = () => {
    const idx = lastChoiceRef.current;
    if (idx === null) return;
    setStreamError(null);
    handleChoice(idx);
  };

  const handleChoice = (index: number) => {
    if (isGenerating) return;
    setPressedChoice(index);
    lastChoiceRef.current = index;
    setIsGenerating(true);
    setStreamError(null);
    setStreamText('');

    const abort = new AbortController();
    abortRef.current = abort;

    streamChapter(
      game.gameId,
      index,
      current.choices[index]?.libelle ?? null,
      {
        signal: abort.signal,
        onText: (delta) => setStreamText((prev) => prev + delta),
        onDone: (done) => {
          const next: MockChapter = {
            number: done.chapter.chapterNumber,
            title: done.chapter.title,
            text: done.chapter.content,
            choices: done.chapter.choices.map((c) => ({ libelle: c.libelle, consequenceResumee: c.consequenceResumee })),
            isEnd: done.isEnd,
          };
          const updated = [...game.chapters, next];
          updateCurrentGame({
            chapters: updated,
            currentIndex: updated.length - 1,
            finished: done.isEnd,
          });
          setHeroState(done.state);
          setIsGenerating(false);
          setPressedChoice(null);

          if (done.isEnd) {
            router.push('/game/end');
          }
        },
        onError: (err) => {
          setIsGenerating(false);
          setPressedChoice(null);
          if (err instanceof ApiError && err.paywall) {
            router.push('/paywall');
          } else {
            // Partiel JETÉ : on reste sur le choix précédent, on propose réessayer
            setStreamError(err.message || 'Connexion perdue pendant l\'écriture du chapitre.');
          }
        },
      },
    );
  };

  const statePreview = heroState ? renderState(heroState) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.gameTitle}>{game.title}</Text>
        <Text style={styles.chapterPos}>
          {current.number === 0 ? 'Prologue' : `Chapitre ${current.number}`}
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.chapterTitle}>{current.title}</Text>
        <Text style={styles.chapterText}>
          {isGenerating ? streamText : current.text}
          {isGenerating && <Text style={styles.cursor}>▌</Text>}
        </Text>

        {isGenerating && (
          <View style={styles.generatingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.generatingText}>L'IA écrit la suite...</Text>
          </View>
        )}

        {streamError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{streamError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retryChoice}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {statePreview && !isGenerating && <View style={styles.stateBox}>{statePreview}</View>}
      </ScrollView>

      {!isGenerating && !streamError && !current.isEnd && current.choices.length > 0 && (
        <View style={styles.choices}>
          <Text style={styles.choicesLabel}>Que fais-tu ?</Text>
          {current.choices.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.choiceButton, pressedChoice === i && styles.choicePressed]}
              onPress={() => handleChoice(i)}
              accessibilityRole="button"
              accessibilityLabel={c.libelle}
            >
              <Text style={styles.choiceText}>{c.libelle}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/** Affiche l'état structuré reçu du serveur (jamais modifié côté client). */
function renderState(state: HeroState) {
  const wounds = state.blessures.filter((b) => !b.soigne);
  const alive = state.pnj.filter((p) => p.statut !== 'mort');
  return (
    <>
      {wounds.length > 0 && (
        <View>
          <Text style={styles.stateLabel}>Blessures</Text>
          {wounds.map((b, i) => (
            <Text key={b.id || i} style={styles.stateItem}>• {b.quoi}</Text>
          ))}
        </View>
      )}
      {state.inventaire.length > 0 && (
        <View>
          <Text style={styles.stateLabel}>Inventaire</Text>
          {state.inventaire.map((it, i) => (
            <Text key={it.id || i} style={styles.stateItem}>• {it.objet}</Text>
          ))}
        </View>
      )}
      {alive.length > 0 && (
        <View>
          <Text style={styles.stateLabel}>Personnages</Text>
          {alive.map((p, i) => (
            <Text key={p.id || i} style={styles.stateItem}>• {p.nom}</Text>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gameTitle: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  chapterPos: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  chapterTitle: { color: colors.text, fontSize: 22, fontWeight: 'bold', marginBottom: spacing.md },
  chapterText: { color: colors.textBody, fontSize: 17, lineHeight: 27 },
  cursor: { color: colors.primary },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.xl },
  generatingText: { color: colors.textSecondary },
  choices: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  choicesLabel: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase' },
  choiceButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  choicePressed: { borderColor: colors.primary, backgroundColor: colors.chipSelected },
  choiceText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  errorBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#5a2a2a',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  errorText: { color: '#ff9b9b', lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  retryText: { color: colors.primary, fontWeight: '600' },
  stateBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  stateLabel: { color: colors.primary, fontSize: 12, textTransform: 'uppercase', marginTop: spacing.xs },
  stateItem: { color: colors.textBody, fontSize: 14, lineHeight: 20 },
});