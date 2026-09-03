import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { GameParams } from '@fable/shared';
import { GENRES, HERO_TRAITS, NARRATIVE_STYLES, CHAPTER_LENGTHS, DIFFICULTIES } from '@/data/mock';
import { createMockGame } from '@/services/mockStory';
import { useAppStore } from '@/state/store';

type Step = 'genre' | 'hero' | 'params';

export default function NewGameScreen() {
  const router = useRouter();
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);

  const [step, setStep] = useState<Step>('genre');
  const [genreCode, setGenreCode] = useState<string>('fantasy');
  const [subGenre, setSubGenre] = useState<string | null>(null);
  const [heroName, setHeroName] = useState('');
  const [heroTrait, setHeroTrait] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<GameParams['difficulty']>('moyenne');
  const [chapterLength, setChapterLength] = useState<GameParams['chapterLength']>('moyen');
  const [style, setStyle] = useState<GameParams['style']>('classique');
  const [maxChoices, setMaxChoices] = useState<GameParams['maxChoices']>(3);

  const selectedGenre = GENRES.find((g) => g.code === genreCode)!;

  const startGame = () => {
    const params: GameParams = {
      genre: genreCode as GameParams['genre'],
      subGenre: subGenre ?? undefined,
      difficulty,
      chapterLength,
      style,
      maxChoices,
    };
    const { gameId, title, genreLabel, prologue } = createMockGame(params);
    setCurrentGame({
      gameId,
      title,
      genreLabel,
      heroName: heroName || 'Le Héros',
      chapters: [prologue],
      currentIndex: 0,
      resume: '',
      finished: false,
    });
    router.push(`/game/${gameId}`);
  };

  const canContinue =
    step === 'hero' ? heroName.trim().length > 0 : true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepTitle}>
        {step === 'genre' ? '1. Choisis ton univers' :
         step === 'hero' ? '2. Ton héros' : '3. Personnalisation'}
      </Text>

      {step === 'genre' && (
        <>
          {GENRES.map((g) => (
            <View key={g.code} style={styles.genreBlock}>
              <TouchableOpacity
                style={[styles.genreCard, genreCode === g.code && styles.selected]}
                onPress={() => { setGenreCode(g.code); setSubGenre(null); }}
              >
                <Text style={styles.genreName}>{g.label}</Text>
                <Text style={styles.genreDesc}>{g.description}</Text>
              </TouchableOpacity>
              {genreCode === g.code && g.subGenres.length > 0 && (
                <View style={styles.subGenreRow}>
                  <TouchableOpacity
                    style={[styles.subGenreChip, subGenre === null && styles.selectedChip]}
                    onPress={() => setSubGenre(null)}
                  >
                    <Text style={styles.subGenreText}>Ambiance libre</Text>
                  </TouchableOpacity>
                  {g.subGenres.map((sg) => (
                    <TouchableOpacity
                      key={sg.code}
                      style={[styles.subGenreChip, subGenre === sg.code && styles.selectedChip]}
                      onPress={() => setSubGenre(sg.code)}
                    >
                      <Text style={styles.subGenreText}>{sg.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {step === 'hero' && (
        <>
          <Text style={styles.label}>Nom du héros</Text>
          <TextInput
            style={styles.input}
            value={heroName}
            onChangeText={setHeroName}
            placeholder="Entre un nom..."
            placeholderTextColor="#6a6a8a"
          />
          <Text style={styles.label}>Trait de personnalité (optionnel)</Text>
          <View style={styles.chipsRow}>
            {HERO_TRAITS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, heroTrait === t && styles.selectedChip]}
                onPress={() => setHeroTrait(heroTrait === t ? null : t)}
              >
                <Text style={styles.subGenreText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {step === 'params' && (
        <>
          <Text style={styles.label}>Difficulté</Text>
          <View style={styles.chipsRow}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d.code}
                style={[styles.chip, difficulty === d.code && styles.selectedChip]}
                onPress={() => setDifficulty(d.code as GameParams['difficulty'])}
              >
                <Text style={styles.subGenreText}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Longueur des chapitres</Text>
          <View style={styles.chipsRow}>
            {CHAPTER_LENGTHS.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.chip, chapterLength === c.code && styles.selectedChip]}
                onPress={() => setChapterLength(c.code as GameParams['chapterLength'])}
              >
                <Text style={styles.subGenreText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Style narratif</Text>
          <View style={styles.chipsRow}>
            {NARRATIVE_STYLES.map((s) => (
              <TouchableOpacity
                key={s.code}
                style={[styles.chip, style === s.code && styles.selectedChip]}
                onPress={() => setStyle(s.code as GameParams['style'])}
              >
                <Text style={styles.subGenreText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Nombre de choix</Text>
          <View style={styles.chipsRow}>
            {[2, 3, 4].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, maxChoices === n && styles.selectedChip]}
                onPress={() => setMaxChoices(n as GameParams['maxChoices'])}
              >
                <Text style={styles.subGenreText}>{n} choix</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={styles.navRow}>
        {step !== 'genre' && (
          <TouchableOpacity
            style={[styles.button, styles.secondary]}
            onPress={() => setStep(step === 'params' ? 'hero' : 'genre')}
          >
            <Text style={styles.secondaryText}>Retour</Text>
          </TouchableOpacity>
        )}
        {step === 'params' ? (
          <TouchableOpacity style={styles.button} onPress={startGame}>
            <Text style={styles.primaryText}>Commencer l'aventure</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, !canContinue && styles.disabled]}
            disabled={!canContinue}
            onPress={() => setStep(step === 'genre' ? 'hero' : 'params')}
          >
            <Text style={styles.primaryText}>Continuer</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101024' },
  content: { padding: 24, gap: 12 },
  stepTitle: { color: '#E8B84B', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  genreBlock: { marginBottom: 4 },
  genreCard: {
    backgroundColor: '#1c1c3a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2c2c5a',
  },
  selected: { borderColor: '#E8B84B' },
  genreName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  genreDesc: { color: '#9a9ab0', marginTop: 4 },
  subGenreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  subGenreChip: {
    backgroundColor: '#181830',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2c2c5a',
  },
  selectedChip: { borderColor: '#E8B84B', backgroundColor: '#2a2a50' },
  subGenreText: { color: '#d0d0e0' },
  label: { color: '#fff', fontSize: 15, marginTop: 8 },
  input: {
    backgroundColor: '#1c1c3a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2c2c5a',
    marginTop: 6,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    backgroundColor: '#181830',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2c2c5a',
  },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 24, justifyContent: 'flex-end' },
  button: {
    backgroundColor: '#E8B84B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    flex: 1,
  },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2c2c5a' },
  secondaryText: { color: '#d0d0e0' },
  primaryText: { color: '#101024', fontSize: 16, fontWeight: 'bold' },
  disabled: { opacity: 0.4 },
});