import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { generateMockChapter } from '@/services/mockStory';
import type { GameParams } from '@fable/shared';
import type { MockChapter } from '@/data/mock';

const TOTAL_CHAPTERS = 8;

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const game = useAppStore((s) => s.currentGame);
  const updateCurrentGame = useAppStore((s) => s.updateCurrentGame);

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');

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
    setIsGenerating(true);
    setStreamText('');

    const nextNumber = current.number + 1;
    const next = generateMockChapter(
      {
        genre: game.genreLabel === 'Fantasy' ? 'fantasy' : 'science_fiction',
        difficulty: 'moyenne',
        chapterLength: 'moyen',
        style: 'classique',
        maxChoices: 3,
      } as GameParams,
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
            <ActivityIndicator color="#E8B84B" />
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
              style={styles.choiceButton}
              onPress={() => handleChoice(i)}
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
  container: { flex: 1, backgroundColor: '#101024' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c5a',
  },
  gameTitle: { color: '#E8B84B', fontSize: 14, fontWeight: '600' },
  chapterPos: { color: '#9a9ab0', fontSize: 12, marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 24 },
  chapterTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 14 },
  chapterText: { color: '#e8e8f0', fontSize: 17, lineHeight: 27 },
  cursor: { color: '#E8B84B' },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  generatingText: { color: '#9a9ab0' },
  choices: { padding: 16, borderTopWidth: 1, borderTopColor: '#2c2c5a', gap: 10 },
  choicesLabel: { color: '#9a9ab0', fontSize: 13, textTransform: 'uppercase' },
  choiceButton: {
    backgroundColor: '#1c1c3a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2c2c5a',
  },
  choiceText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  meta: { color: '#9a9ab0', textAlign: 'center', marginTop: 40 },
});