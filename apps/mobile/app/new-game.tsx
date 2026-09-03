import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { GameParams } from '@fable/shared';
import {
  GENRES, HERO_TRAITS, NARRATIVE_STYLES, CHAPTER_LENGTHS, DIFFICULTIES,
} from '@/data/mock';
import { createMockGame } from '@/services/mockStory';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { colors, spacing, radii } from '@/theme';

type Step = 'genre' | 'hero' | 'params';

export default function NewGameScreen() {
  const router = useRouter();
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);
  const setGameParams = useAppStore((s) => s.setGameParams);

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
    setGameParams(params);
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

  const canContinue = step === 'hero' ? heroName.trim().length > 0 : true;

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>
        {step === 'genre' ? '1. Choisis ton univers' :
         step === 'hero' ? '2. Ton héros' : '3. Personnalisation'}
      </Text>

      {step === 'genre' && (
        <FlatList
          data={GENRES}
          keyExtractor={(g) => g.code}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: g }) => (
            <View style={styles.genreBlock}>
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
          )}
        />
      )}

      {step === 'hero' && (
        <View style={styles.formContent}>
          <Text style={styles.label}>Nom du héros</Text>
          <TextInput
            style={styles.input}
            value={heroName}
            onChangeText={setHeroName}
            placeholder="Entre un nom..."
            placeholderTextColor={colors.textMuted}
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
        </View>
      )}

      {step === 'params' && (
        <View style={styles.formContent}>
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
        </View>
      )}

      <View style={styles.navRow}>
        {step !== 'genre' && (
          <Button
            label="Retour"
            variant="secondary"
            onPress={() => setStep(step === 'params' ? 'hero' : 'genre')}
            style={styles.flexButton}
          />
        )}
        {step === 'params' ? (
          <Button label="Commencer l'aventure" onPress={startGame} style={styles.flexButton} />
        ) : (
          <Button
            label="Continuer"
            onPress={() => setStep(step === 'genre' ? 'hero' : 'params')}
            disabled={!canContinue}
            style={styles.flexButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xxl },
  listContent: { gap: spacing.md },
  formContent: { gap: spacing.xs },
  stepTitle: { color: colors.primary, fontSize: 20, fontWeight: 'bold', marginBottom: spacing.lg },
  genreBlock: { marginBottom: spacing.xs },
  genreCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.primary },
  genreName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  genreDesc: { color: colors.textSecondary, marginTop: spacing.xs },
  subGenreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  subGenreChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedChip: { borderColor: colors.primary, backgroundColor: colors.chipSelected },
  subGenreText: { color: colors.textBody },
  label: { color: colors.text, fontSize: 15, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  flexButton: { flex: 1 },
});