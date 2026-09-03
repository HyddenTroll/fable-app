import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { generateMockChapter } from '@/services/mockStory';
import type { MockChapter } from '@/data/mock';
import { colors, spacing, radii } from '@/theme';

const TOTAL_CHAPTERS = 8;

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const game = useAppStore((s) => s.currentGame);
  const gameParams = useAppStore((s) => s.gameParams);
  const updateCurrentGame = useAppStore((s) => s.updateCurrentGame);

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pressedChoice, setPressedChoice] = useState<number | null>(null);

  // Streaming simulé : affiche le texte chapitre par chapitre
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Réinitialise le stream à l'ouverture du chapitre courant
    const current = game?.chapters[game.currentIndex];
    if (current && !isGenerating) {
      setStreamText('');
    }
    return () => {
      if (streamTimer.current) clearTimeout(streamTimer.current);
    };
  }, [game?.currentIndex]);

  if (!game || params.gameId !== game.gameId) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Partie introuvable.</Text>
      </View>
    );
  }

  const current: MockChapter = game.chapters[game.currentIndex];
  const gParams = gameParams ?? {
    genre: 'fantasy',
    difficulty: 'moyenne',
    chapterLength: 'moyen',
    style: 'classique',
    maxChoices: 3,
  };

  const simulateStreaming = (text: string, onDone: () => void) => {
    setStreamText('');
    let i = 0;
    const step = () => {
      i += 3;
      setStreamText(text.slice(0, i));
      if (i < text.length) {
        streamTimer.current = setTimeout(step, 12);
      } else {
        onDone();
      }
    };
    step();
  };

  const handleChoice = (index: number) => {
    if (isGenerating) return;
    setPressedChoice(index);
    setIsGenerating(true);
    setStreamText('');

    const nextNumber = current.number + 1;
    const next = generateMockChapter(
      gParams,
      nextNumber,
      TOTAL_CHAPTERS,
      current.choices[index]?.libelle ?? '',
    );

    // Simule la latence réseau + stream
    setTimeout(() => {
      simulateStreaming(next.text, () => {
        const updated = [...game.chapters, next];
        updateCurrentGame({
          chapters: updated,
          currentIndex: updated.length - 1,
          finished: next.isEnd ?? false,
          endingType: next.endingType,
        });
        setIsGenerating(false);
        setPressedChoice(null);

        if (next.isEnd) {
          router.push('/game/end');
        }
      });
    }, 800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.gameTitle}>{game.title}</Text>
        <Text style={styles.chapterPos}>
          {current.number === 0 ? 'Prologue' : `Chapitre ${current.number}/${TOTAL_CHAPTERS}`}
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
      </ScrollView>

      {!isGenerating && !current.isEnd && current.choices.length > 0 && (
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
});